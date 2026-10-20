import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';
import { DatabaseService } from './../src/database.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const appService = {
    getHealth: jest.fn().mockResolvedValue({ status: 'ok' }),
    getClasses: jest
      .fn()
      .mockResolvedValue([
        { id: 'class-1' },
        { id: 'class-2' },
        { id: 'class-3' },
      ]),
    createClass: jest.fn().mockResolvedValue({ id: 'class-1' }),
    updateClass: jest.fn().mockResolvedValue({ id: 'class-1' }),
    cancelStudioClass: jest
      .fn()
      .mockResolvedValue({ id: 'class-1', status: 'cancelled' }),
    reserveClass: jest
      .fn()
      .mockResolvedValue({ id: 'class-1', status: 'reserved' }),
    cancelReservation: jest
      .fn()
      .mockResolvedValue({ id: 'class-1', status: 'cancelled' }),
    markClassAttendance: jest.fn().mockResolvedValue({
      classId: 'class-1',
      memberId: 'member-1',
      attended: true,
    }),
    getAnnouncements: jest.fn().mockResolvedValue([]),
    createAnnouncement: jest.fn().mockResolvedValue({ id: 'announcement-1' }),
    removeAnnouncement: jest
      .fn()
      .mockResolvedValue({ id: 'announcement-1', status: 'deleted' }),
    getMemberWorkoutHistory: jest.fn().mockResolvedValue([]),
    markWorkoutRead: jest
      .fn()
      .mockResolvedValue({ classId: 'class-1', read: true }),
    savePersonalWorkoutFeedback: jest
      .fn()
      .mockResolvedValue({ classId: 'class-1' }),
    getStudioMemberWorkoutHistory: jest.fn().mockResolvedValue([]),
    saveCoachWorkoutFeedback: jest
      .fn()
      .mockResolvedValue({ classId: 'class-1' }),
    getLatestSocialPost: jest.fn().mockResolvedValue(null),
    createSocialPost: jest.fn().mockResolvedValue({ id: 'social-post-1' }),
    updateMemberStatus: jest
      .fn()
      .mockResolvedValue({ id: 'member-1', active: false }),
    deleteJoinRequest: jest
      .fn()
      .mockResolvedValue({ id: 'request-1', status: 'deleted' }),
    createJoinRequest: jest.fn().mockResolvedValue({
      id: 'request-1',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      status: 'pending',
    }),
    getJoinRequests: jest
      .fn()
      .mockResolvedValue([{ id: 'request-1', status: 'pending' }]),
    approveJoinRequest: jest.fn().mockResolvedValue({
      id: 'request-1',
      status: 'approved',
      invitationToken: 'one-time-token',
    }),
    activateInvitation: jest.fn().mockResolvedValue({
      user: {
        id: 'member-1',
        name: 'Tamar Levi',
        email: 'tamar@example.com',
        username: 'tamar.levy',
        role: 'member',
        status: 'active',
      },
      sessionToken: 'member-session',
    }),
    login: jest.fn().mockResolvedValue({
      user: {
        id: 'coach-1',
        name: 'YOCA Coach',
        email: 'coach@example.com',
        username: 'coach',
        role: 'coach',
        status: 'active',
      },
      sessionToken: 'coach-session',
    }),
    getSessionUser: jest.fn((token: string) => {
      if (token === 'coach-session') {
        return {
          id: 'coach-1',
          name: 'YOCA Coach',
          email: 'coach@example.com',
          username: 'coach',
          role: 'coach',
        };
      }
      if (token === 'member-session') {
        return {
          id: 'member-1',
          name: 'Tamar Levi',
          email: 'tamar@example.com',
          username: 'tamar.levy',
          role: 'member',
        };
      }
      return null;
    }),
    logout: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue({
      id: 'member-1',
      name: 'Tamar Levy',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member',
      phone: '050-123-4567',
      birthDate: '1994-06-18',
      address: 'neutral',
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      updatesEnabled: false,
    }),
    getStudioFinance: jest.fn().mockResolvedValue({
      singleClassPrice: 75,
      packages: [],
      members: [],
      discounts: [],
      payments: [],
    }),
    updateSingleClassPrice: jest.fn().mockResolvedValue({ price: 90 }),
    createTrainingPackage: jest.fn().mockResolvedValue({ id: 'package-1' }),
    updateTrainingPackage: jest.fn().mockResolvedValue({ id: 'package-1' }),
    deleteTrainingPackage: jest
      .fn()
      .mockResolvedValue({ id: 'package-1', status: 'deleted' }),
    setMemberDiscount: jest.fn().mockResolvedValue({ memberId: 'member-1' }),
    removeMemberDiscount: jest
      .fn()
      .mockResolvedValue({ memberId: 'member-1', status: 'removed' }),
    recordManualPayment: jest.fn().mockResolvedValue({
      id: 'payment-1',
      sessions: 10,
      paidAmount: 650,
    }),
    getMemberFinance: jest.fn().mockResolvedValue({
      singleClassPrice: 75,
      packages: [],
      balance: {
        purchasedSessions: 10,
        usedSessions: 2,
        attendance: 2,
        points: 20,
      },
      payments: [],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue(appService)
      .overrideProvider(DatabaseService)
      .useValue({ query: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('requires an authenticated session to list classes', async () => {
    await request(app.getHttpServer()).get('/api/classes').expect(401);
    await request(app.getHttpServer())
      .get('/api/classes')
      .set('Cookie', 'yoca_session=member-session')
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(3));
  });

  it('restricts class management and attendance to coaches', async () => {
    const body = {
      name: 'יוגה',
      coach: 'YOCA Coach',
      location: 'סטודיו ראשי',
      date: '2026-11-01',
      time: '18:00',
      capacity: 12,
    };
    await request(app.getHttpServer())
      .post('/api/classes')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/classes')
      .set('Cookie', 'yoca_session=member-session')
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/classes')
      .set('Cookie', 'yoca_session=coach-session')
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/classes/class-1/attendance')
      .set('Cookie', 'yoca_session=member-session')
      .send({ memberId: 'member-1' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/classes/class-1/attendance')
      .set('Cookie', 'yoca_session=coach-session')
      .send({ memberId: 'member-1' })
      .expect(201);
    await request(app.getHttpServer())
      .delete('/api/classes/11111111-1111-4111-8111-111111111111')
      .set('Cookie', 'yoca_session=member-session')
      .expect(403);
  });

  it('allows an authenticated member to reserve a class', () => {
    return request(app.getHttpServer())
      .post('/api/classes/11111111-1111-4111-8111-111111111111/reservations')
      .set('Cookie', 'yoca_session=member-session')
      .expect(201)
      .expect({ id: 'class-1', status: 'reserved' });
  });

  it('/api/join-requests (POST) accepts a public join request', () => {
    return request(app.getHttpServer())
      .post('/api/join-requests')
      .send({ name: 'Tamar Levi', email: 'tamar@example.com' })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          name: 'Tamar Levi',
          status: 'pending',
        }),
      );
  });

  it('requires a coach session to read or approve join requests', async () => {
    await request(app.getHttpServer()).get('/api/join-requests').expect(401);
    await request(app.getHttpServer())
      .get('/api/join-requests')
      .set('Cookie', 'yoca_session=member-session')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/join-requests')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/join-requests/request-1/approve')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(200);
  });

  it('sets an HttpOnly cookie on login and clears the session on logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: 'coach', password: 'a-long-password' })
      .expect(201);

    expect(login.body).toMatchObject({ role: 'coach' });
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(201)
      .expect({ status: 'ok' });
  });

  it('requires a session and updates only the signed-in profile', async () => {
    const body = {
      name: 'Tamar Levy',
      email: 'tamar@example.com',
      phone: '050-123-4567',
      birthDate: '1994-06-18',
      address: 'neutral',
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      updatesEnabled: false,
    };
    await request(app.getHttpServer())
      .patch('/api/auth/profile')
      .send(body)
      .expect(401);

    await request(app.getHttpServer())
      .patch('/api/auth/profile')
      .set('Cookie', 'yoca_session=member-session')
      .send(body)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: 'member-1',
          email: 'tamar@example.com',
          reminderLeadMinutes: 30,
        });
      });
    expect(appService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'member-1', role: 'member' }),
      body,
    );
  });

  it('restricts studio finance operations to coaches and member finance to members', async () => {
    await request(app.getHttpServer()).get('/api/studio/finance').expect(401);
    await request(app.getHttpServer())
      .get('/api/studio/finance')
      .set('Cookie', 'yoca_session=member-session')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/studio/finance')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/studio/payments')
      .set('Cookie', 'yoca_session=member-session')
      .send({
        memberId: 'member-1',
        packageId: 'package-1',
        packageCount: 1,
        method: 'cash',
      })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/member/finance')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/member/finance')
      .set('Cookie', 'yoca_session=member-session')
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          balance: { purchasedSessions: 10 },
        }),
      );
    await request(app.getHttpServer())
      .post('/api/studio/packages')
      .set('Cookie', 'yoca_session=member-session')
      .send({ name: 'חבילת ניסיון', sessions: 3, price: 210 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/studio/packages')
      .set('Cookie', 'yoca_session=coach-session')
      .send({ name: 'חבילת ניסיון', sessions: 3, price: 210 })
      .expect(201);
  });

  it('restricts announcement writes and workout feedback to the appropriate role', async () => {
    const classId = '11111111-1111-4111-8111-111111111111';
    const memberId = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer())
      .get('/api/studio/announcements')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/studio/announcements')
      .set('Cookie', 'yoca_session=member-session')
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/studio/announcements')
      .set('Cookie', 'yoca_session=member-session')
      .send({ title: 'עדכון', body: 'הודעה למתאמנים' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/studio/announcements')
      .set('Cookie', 'yoca_session=coach-session')
      .send({ title: 'עדכון', body: 'הודעה למתאמנים' })
      .expect(201);
    await request(app.getHttpServer())
      .delete('/api/studio/announcements/announcement-1')
      .set('Cookie', 'yoca_session=member-session')
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/member/workouts')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/member/workouts')
      .set('Cookie', 'yoca_session=member-session')
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/member/workouts/${classId}/feedback`)
      .set('Cookie', 'yoca_session=coach-session')
      .send({ rating: 5, painAreas: [], painIntensity: null, note: '' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/member/workouts/${classId}/feedback`)
      .set('Cookie', 'yoca_session=member-session')
      .send({ rating: 5, painAreas: [], painIntensity: null, note: '' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/studio/members/${memberId}/workouts`)
      .set('Cookie', 'yoca_session=member-session')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/studio/members/${memberId}/workouts`)
      .set('Cookie', 'yoca_session=coach-session')
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/studio/members/${memberId}/workouts/${classId}/feedback`)
      .set('Cookie', 'yoca_session=member-session')
      .send({ feedback: 'נשימה טובה' })
      .expect(403);
    await request(app.getHttpServer())
      .put(`/api/studio/members/${memberId}/workouts/${classId}/feedback`)
      .set('Cookie', 'yoca_session=coach-session')
      .send({ feedback: 'נשימה טובה' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/member/workouts/${classId}/read`)
      .set('Cookie', 'yoca_session=coach-session')
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/member/workouts/${classId}/read`)
      .set('Cookie', 'yoca_session=member-session')
      .expect(201);
  });

  it('persists social posts and restricts member status changes to coaches', async () => {
    await request(app.getHttpServer())
      .get('/api/studio/social-post')
      .set('Cookie', 'yoca_session=member-session')
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/studio/social-post')
      .set('Cookie', 'yoca_session=member-session')
      .send({
        title: 'שיתוף',
        permalink: 'https://www.instagram.com/p/Abc_123/',
        explanations: [],
      })
      .expect(403);
    await request(app.getHttpServer())
      .put('/api/studio/social-post')
      .set('Cookie', 'yoca_session=coach-session')
      .send({
        title: 'שיתוף',
        permalink: 'https://www.instagram.com/p/Abc_123/',
        explanations: [],
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/studio/members/member-1/status')
      .set('Cookie', 'yoca_session=member-session')
      .send({ active: false })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/studio/members/member-1/status')
      .set('Cookie', 'yoca_session=coach-session')
      .send({ active: false })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/api/join-requests/request-1')
      .set('Cookie', 'yoca_session=member-session')
      .expect(403);
    await request(app.getHttpServer())
      .delete('/api/join-requests/request-1')
      .set('Cookie', 'yoca_session=coach-session')
      .expect(200);
  });

  it('sets a session cookie when activating an invitation', () => {
    return request(app.getHttpServer())
      .post('/api/auth/activate')
      .send({
        token: 'one-time-token',
        email: 'tamar@example.com',
        username: 'tamar.levy',
        password: 'a-long-member-password',
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({ role: 'member' });
        expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
        expect(response.body).not.toHaveProperty('passwordHash');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
