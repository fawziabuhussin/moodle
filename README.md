# Entilaka

Learning platform for accounts and roles, attendance (including a hardware terminal), stipends, private sessions, courses, and notifications. Built for Vercel with Neon PostgreSQL. A calendar module can be added later without changing the core schema.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to the Neon **pooled** connection string and `DIRECT_URL` to the **direct** string.
3. Set `AUTH_SECRET` and `TERMINAL_SECRET`.
4. Apply the schema and demo data:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Demo accounts after seeding:

- `manager@entilaka.local` / `Manager123!`
- `teacher@entilaka.local` / `Teacher123!`
- `student@entilaka.local` / `Student123!` (badge `STU-1001`)

The attendance machine calls `POST /api/v1/attendance/terminal` with the `x-terminal-secret` header. iOS push tokens register at `POST /api/v1/devices/register` with `Authorization: Bearer <token>`.
