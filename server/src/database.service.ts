import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { attachDatabasePool } from '@vercel/functions';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { hashPassword } from './auth-crypto';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
  });

  constructor() {
    if (process.env.VERCEL) {
      attachDatabasePool(this.pool);
    }
  }

  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be configured');
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL,
        username text NOT NULL,
        role text NOT NULL CHECK (role IN ('coach', 'member')),
        password_salt text NOT NULL CHECK (length(password_salt) = 32),
        password_hash text NOT NULL CHECK (length(password_hash) = 128),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date date;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS address text
        CHECK (address IS NULL OR address IN ('feminine', 'masculine', 'neutral'));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_lead_minutes integer NOT NULL DEFAULT 60
        CHECK (reminder_lead_minutes IN (15, 30, 60, 90, 120));
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updates_enabled boolean NOT NULL DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS training_since date;
      UPDATE users SET training_since = created_at::date WHERE training_since IS NULL;
      ALTER TABLE users ALTER COLUMN training_since SET DEFAULT CURRENT_DATE;
      ALTER TABLE users ALTER COLUMN training_since SET NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (lower(username));

      CREATE TABLE IF NOT EXISTS join_requests (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL,
        status text NOT NULL CHECK (status IN ('pending', 'approved', 'active')),
        created_at timestamptz NOT NULL DEFAULT now(),
        invitation_token_hash text CHECK (invitation_token_hash IS NULL OR length(invitation_token_hash) = 64),
        invitation_expires_at timestamptz,
        user_id uuid UNIQUE REFERENCES users(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS join_requests_email_unique ON join_requests (lower(email));

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);

      CREATE TABLE IF NOT EXISTS studio_classes (
        id uuid PRIMARY KEY,
        class_date date NOT NULL,
        start_time time NOT NULL,
        name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
        coach text NOT NULL CHECK (length(coach) BETWEEN 2 AND 100),
        location text NOT NULL CHECK (length(location) BETWEEN 2 AND 100),
        capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 200),
        duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 240),
        cancelled boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE studio_classes ADD COLUMN IF NOT EXISTS duration_minutes integer
        CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 240);
      CREATE INDEX IF NOT EXISTS studio_classes_schedule_idx
        ON studio_classes (class_date, start_time) WHERE cancelled = false;

      CREATE TABLE IF NOT EXISTS class_reservations (
        class_id uuid NOT NULL REFERENCES studio_classes(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reserved_at timestamptz NOT NULL DEFAULT now(),
        attended_at timestamptz,
        PRIMARY KEY (class_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS class_reservations_member_idx
        ON class_reservations (user_id, class_id);

      CREATE TABLE IF NOT EXISTS studio_announcements (
        id uuid PRIMARY KEY,
        title text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
        body text NOT NULL CHECK (length(body) BETWEEN 2 AND 4000),
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS studio_announcements_created_idx
        ON studio_announcements (created_at DESC);

      CREATE TABLE IF NOT EXISTS workout_feedback (
        class_id uuid NOT NULL,
        user_id uuid NOT NULL,
        coach_feedback text CHECK (coach_feedback IS NULL OR length(coach_feedback) <= 2000),
        member_rating smallint CHECK (member_rating IS NULL OR member_rating BETWEEN 1 AND 5),
        pain_areas text[] NOT NULL DEFAULT '{}',
        pain_intensity text CHECK (pain_intensity IS NULL OR pain_intensity IN ('mild', 'moderate', 'strong')),
        member_note text NOT NULL DEFAULT '' CHECK (length(member_note) <= 2000),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (class_id, user_id),
        FOREIGN KEY (class_id, user_id)
          REFERENCES class_reservations (class_id, user_id) ON DELETE CASCADE,
        CHECK (cardinality(pain_areas) <= 10),
        CHECK ((cardinality(pain_areas) = 0) = (pain_intensity IS NULL)),
        CHECK (coach_feedback IS NOT NULL OR member_rating IS NOT NULL)
      );

      CREATE TABLE IF NOT EXISTS workout_read_states (
        class_id uuid NOT NULL,
        user_id uuid NOT NULL,
        read_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (class_id, user_id),
        FOREIGN KEY (class_id, user_id)
          REFERENCES class_reservations (class_id, user_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS studio_social_posts (
        id uuid PRIMARY KEY,
        title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
        permalink text NOT NULL CHECK (length(permalink) BETWEEN 1 AND 2048),
        explanations text[] NOT NULL DEFAULT '{}',
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (cardinality(explanations) <= 20)
      );
      CREATE INDEX IF NOT EXISTS studio_social_posts_created_idx
        ON studio_social_posts (created_at DESC, id DESC);

      CREATE TABLE IF NOT EXISTS studio_settings (
        id boolean PRIMARY KEY DEFAULT true CHECK (id),
        single_class_price numeric(12, 2) NOT NULL CHECK (single_class_price > 0)
      );
      INSERT INTO studio_settings (id, single_class_price)
      VALUES (true, 75)
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS training_packages (
        id uuid PRIMARY KEY,
        name text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
        sessions integer NOT NULL CHECK (sessions BETWEEN 1 AND 1000),
        price numeric(12, 2) NOT NULL CHECK (price > 0),
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS member_discounts (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('percent', 'amount')),
        value numeric(12, 2) NOT NULL CHECK (value > 0),
        note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS member_balances (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        purchased_sessions integer NOT NULL DEFAULT 0 CHECK (purchased_sessions >= 0),
        used_sessions integer NOT NULL DEFAULT 0 CHECK (used_sessions >= 0),
        attendance_count integer NOT NULL DEFAULT 0 CHECK (attendance_count >= 0),
        points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
        CHECK (used_sessions <= purchased_sessions)
      );

      CREATE TABLE IF NOT EXISTS manual_payments (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id),
        package_id uuid REFERENCES training_packages(id) ON DELETE SET NULL,
        member_name text NOT NULL,
        package_name text NOT NULL,
        package_count integer NOT NULL CHECK (package_count BETWEEN 1 AND 1000),
        sessions_purchased integer NOT NULL CHECK (sessions_purchased BETWEEN 1 AND 100000),
        gross_amount numeric(12, 2) NOT NULL CHECK (gross_amount > 0),
        discount_amount numeric(12, 2) NOT NULL CHECK (discount_amount >= 0),
        paid_amount numeric(12, 2) NOT NULL CHECK (paid_amount >= 0),
        method text NOT NULL CHECK (method IN ('cash', 'bit', 'paybox')),
        recorded_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS manual_payments_recorded_idx
        ON manual_payments (recorded_at DESC);
      CREATE INDEX IF NOT EXISTS manual_payments_member_idx
        ON manual_payments (user_id, recorded_at DESC);
    `);
    await this.seedPricing();
    await this.pool.query(
      'DELETE FROM auth_sessions WHERE expires_at <= now()',
    );
    await this.seedCoach();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(text, [...values]);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async seedCoach(): Promise<void> {
    const username = process.env.COACH_USERNAME?.trim().toLowerCase();
    const password = process.env.COACH_PASSWORD;
    const name = process.env.COACH_NAME?.trim();
    const email = process.env.COACH_EMAIL?.trim().toLowerCase();
    if (!username || !password || !name || !email) {
      throw new Error(
        'COACH_USERNAME, COACH_PASSWORD, COACH_NAME and COACH_EMAIL must be configured',
      );
    }
    if (
      !/^[a-z0-9._-]{3,32}$/.test(username) ||
      password.length < 12 ||
      name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error(
        'Coach bootstrap credentials do not meet the configured requirements',
      );
    }

    const { salt, hash } = await hashPassword(password);
    await this.pool.query(
      `INSERT INTO users (id, name, email, username, role, password_salt, password_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, 'coach', $4, $5)
       ON CONFLICT DO NOTHING`,
      [name, email, username, salt, hash],
    );

    const existing = await this.pool.query<{
      role: string;
      username: string;
    }>('SELECT role, username FROM users WHERE lower(username) = $1', [
      username,
    ]);
    if (
      existing.rowCount !== 1 ||
      existing.rows[0].role !== 'coach' ||
      existing.rows[0].username.toLowerCase() !== username
    ) {
      throw new Error(
        'Configured coach username or email conflicts with another account',
      );
    }
    const conflictingEmail = await this.pool.query(
      'SELECT 1 FROM users WHERE lower(email) = $1 AND lower(username) <> $2',
      [email, username],
    );
    if (conflictingEmail.rowCount) {
      throw new Error(
        'Configured coach username or email conflicts with another account',
      );
    }
  }

  private async seedPricing(): Promise<void> {
    const { rowCount } = await this.pool.query(
      'SELECT 1 FROM training_packages LIMIT 1',
    );
    if (rowCount) {
      return;
    }
    await this.pool.query(
      `INSERT INTO training_packages (id, name, sessions, price)
         VALUES
           (gen_random_uuid(), 'חבילת 5 אימונים', 5, 350),
           (gen_random_uuid(), 'חבילת 10 אימונים', 10, 650),
           (gen_random_uuid(), 'חבילת 20 אימונים', 20, 1200)`,
    );
  }
}
