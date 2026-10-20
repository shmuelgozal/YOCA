# YOCA API

The NestJS API uses PostgreSQL for join requests, member accounts, password hashes, revocable sessions, account profiles/preferences including training-start dates, studio classes including duration, member reservations, attendance, per-member workout read state, pricing, packages, private discounts, session balances, offline payment records, studio announcements and social posts, attendance-based workout history, and workout feedback. Demo content is not imported into the database.

Workout feedback can contain sensitive health information. Member endpoints are scoped to the signed-in member and attended classes; coach access is authenticated and limited to a requested member dossier. Production deployments still need managed database access, backups, transport and at-rest protection, retention rules, and an appropriate privacy review before storing real health data.

## Local setup

From the repository root:

```powershell
Copy-Item server\.env.example server\.env
```

Change the example database and coach passwords in `server\.env`, then run:

```powershell
docker compose --env-file server/.env up -d db
npm run dev:server
```

The API initializes its current schema on startup. PostgreSQL data is stored in the `yoca-postgres-data` Docker volume. Do not use the example passwords for a publicly accessible deployment.

## Authentication

- Coach bootstrap credentials come from `COACH_USERNAME`, `COACH_PASSWORD`, `COACH_NAME`, and `COACH_EMAIL`.
- The coach password is hashed before storage. Bootstrap inserts the configured account only if it does not exist; credential rotation must be performed explicitly in the database.
- Login and invitation activation return a 12-hour HttpOnly, SameSite=Strict session cookie. Logout revokes the database session.
- Reading and approving join requests requires an active coach session. Invitation tokens are stored as hashes and expire after 48 hours; the token is returned only at approval or explicit renewal.
- Activation requires the invitation email to match the join request. It does not verify control of the mailbox; share invitation links through a trusted channel.

## API

- `GET /api/health`
- `GET /api/classes` (authenticated; class rosters are coach-only)
- `POST /api/classes`, `PATCH /api/classes/:id`, and `DELETE /api/classes/:id` (coach session required)
- `POST /api/classes/:id/reservations` and `DELETE /api/classes/:id/reservations` (member session required)
- `POST /api/classes/:id/attendance` (coach session required; member must have a reservation)
- `POST /api/member/workouts/:classId/read` (member session required; own attended workout only)
- `GET /api/studio/announcements` (authenticated); `POST /api/studio/announcements` and `DELETE /api/studio/announcements/:id` (coach session required)
- `GET /api/studio/social-post` (authenticated); `PUT /api/studio/social-post` (coach session required)
- `GET /api/member/workouts` and `POST /api/member/workouts/:classId/feedback` (member session required; only attended workouts belonging to the signed-in member)
- `GET /api/studio/members/:id/workouts` and `PUT /api/studio/members/:memberId/workouts/:classId/feedback` (coach session required)
- `POST /api/join-requests`
- `GET /api/join-requests` (coach session required)
- `PATCH /api/join-requests/:id/approve` (coach session required)
- `POST /api/join-requests/:id/invitation` (coach session required; rotates the link)
- `POST /api/auth/login`
- `POST /api/auth/activate`
- `GET /api/auth/me`
- `PATCH /api/auth/profile` (authenticated; updates only the signed-in account)
- `POST /api/auth/logout`
- `GET /api/studio/finance`, `PATCH /api/studio/pricing`, and `/api/studio/packages` CRUD (coach session required)
- `PATCH /api/studio/members/:id/status` and `DELETE /api/join-requests/:id` (coach session required)
- `PUT|DELETE /api/studio/members/:id/discount` and `POST /api/studio/payments` (coach session required)
- `GET /api/member/finance` (member session required; own balance and payment history only)

Reservation creation locks the class row while checking its capacity, preventing concurrent signups from exceeding the limit. Class cancellation is a soft cancellation so existing reservation and attendance records remain in the database.

Workout history is derived from recorded attendance; feedback and read state are linked to that attendance record and are removed if the reservation is deleted. Member wellness feedback is returned only to that member or to a coach explicitly viewing that member's protected dossier. Class duration and social posts are persisted. Account deactivation revokes sessions and removes future uncompleted reservations while preserving attendance and payment history.

Manual payment recording calculates package price, private discount, and session credits on the server in one transaction. Attendance recording and consumption of a purchased session are committed atomically. Package deletion deactivates it without removing payment history. These records document payments made outside YOCA and do not process or verify transfers.

Run tests and build from the repository root:

```powershell
npm run test:server
npm run test:e2e:server
npm run build:server
```
