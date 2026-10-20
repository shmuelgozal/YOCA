import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  createSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from './auth-crypto';
import { DatabaseService } from './database.service';

interface JoinRequestInput {
  name?: unknown;
  email?: unknown;
}

interface AccountInput {
  token?: unknown;
  email?: unknown;
  username?: unknown;
  password?: unknown;
}

interface LoginInput {
  identifier?: unknown;
  password?: unknown;
}

interface UserRecord extends AuthenticatedUser {
  password_salt: string;
  password_hash: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'coach' | 'member';
  phone?: string | null;
  birthDate?: string | null;
  address?: 'feminine' | 'masculine' | 'neutral' | null;
  trainingSince?: string;
  reminderEnabled?: boolean;
  reminderLeadMinutes?: number;
  updatesEnabled?: boolean;
}

export interface ProfileInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  birthDate?: unknown;
  address?: unknown;
  trainingSince?: unknown;
  reminderEnabled?: unknown;
  reminderLeadMinutes?: unknown;
  updatesEnabled?: unknown;
}

export interface TrainingPackageInput {
  name?: unknown;
  sessions?: unknown;
  price?: unknown;
}

export interface SingleClassPriceInput {
  price?: unknown;
}

export interface MemberDiscountInput {
  kind?: unknown;
  value?: unknown;
  note?: unknown;
}

export interface ManualPaymentInput {
  memberId?: unknown;
  packageId?: unknown;
  packageCount?: unknown;
  method?: unknown;
}

type DiscountKind = 'percent' | 'amount';
type PaymentMethod = 'cash' | 'bit' | 'paybox';

export interface StudioClassInput {
  name?: unknown;
  coach?: unknown;
  location?: unknown;
  date?: unknown;
  time?: unknown;
  capacity?: unknown;
  durationMinutes?: unknown;
}

export interface SocialPostInput {
  title?: unknown;
  permalink?: unknown;
  explanations?: unknown;
}

export interface MemberStatusInput {
  active?: unknown;
}

export interface AnnouncementInput {
  title?: unknown;
  body?: unknown;
}

export interface PersonalWorkoutFeedbackInput {
  rating?: unknown;
  painAreas?: unknown;
  painIntensity?: unknown;
  note?: unknown;
}

export interface CoachWorkoutFeedbackInput {
  feedback?: unknown;
}

interface StudioClassRow {
  id: string;
  class_date: string;
  start_time: string;
  name: string;
  coach: string;
  location: string;
  capacity: number;
  duration_minutes: number | null;
  booked: number;
  reserved: boolean;
  attendees: { memberId: string; name: string; attended: boolean }[];
}

