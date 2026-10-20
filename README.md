# YOCA

Responsive Hebrew RTL PWA and API for managing YOCA studio classes.

## Development

Use Node 24 (the workspace has been verified with Node 24.11.1):

```powershell
nvm use 24
npm install --prefix client
npm install --prefix server
Copy-Item server\.env.example server\.env
```

Edit `server\.env` and replace the example database and coach passwords. Start PostgreSQL:

```powershell
docker compose --env-file server/.env up -d db
```

Start the API and client in separate terminals:

```powershell
npm run dev:server
npm run dev:client
```

Open http://localhost:4200. The Angular dev server proxies `/api` to the NestJS server on port 3000.

## Online demo deployment

The demo is configured for a single Vercel deployment with two services: the Angular frontend and the NestJS API. Requests under `/api` are routed to the backend; all other requests go to the frontend. Vercel Services is currently in Beta.

1. Push this repository to a **private** GitHub repository. Do not add `.env` files or real customer data.
2. In Vercel, import the repository and enable Vercel Services if prompted. The root `vercel.json` configures both service roots and routing.
3. Connect a PostgreSQL provider through the Vercel Marketplace (for example, Neon). Configure the backend's `DATABASE_URL` with the provider's pooled connection string.
4. Set `COACH_NAME`, `COACH_EMAIL`, `COACH_USERNAME`, and a unique strong `COACH_PASSWORD` in the Vercel project environment variables. Set `CLIENT_ORIGIN` to the production Vercel URL.
5. Deploy and verify `/api/health`, then sign in with the demo coach account. Use only the built-in fictional demo content; do not enter real member, health, or payment information.

Database connections use Vercel Fluid Compute pool management. The API currently creates/updates its schema during startup; that is acceptable only for a low-traffic demo database. A production deployment with real customer data requires formal migrations, backups, and privacy/security review. PostgreSQL is a separate Marketplace service and may have its own cost and retention terms.

## Current scope

- Join requests, member accounts, hashed passwords, and revocable login sessions are stored in PostgreSQL. The coach account is bootstrapped once from `server/.env`; changing its password later requires an explicit database credential-rotation process.
- Coach join-request listing and approval require an authenticated coach session. The session token is an HttpOnly, SameSite cookie; invitation tokens are stored as hashes and shown only once when an approval is created. Account activation also requires the invitation email to match the requested address.
- Studio classes, member reservations, and coach-recorded attendance are stored in PostgreSQL. Class capacity is checked transactionally, and cancelling a class hides it from the active schedule without deleting its reservation or attendance history.
- Account contact details, birth date, address preference, and reminder/update preferences are stored per account and can be read or changed only by the signed-in account.
- The studio price list, training packages, per-member discounts, session balances, attendance totals/points, and manually recorded payment ledger are stored in PostgreSQL. Payment amounts and session credits are calculated on the server in one database transaction. Payment recording documents an offline payment only; it does not charge or verify a transfer.
- Studio announcements, attendance-based workout history, coach feedback, and member wellness feedback are stored in PostgreSQL. Members can read and update only their own workout feedback; coaches can access feedback for an individual member through the protected member dossier. Workout read state is stored per member and class.
- Class duration and member training-start dates are stored in PostgreSQL. Social posts are saved by the coach and loaded for authenticated sessions; no social publishing API is used.
- Real member accounts can be deactivated without deleting their payment or attendance history. Deactivated accounts cannot sign in or reserve classes. Pending join requests can be deleted by a coach.
- Demo content remains browser-only and is not imported into PostgreSQL.
- Coaches can record externally received payments by cash, Bit, or PayBox; member discounts are private and are not included in the member pricing response.
- There is no payment provider or social publishing API. Email matching during activation is not mailbox verification; invitation links must be shared only through a trusted channel. Do not deploy with real member health or payment data until the remaining demo data, production database operations, and privacy controls have been implemented and reviewed.

## API

- `GET /api/health`
- `GET /api/classes` (authenticated; members see their own reservation status, coaches see the class roster)
- `POST /api/classes`, `PATCH /api/classes/:id`, and `DELETE /api/classes/:id` (coach session required)
- `POST /api/classes/:id/reservations` and `DELETE /api/classes/:id/reservations` (member session required)
- `POST /api/classes/:id/attendance` (coach session required; only reserved members can be marked present)
- `POST /api/member/workouts/:classId/read` (member session required; marks that member's attended workout as read)
- `GET /api/studio/announcements` (authenticated), `POST /api/studio/announcements` and `DELETE /api/studio/announcements/:id` (coach session required)
- `GET /api/studio/social-post` (authenticated) and `PUT /api/studio/social-post` (coach session required)
- `GET /api/member/workouts` and `POST /api/member/workouts/:classId/feedback` (member session required; own attended workouts only)
- `GET /api/studio/members/:id/workouts` and `PUT /api/studio/members/:memberId/workouts/:classId/feedback` (coach session required)
- `PATCH /api/auth/profile` (authenticated; updates the signed-in account profile and preferences)
- `GET /api/studio/finance` and all `/api/studio/*` write routes (coach session required)
- `PATCH /api/studio/members/:id/status` and `DELETE /api/join-requests/:id` (coach session required)
- `GET /api/member/finance` (member session required; returns only that member's balance and payment history)
- `POST /api/join-requests` with `{ "name": "Full Name", "email": "name@example.com" }`
- `GET /api/join-requests` and `PATCH /api/join-requests/:id/approve` require a coach session.
- `POST /api/auth/login`, `POST /api/auth/activate`, `GET /api/auth/me`, and `POST /api/auth/logout`.

The server creates its current tables on startup and seeds the initial coach only when that configured account does not already exist. Local PostgreSQL data persists in the `yoca-postgres-data` Docker volume. Keep the client and API on the same site so the `SameSite=Strict` session cookie is sent reliably.

Run server checks with `npm run test:server`, `npm run test:e2e:server`, and `npm run build:server`.
