# ClaudePrep Server — EWGCS Inc

Full-stack exam prep platform for Claude partner certifications.

## Stack
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT (7-day tokens) + bcrypt
- **Frontend**: Vanilla JS SPA served as static files from `/public`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | ✓ | Current user info |
| POST | `/api/auth/register` | Admin | Create new user |
| PUT | `/api/auth/password` | ✓ | Change password |
| GET | `/api/certs` | ✓ | List all certs |
| GET | `/api/certs/:key` | ✓ | Cert detail + domains |
| GET | `/api/certs/:key/questions` | ✓ | Fetch questions (randomized) |
| POST | `/api/attempts` | ✓ | Save exam attempt |
| GET | `/api/attempts` | ✓ | List user attempts |
| GET | `/api/attempts/:id` | ✓ | Single attempt detail |
| GET | `/api/attempts/stats/summary` | ✓ | Progress analytics |

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set a strong JWT_SECRET

# 2. Start everything (DB + app)
docker compose up -d

# That's it — seed runs automatically on first start.
# Open http://localhost:3000
```

## Manual Setup (no Docker)

```bash
# 1. Install PostgreSQL, create DB
createdb claudeprep

# 2. Install dependencies
npm install

# 3. Configure
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 4. Seed (creates schema + questions + initial user)
npm run seed

# 5. Start
npm start
```

## Default Login

| Field | Value |
|-------|-------|
| Email | chandana.vadla@ewgcs.com |
| Password | Letmein |

**Change this password after first login.**  
Admins can add more team members via `POST /api/auth/register`.

## Deploy to Railway / Render

1. Push this folder to a GitHub repo
2. Create a new project on [Railway](https://railway.app) or [Render](https://render.com)
3. Add a PostgreSQL plugin/service
4. Set environment variables: `DATABASE_URL` (provided by the platform), `JWT_SECRET`
5. Deploy — the seed script runs on first boot

## Adding Team Members

```bash
# Via API (as admin):
curl -X POST https://yoursite.com/api/auth/register \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@ewgcs.com","password":"TempPass123","name":"New User"}'
```

## Data Stored in DB

- **users** — email, bcrypt password hash, name, role
- **certs** — cert metadata (code, name, time, pass mark)
- **questions** — 460 questions across 4 certs with domain tags and explanations
- **exam_attempts** — every completed exam: score, answers, timing
- **question_stats** — per-user correct/incorrect counts per question (for future weak-area targeting)