const SESSION_LIFETIME_HOURS = 12;
const DUMMY_SALT = '00000000000000000000000000000000';
const DUMMY_HASH = '0'.repeat(128);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AppService {
  constructor(private readonly database: DatabaseService) {}

  async getHealth() {
    await this.database.query('SELECT 1');
    return { status: 'ok' as const };
  }

  async getClasses(user: AuthenticatedUser) {
    const result = await this.database.query<StudioClassRow>(
      `SELECT c.id, c.class_date::text, c.start_time::text,
              c.name, c.coach, c.location, c.capacity,
              c.duration_minutes,
              count(r.user_id) FILTER (WHERE u.active OR r.attended_at IS NOT NULL)::int AS booked,
              coalesce(bool_or(r.user_id = $2), false) AS reserved,
              CASE WHEN $1::boolean THEN
                coalesce(
                  json_agg(json_build_object(
                    'memberId', r.user_id,
                    'name', u.name,
                    'attended', r.attended_at IS NOT NULL
                  )) FILTER (WHERE r.user_id IS NOT NULL AND u.active),
                  '[]'::json
                )
              ELSE '[]'::json END AS attendees
       FROM studio_classes c
       LEFT JOIN class_reservations r ON r.class_id = c.id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE c.cancelled = false
       GROUP BY c.id
       ORDER BY c.class_date, c.start_time`,
      [user.role === 'coach', user.id],
    );
    return result.rows.map((session) => ({
      id: session.id,
      dateIso: session.class_date,
      time: session.start_time.slice(0, 5),
      name: session.name,
      coach: session.coach,
      location: session.location,
      capacity: session.capacity,
      durationMinutes: session.duration_minutes ?? 0,
      booked: session.booked,
      reserved: session.reserved,
      attendees: session.attendees,
    }));
  }

  async createClass(input: StudioClassInput) {
    const classInput = validateStudioClassInput(input);
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO studio_classes
         (id, class_date, start_time, name, coach, location, capacity, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        randomUUID(),
        classInput.date,
        classInput.time,
        classInput.name,
        classInput.coach,
        classInput.location,
        classInput.capacity,
        classInput.durationMinutes || null,
      ],
    );
    return result.rows[0];
  }

  async updateClass(id: string, input: StudioClassInput) {
    validateUuid(id, 'Class id is invalid');
    const classInput = validateStudioClassInput(input);
    return this.database.transaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM studio_classes WHERE id = $1 AND cancelled = false FOR UPDATE',
        [id],
      );
      if (!existing.rowCount) {
        throw new NotFoundException('Class not found');
      }
      const bookings = await client.query<{ booked: number }>(
        'SELECT count(*)::int AS booked FROM class_reservations WHERE class_id = $1',
        [id],
      );
      if (classInput.capacity < bookings.rows[0].booked) {
        throw new ConflictException(
          'Capacity cannot be lower than the number of reservations',
        );
      }
      await client.query(
        `UPDATE studio_classes
         SET class_date = $2, start_time = $3, name = $4, coach = $5,
             location = $6, capacity = $7, duration_minutes = $8
         WHERE id = $1`,
        [
          id,
          classInput.date,
          classInput.time,
          classInput.name,
          classInput.coach,
          classInput.location,
          classInput.capacity,
          classInput.durationMinutes || null,
        ],
      );
      return { id };
    });
  }

  async cancelStudioClass(id: string) {
    validateUuid(id, 'Class id is invalid');
    const result = await this.database.query(
      `UPDATE studio_classes SET cancelled = true
       WHERE id = $1 AND cancelled = false
       RETURNING id`,
      [id],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Class not found');
    }
    return { id, status: 'cancelled' as const };
  }

  async reserveClass(id: string, user: AuthenticatedUser) {
    validateUuid(id, 'Class id is invalid');
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    try {
      return await this.database.transaction(async (client) => {
        const session = await client.query<{ capacity: number }>(
          `SELECT capacity FROM studio_classes
           WHERE id = $1 AND cancelled = false
             AND (class_date + start_time) > localtimestamp
           FOR UPDATE`,
          [id],
        );
        if (!session.rowCount) {
          throw new NotFoundException('Upcoming class not found');
        }
        const bookings = await client.query<{ booked: number }>(
          'SELECT count(*)::int AS booked FROM class_reservations WHERE class_id = $1',
          [id],
        );
        if (bookings.rows[0].booked >= session.rows[0].capacity) {
          throw new ConflictException('Class is full');
        }
        await client.query(
          'INSERT INTO class_reservations (class_id, user_id) VALUES ($1, $2)',
          [id, user.id],
        );
        return { id, status: 'reserved' as const };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('You already reserved this class');
      }
      throw error;
    }
  }

  async cancelReservation(id: string, user: AuthenticatedUser) {
    validateUuid(id, 'Class id is invalid');
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    const result = await this.database.query(
      `DELETE FROM class_reservations r
       USING studio_classes c
       WHERE r.class_id = c.id AND r.class_id = $1 AND r.user_id = $2
         AND r.attended_at IS NULL AND c.cancelled = false
         AND (c.class_date + c.start_time) > localtimestamp
       RETURNING r.class_id`,
      [id, user.id],
    );
    if (!result.rowCount) {
      throw new ConflictException('Reservation cannot be cancelled');
    }
    return { id, status: 'cancelled' as const };
  }

  async markClassAttendance(id: string, memberId: unknown) {
    validateUuid(id, 'Class id is invalid');
    if (typeof memberId !== 'string' || !UUID_PATTERN.test(memberId)) {
      throw new BadRequestException('Member id is invalid');
    }
    await this.database.transaction(async (client) => {
      const result = await client.query(
        `UPDATE class_reservations SET attended_at = now()
         WHERE class_id = $1 AND user_id = $2 AND attended_at IS NULL
         RETURNING class_id`,
        [id, memberId],
      );
      if (!result.rowCount) {
        const reservation = await client.query(
          'SELECT 1 FROM class_reservations WHERE class_id = $1 AND user_id = $2',
          [id, memberId],
        );
        if (reservation.rowCount) {
          throw new ConflictException('Attendance was already recorded');
        }
        throw new NotFoundException('Member has no reservation for this class');
      }
      await client.query(
        `INSERT INTO member_balances (user_id, purchased_sessions, used_sessions, attendance_count, points)
         VALUES ($1, 0, 0, 1, 10)
         ON CONFLICT (user_id) DO UPDATE
         SET attendance_count = member_balances.attendance_count + 1,
             points = member_balances.points + 10,
             used_sessions = least(member_balances.purchased_sessions, member_balances.used_sessions + 1)`,
        [memberId],
      );
    });
    return { classId: id, memberId, attended: true };
  }

  async getAnnouncements() {
    const result = await this.database.query<{
      id: string;
      title: string;
      body: string;
      created_at: Date;
    }>(
      `SELECT id, title, body, created_at
       FROM studio_announcements ORDER BY created_at DESC, id DESC`,
    );
    return result.rows.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.created_at.toISOString(),
    }));
  }

  async createAnnouncement(user: AuthenticatedUser, input: AnnouncementInput) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const body = typeof input?.body === 'string' ? input.body.trim() : '';
    if (
      title.length < 2 ||
      title.length > 120 ||
      body.length < 2 ||
      body.length > 4000
    ) {
      throw new BadRequestException(
        'Announcement details do not meet requirements',
      );
    }
    const result = await this.database.query<{ id: string; created_at: Date }>(
      `INSERT INTO studio_announcements (id, title, body, created_by)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [randomUUID(), title, body, user.id],
    );
    return {
      id: result.rows[0].id,
      title,
      body,
      createdAt: result.rows[0].created_at.toISOString(),
    };
  }

  async removeAnnouncement(id: string) {
    validateUuid(id, 'Announcement id is invalid');
    const result = await this.database.query(
      'DELETE FROM studio_announcements WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Announcement not found');
    }
    return { id, status: 'deleted' as const };
  }

  async getLatestSocialPost() {
    const result = await this.database.query<{
      id: string;
      title: string;
      permalink: string;
      explanations: string[];
      created_at: Date;
    }>(
      `SELECT id, title, permalink, explanations, created_at
       FROM studio_social_posts ORDER BY created_at DESC, id DESC LIMIT 1`,
    );
    const post = result.rows[0];
    return post
      ? {
          id: post.id,
          title: post.title,
          permalink: post.permalink,
          explanations: post.explanations,
          createdAt: post.created_at.toISOString(),
        }
      : null;
  }

  async createSocialPost(user: AuthenticatedUser, input: SocialPostInput) {
    const title = typeof input?.title === 'string' ? input.title.trim() : '';
    const permalink =
      typeof input?.permalink === 'string' ? input.permalink.trim() : '';
    const explanations = validateSocialPostExplanations(input?.explanations);
    const url = parseInstagramPostUrl(permalink);
    if (!title || title.length > 160 || !url || !explanations) {
      throw new BadRequestException(
        'Social post details do not meet requirements',
      );
    }
    const result = await this.database.query<{ id: string; created_at: Date }>(
      `INSERT INTO studio_social_posts (id, title, permalink, explanations, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [randomUUID(), title, url.toString(), explanations, user.id],
    );
    return {
      id: result.rows[0].id,
      title,
      permalink: url.toString(),
      explanations,
      createdAt: result.rows[0].created_at.toISOString(),
    };
  }

  async updateMemberStatus(memberId: string, input: MemberStatusInput) {
    validateUuid(memberId, 'Member id is invalid');
    if (typeof input?.active !== 'boolean') {
      throw new BadRequestException('Member status is invalid');
    }
    return this.database.transaction(async (client) => {
      const result = await client.query<{ id: string; active: boolean }>(
        `UPDATE users SET active = $2
         WHERE id = $1 AND role = 'member'
         RETURNING id, active`,
        [memberId, input.active],
      );
      if (!result.rowCount) {
        throw new NotFoundException('Member not found');
      }
      if (!input.active) {
        await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [
          memberId,
        ]);
        await client.query(
          `DELETE FROM class_reservations r
           USING studio_classes c
           WHERE r.class_id = c.id AND r.user_id = $1
             AND r.attended_at IS NULL
             AND (c.class_date + c.start_time) > localtimestamp`,
          [memberId],
        );
      }
      return { id: result.rows[0].id, active: result.rows[0].active };
    });
  }

  async getMemberWorkoutHistory(user: AuthenticatedUser) {
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    return this.queryWorkoutHistory(user.id);
  }

  async getStudioMemberWorkoutHistory(memberId: string) {
    validateUuid(memberId, 'Member id is invalid');
    const member = await this.database.query<{ id: string }>(
      "SELECT id FROM users WHERE id = $1 AND role = 'member'",
      [memberId],
    );
    if (!member.rowCount) {
      throw new NotFoundException('Member not found');
    }
    return this.queryWorkoutHistory(memberId);
  }

  async savePersonalWorkoutFeedback(
    user: AuthenticatedUser,
    classId: string,
    input: PersonalWorkoutFeedbackInput,
  ) {
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    validateUuid(classId, 'Class id is invalid');
    const feedback = validatePersonalWorkoutFeedback(input);
    const attended = await this.database.query(
      `SELECT 1 FROM class_reservations
       WHERE class_id = $1 AND user_id = $2 AND attended_at IS NOT NULL`,
      [classId, user.id],
    );
    if (!attended.rowCount) {
      throw new NotFoundException('Attended workout not found');
    }
    await this.database.query(
      `INSERT INTO workout_feedback
         (class_id, user_id, member_rating, pain_areas, pain_intensity, member_note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (class_id, user_id) DO UPDATE
       SET member_rating = EXCLUDED.member_rating,
           pain_areas = EXCLUDED.pain_areas,
           pain_intensity = EXCLUDED.pain_intensity,
           member_note = EXCLUDED.member_note,
           updated_at = now()`,
      [
        classId,
        user.id,
        feedback.rating,
        feedback.painAreas,
        feedback.painIntensity,
        feedback.note,
      ],
    );
    return { classId, ...feedback };
  }

  async markWorkoutRead(user: AuthenticatedUser, classId: string) {
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    validateUuid(classId, 'Class id is invalid');
    const result = await this.database.query(
      `INSERT INTO workout_read_states (class_id, user_id)
       SELECT r.class_id, r.user_id
       FROM class_reservations r
       WHERE r.class_id = $1 AND r.user_id = $2 AND r.attended_at IS NOT NULL
       ON CONFLICT (class_id, user_id) DO NOTHING
       RETURNING class_id`,
      [classId, user.id],
    );
    if (!result.rowCount) {
      const existing = await this.database.query(
        `SELECT 1 FROM workout_read_states
         WHERE class_id = $1 AND user_id = $2`,
        [classId, user.id],
      );
      if (!existing.rowCount) {
        throw new NotFoundException('Attended workout not found');
      }
    }
    return { classId, read: true };
  }

  async saveCoachWorkoutFeedback(
    memberId: string,
    classId: string,
    input: CoachWorkoutFeedbackInput,
  ) {
    validateUuid(memberId, 'Member id is invalid');
    validateUuid(classId, 'Class id is invalid');
    const feedback =
      typeof input?.feedback === 'string' ? input.feedback.trim() : '';
    if (!feedback || feedback.length > 2000) {
      throw new BadRequestException(
        'Workout feedback must contain 1 to 2000 characters',
      );
    }
    const attended = await this.database.query(
      `SELECT 1 FROM class_reservations
       WHERE class_id = $1 AND user_id = $2 AND attended_at IS NOT NULL`,
      [classId, memberId],
    );
    if (!attended.rowCount) {
      throw new NotFoundException('Attended workout not found');
    }
    await this.database.query(
      `INSERT INTO workout_feedback (class_id, user_id, coach_feedback)
       VALUES ($1, $2, $3)
       ON CONFLICT (class_id, user_id) DO UPDATE
       SET coach_feedback = EXCLUDED.coach_feedback, updated_at = now()`,
      [classId, memberId, feedback],
    );
    return { classId, memberId, feedback };
  }

  private async queryWorkoutHistory(memberId: string) {
    const result = await this.database.query<{
      class_id: string;
      user_id: string;
      member_name: string;
      class_name: string;
      class_date: string;
      start_time: string;
      coach: string;
      attended_at: Date;
      coach_feedback: string | null;
      member_rating: number | null;
      pain_areas: string[];
      pain_intensity: 'mild' | 'moderate' | 'strong' | null;
      member_note: string;
      feedback_updated_at: Date | null;
      is_read: boolean;
      duration_minutes: number | null;
    }>(
      `SELECT c.id AS class_id, r.user_id, u.name AS member_name, c.name AS class_name,
              c.class_date::text AS class_date, c.start_time::text AS start_time, c.coach,
              c.duration_minutes,
              r.attended_at, f.coach_feedback, f.member_rating, f.pain_areas,
              f.pain_intensity, f.member_note, f.updated_at AS feedback_updated_at,
              (rs.read_at IS NOT NULL) AS is_read
       FROM class_reservations r
       JOIN studio_classes c ON c.id = r.class_id
       JOIN users u ON u.id = r.user_id
       LEFT JOIN workout_feedback f ON f.class_id = r.class_id AND f.user_id = r.user_id
       LEFT JOIN workout_read_states rs ON rs.class_id = r.class_id AND rs.user_id = r.user_id
       WHERE r.user_id = $1 AND r.attended_at IS NOT NULL
       ORDER BY r.attended_at DESC, c.id DESC`,
      [memberId],
    );
    return result.rows.map((item) => ({
      classId: item.class_id,
      memberId: item.user_id,
      memberName: item.member_name,
      name: item.class_name,
      dateIso: item.class_date,
      time: item.start_time.slice(0, 5),
      coach: item.coach,
      durationMinutes: item.duration_minutes ?? 0,
      isRead: item.is_read,
      attendedAt: item.attended_at.toISOString(),
      coachFeedback: item.coach_feedback ?? '',
      personalFeedback:
        item.member_rating === null
          ? null
          : {
              rating: item.member_rating,
              painAreas: item.pain_areas,
              painIntensity: item.pain_intensity,
              note: item.member_note,
              savedAt: (
                item.feedback_updated_at ?? item.attended_at
              ).toISOString(),
            },
    }));
  }

  async getStudioFinance() {
    const [settings, packages, members, discounts, payments] =
      await Promise.all([
        this.database.query<{ single_class_price: string }>(
          'SELECT single_class_price::text FROM studio_settings WHERE id = true',
        ),
        this.database.query<{
          id: string;
          name: string;
          sessions: number;
          price: string;
        }>(
          `SELECT id, name, sessions, price::text
         FROM training_packages WHERE active = true ORDER BY created_at, name`,
        ),
        this.database.query<{
          id: string;
          name: string;
          email: string;
          username: string;
          phone: string | null;
          birth_date: string | null;
          address: 'feminine' | 'masculine' | 'neutral' | null;
          training_since: string;
          created_at: Date;
          active: boolean;
          purchased_sessions: number;
          used_sessions: number;
          attendance_count: number;
          points: number;
        }>(
          `SELECT u.id, u.name, u.email, u.username, u.phone,
                u.birth_date::text, u.address, u.training_since::text,
                u.created_at, u.active,
                coalesce(b.purchased_sessions, 0)::int AS purchased_sessions,
                coalesce(b.used_sessions, 0)::int AS used_sessions,
                coalesce(b.attendance_count, 0)::int AS attendance_count,
                coalesce(b.points, 0)::int AS points
         FROM users u
         LEFT JOIN member_balances b ON b.user_id = u.id
         WHERE u.role = 'member'
         ORDER BY u.created_at DESC`,
        ),
        this.database.query<{
          user_id: string;
          kind: DiscountKind;
          value: string;
          note: string;
        }>(
          `SELECT user_id, kind, value::text, note
         FROM member_discounts ORDER BY updated_at DESC`,
        ),
        this.database.query<{
          id: string;
          user_id: string;
          member_name: string;
          package_name: string;
          sessions_purchased: number;
          gross_amount: string;
          discount_amount: string;
          paid_amount: string;
          method: PaymentMethod;
          recorded_at: Date;
        }>(
          `SELECT id, user_id, member_name, package_name, sessions_purchased,
                gross_amount::text, discount_amount::text, paid_amount::text,
                method, recorded_at
         FROM manual_payments ORDER BY recorded_at DESC`,
        ),
      ]);
    return {
      singleClassPrice: Number(settings.rows[0]?.single_class_price ?? 75),
      packages: packages.rows.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
      members: members.rows.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        username: member.username,
        phone: member.phone,
        birthDate: member.birth_date,
        address: member.address,
        trainingSince: member.training_since,
        joined: member.created_at.toISOString(),
        status: member.active ? ('active' as const) : ('deactivated' as const),
        purchasedSessions: member.purchased_sessions,
        usedSessions: member.used_sessions,
        attendance: member.attendance_count,
        points: member.points,
      })),
      discounts: discounts.rows.map((item) => ({
        memberId: item.user_id,
        kind: item.kind,
        value: Number(item.value),
        note: item.note,
      })),
      payments: payments.rows.map((item) => ({
        id: item.id,
        memberId: item.user_id,
        memberName: item.member_name,
        packageName: item.package_name,
        sessions: item.sessions_purchased,
        grossAmount: Number(item.gross_amount),
        discountAmount: Number(item.discount_amount),
        paidAmount: Number(item.paid_amount),
        method: item.method,
        date: item.recorded_at.toISOString(),
      })),
    };
  }

  async getMemberFinance(user: AuthenticatedUser) {
    if (user.role !== 'member') {
      throw new ForbiddenException('Member access required');
    }
    const [settings, packages, balance, payments] = await Promise.all([
      this.database.query<{ single_class_price: string }>(
        'SELECT single_class_price::text FROM studio_settings WHERE id = true',
      ),
      this.database.query<{
        id: string;
        name: string;
        sessions: number;
        price: string;
      }>(
        `SELECT id, name, sessions, price::text
         FROM training_packages WHERE active = true ORDER BY created_at, name`,
      ),
      this.database.query<{
        purchased_sessions: number;
        used_sessions: number;
        attendance_count: number;
        points: number;
      }>(
        `SELECT purchased_sessions, used_sessions, attendance_count, points
         FROM member_balances WHERE user_id = $1`,
        [user.id],
      ),
      this.database.query<{
        id: string;
        package_name: string;
        sessions_purchased: number;
        gross_amount: string;
        discount_amount: string;
        paid_amount: string;
        method: PaymentMethod;
        recorded_at: Date;
      }>(
        `SELECT id, package_name, sessions_purchased, gross_amount::text,
                discount_amount::text, paid_amount::text, method, recorded_at
         FROM manual_payments WHERE user_id = $1 ORDER BY recorded_at DESC`,
        [user.id],
      ),
    ]);
    const currentBalance = balance.rows[0];
    return {
      singleClassPrice: Number(settings.rows[0]?.single_class_price ?? 75),
      packages: packages.rows.map((item) => ({
        ...item,
        price: Number(item.price),
      })),
      balance: {
        purchasedSessions: currentBalance?.purchased_sessions ?? 0,
        usedSessions: currentBalance?.used_sessions ?? 0,
        attendance: currentBalance?.attendance_count ?? 0,
        points: currentBalance?.points ?? 0,
      },
      payments: payments.rows.map((item) => ({
        id: item.id,
        packageName: item.package_name,
        sessions: item.sessions_purchased,
        grossAmount: Number(item.gross_amount),
        discountAmount: Number(item.discount_amount),
        paidAmount: Number(item.paid_amount),
        method: item.method,
        date: item.recorded_at.toISOString(),
      })),
    };
  }

  async updateSingleClassPrice(input: SingleClassPriceInput) {
    const price = validateMoney(input?.price, 'Class price');
    await this.database.query(
      `INSERT INTO studio_settings (id, single_class_price)
       VALUES (true, $1)
       ON CONFLICT (id) DO UPDATE SET single_class_price = EXCLUDED.single_class_price`,
      [formatMoney(price)],
    );
    return { price: price / 100 };
  }

  async createTrainingPackage(input: TrainingPackageInput) {
    const packageInput = validateTrainingPackage(input);
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO training_packages (id, name, sessions, price)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        randomUUID(),
        packageInput.name,
        packageInput.sessions,
        formatMoney(packageInput.price),
      ],
    );
    return {
      ...packageInput,
      price: packageInput.price / 100,
      id: result.rows[0].id,
    };
  }

  async updateTrainingPackage(id: string, input: TrainingPackageInput) {
    validateUuid(id, 'Package id is invalid');
    const packageInput = validateTrainingPackage(input);
    const result = await this.database.query(
      `UPDATE training_packages SET name = $2, sessions = $3, price = $4
       WHERE id = $1 AND active = true RETURNING id`,
      [
        id,
        packageInput.name,
        packageInput.sessions,
        formatMoney(packageInput.price),
      ],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Package not found');
    }
    return { id, ...packageInput, price: packageInput.price / 100 };
  }

  async deleteTrainingPackage(id: string) {
    validateUuid(id, 'Package id is invalid');
    const result = await this.database.query(
      `UPDATE training_packages SET active = false
       WHERE id = $1 AND active = true RETURNING id`,
      [id],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Package not found');
    }
    return { id, status: 'deleted' as const };
  }

  async setMemberDiscount(memberId: string, input: MemberDiscountInput) {
    validateUuid(memberId, 'Member id is invalid');
    const kind = input?.kind;
    const value = validateMoney(input?.value, 'Discount');
    const note = typeof input?.note === 'string' ? input.note.trim() : '';
    if (
      (kind !== 'percent' && kind !== 'amount') ||
      (kind === 'percent' && value > 10000) ||
      note.length > 500
    ) {
      throw new BadRequestException(
        'Discount details do not meet requirements',
      );
    }
    const result = await this.database.query(
      `INSERT INTO member_discounts (user_id, kind, value, note)
       SELECT id, $2, $3, $4 FROM users WHERE id = $1 AND role = 'member'
       ON CONFLICT (user_id) DO UPDATE
       SET kind = EXCLUDED.kind, value = EXCLUDED.value, note = EXCLUDED.note,
           updated_at = now()
       RETURNING user_id`,
      [memberId, kind, formatMoney(value), note],
    );
    if (!result.rowCount) {
      throw new NotFoundException('Member not found');
    }
    return { memberId, kind, value: value / 100, note };
  }

  async removeMemberDiscount(memberId: string) {
    validateUuid(memberId, 'Member id is invalid');
    await this.database.query(
      'DELETE FROM member_discounts WHERE user_id = $1',
      [memberId],
    );
    return { memberId, status: 'removed' as const };
  }

  async recordManualPayment(input: ManualPaymentInput) {
    const memberId = typeof input?.memberId === 'string' ? input.memberId : '';
    validateUuid(memberId, 'Member id is invalid');
    const packageId =
      input?.packageId === 0 || input?.packageId === '0'
        ? null
        : typeof input?.packageId === 'string'
          ? input.packageId
          : '';
    if (packageId !== null) {
      validateUuid(packageId, 'Package id is invalid');
    }
    const packageCount = input?.packageCount;
    const method = input?.method;
    if (
      typeof packageCount !== 'number' ||
      !Number.isInteger(packageCount) ||
      packageCount < 1 ||
      packageCount > 100 ||
      (method !== 'cash' && method !== 'bit' && method !== 'paybox')
    ) {
      throw new BadRequestException('Payment details do not meet requirements');
    }
    return this.database.transaction(async (client) => {
      const memberResult = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM users WHERE id = $1 AND role = 'member' FOR UPDATE`,
        [memberId],
      );
      const member = memberResult.rows[0];
      if (!member) {
        throw new NotFoundException('Member not found');
      }
      let packageName = 'אימון בודד';
      let sessionsPerPackage = 1;
      let pricePerPackage: number;
      if (packageId === null) {
        const settings = await client.query<{ price: string }>(
          'SELECT single_class_price::text AS price FROM studio_settings WHERE id = true',
        );
        pricePerPackage = Math.round(
          Number(settings.rows[0]?.price ?? 75) * 100,
        );
      } else {
        const packageResult = await client.query<{
          name: string;
          sessions: number;
          price: string;
        }>(
          `SELECT name, sessions, price::text FROM training_packages
           WHERE id = $1 AND active = true FOR SHARE`,
          [packageId],
        );
        if (!packageResult.rowCount) {
          throw new NotFoundException('Package not found');
        }
        packageName = packageResult.rows[0].name;
        sessionsPerPackage = packageResult.rows[0].sessions;
        pricePerPackage = Math.round(Number(packageResult.rows[0].price) * 100);
      }
      const discountResult = await client.query<{
        kind: DiscountKind;
        value: string;
      }>('SELECT kind, value::text FROM member_discounts WHERE user_id = $1', [
        memberId,
      ]);
      const gross = pricePerPackage * packageCount;
      if (!Number.isSafeInteger(gross) || gross > 99_999_999_999) {
        throw new BadRequestException(
          'Payment amount exceeds the supported limit',
        );
      }
      const discount = discountResult.rows[0];
      const discountAmount = discount
        ? Math.min(
            discount.kind === 'percent'
              ? Math.round((gross * Number(discount.value)) / 100)
              : Math.round(Number(discount.value) * 100) * packageCount,
            gross,
          )
        : 0;
      const sessions = sessionsPerPackage * packageCount;
      const inserted = await client.query<{ id: string; recorded_at: Date }>(
        `INSERT INTO manual_payments
          (id, user_id, package_id, member_name, package_name, package_count,
           sessions_purchased, gross_amount, discount_amount, paid_amount, method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, recorded_at`,
        [
          randomUUID(),
          memberId,
          packageId,
          member.name,
          packageName,
          packageCount,
          sessions,
          formatMoney(gross),
          formatMoney(discountAmount),
          formatMoney(gross - discountAmount),
          method,
        ],
      );
      await client.query(
        `INSERT INTO member_balances (user_id, purchased_sessions)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET purchased_sessions = member_balances.purchased_sessions + EXCLUDED.purchased_sessions`,
        [memberId, sessions],
      );
      return {
        id: inserted.rows[0].id,
        memberId,
        memberName: member.name,
        packageName,
        sessions,
        grossAmount: gross / 100,
        discountAmount: discountAmount / 100,
        paidAmount: (gross - discountAmount) / 100,
        method,
        date: inserted.rows[0].recorded_at.toISOString(),
      };
    });
  }

  async getJoinRequests() {
    const result = await this.database.query<{
      id: string;
      name: string;
      email: string;
      status: 'pending' | 'approved';
      created_at: Date;
      invitation_expires_at: Date | null;
    }>(
      `SELECT id, name, email, status, created_at, invitation_expires_at
       FROM join_requests
       WHERE status IN ('pending', 'approved')
       ORDER BY created_at DESC`,
    );
    return result.rows.map((request) => ({
      id: request.id,
      name: request.name,
      email: request.email,
      status: request.status,
      createdAt: request.created_at.toISOString(),
      ...(request.status === 'approved' && request.invitation_expires_at
        ? { invitationExpiresAt: request.invitation_expires_at.getTime() }
        : {}),
    }));
  }

  async createJoinRequest(input: JoinRequestInput) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const email =
      typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (
      name.length < 2 ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new BadRequestException('A valid name and email are required');
    }

    try {
      const existingUser = await this.database.query(
        'SELECT 1 FROM users WHERE lower(email) = $1',
        [email],
      );
      if (existingUser.rowCount) {
        throw new ConflictException(
          'A join request or account already exists for this email',
        );
      }
      const result = await this.database.query<{
        id: string;
        created_at: Date;
      }>(
        `INSERT INTO join_requests (id, name, email, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, created_at`,
        [randomUUID(), name, email],
      );
      const request = result.rows[0];
      return {
        id: request.id,
        name,
        email,
        status: 'pending' as const,
        createdAt: request.created_at.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A join request or account already exists for this email',
        );
      }
      throw error;
    }
  }

  async deleteJoinRequest(id: string) {
    validateUuid(id, 'Join request id is invalid');
    const result = await this.database.query(
      `DELETE FROM join_requests
       WHERE id = $1 AND status IN ('pending', 'approved')
       RETURNING id`,
      [id],
    );
    if (!result.rowCount) {
      const existing = await this.database.query<{ status: string }>(
        'SELECT status FROM join_requests WHERE id = $1',
        [id],
      );
      if (!existing.rowCount) {
        throw new NotFoundException('Join request not found');
      }
      throw new ConflictException(
        'An activated account must be deactivated instead',
      );
    }
    return { id, status: 'deleted' as const };
  }

  async approveJoinRequest(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('Join request id is invalid');
    }
    const invitationToken = randomBytes(32).toString('base64url');
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const result = await this.database.query<{ id: string }>(
      `UPDATE join_requests
       SET status = 'approved', invitation_token_hash = $2, invitation_expires_at = $3
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id, hashToken(invitationToken), invitationExpiresAt],
    );
    if (!result.rowCount) {
      const existing = await this.database.query<{ status: string }>(
        'SELECT status FROM join_requests WHERE id = $1',
        [id],
      );
      if (!existing.rowCount) {
        throw new NotFoundException('Join request not found');
      }
      throw new ConflictException('Join request is not pending');
    }
    return {
      id,
      status: 'approved' as const,
      invitationToken,
      invitationExpiresAt: invitationExpiresAt.getTime(),
    };
  }

  async renewInvitation(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new BadRequestException('Join request id is invalid');
    }
    const invitationToken = randomBytes(32).toString('base64url');
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const result = await this.database.query(
      `UPDATE join_requests
       SET invitation_token_hash = $2, invitation_expires_at = $3
       WHERE id = $1 AND status = 'approved'
       RETURNING id`,
      [id, hashToken(invitationToken), invitationExpiresAt],
    );
    if (!result.rowCount) {
      const existing = await this.database.query<{ status: string }>(
        'SELECT status FROM join_requests WHERE id = $1',
        [id],
      );
      if (!existing.rowCount) {
        throw new NotFoundException('Join request not found');
      }
      throw new ConflictException('Join request is not awaiting activation');
    }
    return {
      id,
      invitationToken,
      invitationExpiresAt: invitationExpiresAt.getTime(),
    };
  }

  async activateInvitation(input: AccountInput) {
    const token = typeof input?.token === 'string' ? input.token : '';
    const email =
      typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const username =
      typeof input?.username === 'string'
        ? input.username.trim().toLowerCase()
        : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[a-z0-9._-]{3,32}$/.test(username) ||
      password.length < 12 ||
      password.length > 128
    ) {
      throw new BadRequestException(
        'Email, username, or password do not meet requirements',
      );
    }
    if (!token || token.length > 128) {
      throw new BadRequestException('Invitation is invalid or expired');
    }

    const { salt, hash } = await hashPassword(password);
    const sessionToken = createSessionToken();
    try {
      return await this.database.transaction(async (client) => {
        const request = await client.query<{
          id: string;
          name: string;
          email: string;
          status: string;
          invitation_expires_at: Date | null;
        }>(
          `SELECT id, name, email, status, invitation_expires_at
           FROM join_requests
           WHERE invitation_token_hash = $1
           FOR UPDATE`,
          [hashToken(token)],
        );
        const invitation = request.rows[0];
        if (
          !invitation ||
          invitation.status !== 'approved' ||
          !invitation.invitation_expires_at ||
          invitation.invitation_expires_at.getTime() <= Date.now() ||
          invitation.email.toLowerCase() !== email
        ) {
          throw new BadRequestException(
            'Invitation is invalid, expired, or does not match this email',
          );
        }

        const user = await client.query<AuthenticatedUser>(
          `INSERT INTO users (id, name, email, username, role, password_salt, password_hash)
           VALUES ($1, $2, $3, $4, 'member', $5, $6)
           RETURNING id, name, email, username, role, phone,
                     birth_date::text AS "birthDate", address,
                     training_since::text AS "trainingSince",
                     reminder_enabled AS "reminderEnabled",
                     reminder_lead_minutes AS "reminderLeadMinutes",
                     updates_enabled AS "updatesEnabled"`,
          [
            randomUUID(),
            invitation.name,
            invitation.email,
            username,
            salt,
            hash,
          ],
        );
        await client.query(
          `UPDATE join_requests
           SET status = 'active', invitation_token_hash = NULL, invitation_expires_at = NULL, user_id = $2
           WHERE id = $1`,
          [invitation.id, user.rows[0].id],
        );
        await client.query(
          `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
           VALUES ($1, $2, now() + ($3 * interval '1 hour'))`,
          [hashToken(sessionToken), user.rows[0].id, SESSION_LIFETIME_HOURS],
        );
        return { user: publicUser(user.rows[0]), sessionToken };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email or username is already in use');
      }
      throw error;
    }
  }

  async login(
    input: LoginInput,
  ): Promise<{ user: AuthenticatedUser; sessionToken: string }> {
    const identifier =
      typeof input?.identifier === 'string'
        ? input.identifier.trim().toLowerCase()
        : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    const result =
      identifier && password.length <= 128
        ? await this.database.query<UserRecord>(
            `SELECT id, name, email, username, role, password_salt, password_hash,
                    phone, birth_date::text AS "birthDate", address,
                    training_since::text AS "trainingSince",
                    reminder_enabled AS "reminderEnabled",
                    reminder_lead_minutes AS "reminderLeadMinutes",
                    updates_enabled AS "updatesEnabled"
           FROM users
           WHERE active = true AND (lower(username) = $1 OR lower(email) = $1)
           LIMIT 1`,
            [identifier],
          )
        : { rows: [], rowCount: 0 };
    const user = result.rows[0];
    const passwordIsValid = await verifyPassword(
      password,
      user?.password_salt ?? DUMMY_SALT,
      user?.password_hash ?? DUMMY_HASH,
    );
    if (!user || !passwordIsValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const sessionToken = createSessionToken();
    await this.database.query(
      `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 hour'))`,
      [hashToken(sessionToken), user.id, SESSION_LIFETIME_HOURS],
    );
    return { user: publicUser(user), sessionToken };
  }

  async getSessionUser(token: string): Promise<AuthenticatedUser | null> {
    const result = await this.database.query<AuthenticatedUser>(
      `SELECT u.id, u.name, u.email, u.username, u.role,
              u.phone, u.birth_date::text AS "birthDate", u.address,
              u.training_since::text AS "trainingSince",
              u.reminder_enabled AS "reminderEnabled",
              u.reminder_lead_minutes AS "reminderLeadMinutes",
              u.updates_enabled AS "updatesEnabled"
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
      [hashToken(token)],
    );
    return result.rows[0] ?? null;
  }

  async updateProfile(user: AuthenticatedUser, input: ProfileInput) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const email =
      typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const phone = typeof input?.phone === 'string' ? input.phone.trim() : '';
    const birthDate =
      typeof input?.birthDate === 'string' && input.birthDate
        ? input.birthDate
        : null;
    const address =
      input?.address === 'feminine' ||
      input?.address === 'masculine' ||
      input?.address === 'neutral'
        ? input.address
        : null;
    const trainingSince =
      typeof input?.trainingSince === 'string' && input.trainingSince
        ? input.trainingSince
        : null;
    const reminderEnabled = input?.reminderEnabled;
    const reminderLeadMinutes = input?.reminderLeadMinutes;
    const updatesEnabled = input?.updatesEnabled;
    if (
      name.length < 2 ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length > 30 ||
      (phone !== '' && !/^[+()\d\s.-]{7,30}$/.test(phone)) ||
      (birthDate !== null && !isValidDate(birthDate)) ||
      (trainingSince !== null && !isValidDate(trainingSince)) ||
      (trainingSince !== null &&
        trainingSince > new Date().toISOString().slice(0, 10)) ||
      !address ||
      typeof reminderEnabled !== 'boolean' ||
      ![15, 30, 60, 90, 120].includes(Number(reminderLeadMinutes)) ||
      typeof updatesEnabled !== 'boolean'
    ) {
      throw new BadRequestException('Profile details do not meet requirements');
    }
    try {
      const result = await this.database.query<AuthenticatedUser>(
        `UPDATE users
         SET name = $2, email = $3, phone = $4, birth_date = $5, address = $6,
             reminder_enabled = $7, reminder_lead_minutes = $8, updates_enabled = $9,
             training_since = coalesce($10::date, training_since)
         WHERE id = $1
         RETURNING id, name, email, username, role, phone,
                   birth_date::text AS "birthDate", address,
                   training_since::text AS "trainingSince",
                   reminder_enabled AS "reminderEnabled",
                   reminder_lead_minutes AS "reminderLeadMinutes",
                   updates_enabled AS "updatesEnabled"`,
        [
          user.id,
          name,
          email,
          phone || null,
          birthDate,
          address,
          reminderEnabled,
          Number(reminderLeadMinutes),
          updatesEnabled,
          trainingSince,
        ],
      );
      if (!result.rowCount) {
        throw new UnauthorizedException('Account is no longer available');
      }
      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Email address is already in use');
      }
      throw error;
    }
  }

  async logout(token?: string): Promise<void> {
    if (token) {
      await this.database.query(
        'DELETE FROM auth_sessions WHERE token_hash = $1',
        [hashToken(token)],
      );
    }
  }
}

function publicUser(
  user: AuthenticatedUser,
): AuthenticatedUser & { status: 'active' } {
  return { ...user, status: 'active' };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function validateStudioClassInput(input: StudioClassInput) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const coach = typeof input?.coach === 'string' ? input.coach.trim() : '';
  const location =
    typeof input?.location === 'string' ? input.location.trim() : '';
  const date = typeof input?.date === 'string' ? input.date : '';
  const time = typeof input?.time === 'string' ? input.time : '';
  const capacity = input?.capacity;
  const durationMinutes = input?.durationMinutes ?? 0;
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00.000Z`)) &&
    new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
  if (
    name.length < 2 ||
    name.length > 100 ||
    coach.length < 2 ||
    coach.length > 100 ||
    location.length < 2 ||
    location.length > 100 ||
    !validDate ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    typeof capacity !== 'number' ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 200 ||
    typeof durationMinutes !== 'number' ||
    !Number.isInteger(durationMinutes) ||
    (durationMinutes !== 0 && (durationMinutes < 15 || durationMinutes > 240))
  ) {
    throw new BadRequestException('Class details do not meet requirements');
  }
  return { name, coach, location, date, time, capacity, durationMinutes };
}

function validateUuid(value: string, message: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(message);
  }
}

function validateSocialPostExplanations(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 20) {
    return null;
  }
  const explanations: string[] = [];
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      item.trim().length < 1 ||
      item.trim().length > 500
    ) {
      return null;
    }
    explanations.push(item.trim());
  }
  return explanations;
}

function parseInstagramPostUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !['instagram.com', 'www.instagram.com'].includes(
        url.hostname.toLowerCase(),
      ) ||
      url.username ||
      url.password ||
      url.port ||
      !/^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function validatePersonalWorkoutFeedback(input: PersonalWorkoutFeedbackInput) {
  const rating = input?.rating;
  const areas = input?.painAreas;
  const painIntensity = input?.painIntensity;
  const note = typeof input?.note === 'string' ? input.note.trim() : '';
  if (
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    !Array.isArray(areas) ||
    areas.length > 10 ||
    note.length > 2000 ||
    (areas.length === 0 &&
      painIntensity !== null &&
      painIntensity !== undefined) ||
    (areas.length > 0 &&
      painIntensity !== 'mild' &&
      painIntensity !== 'moderate' &&
      painIntensity !== 'strong')
  ) {
    throw new BadRequestException(
      'Workout feedback does not meet requirements',
    );
  }
  const painAreas: string[] = [];
  for (const area of areas) {
    if (
      typeof area !== 'string' ||
      area.trim().length < 1 ||
      area.trim().length > 80
    ) {
      throw new BadRequestException(
        'Workout feedback does not meet requirements',
      );
    }
    painAreas.push(area.trim());
  }
  return {
    rating,
    painAreas,
    painIntensity:
      painIntensity === 'mild' ||
      painIntensity === 'moderate' ||
      painIntensity === 'strong'
        ? painIntensity
        : null,
    note,
  };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validateMoney(value: unknown, label: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 999_999_999.99
  ) {
    throw new BadRequestException(`${label} must be a positive amount`);
  }
  return Math.round(value * 100);
}

function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function validateTrainingPackage(input: TrainingPackageInput) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const sessions = input?.sessions;
  if (
    name.length < 2 ||
    name.length > 100 ||
    typeof sessions !== 'number' ||
    !Number.isInteger(sessions) ||
    sessions < 1 ||
    sessions > 1000
  ) {
    throw new BadRequestException('Package details do not meet requirements');
  }
  const price = validateMoney(input?.price, 'Package price');
  return { name, sessions, price };
}
