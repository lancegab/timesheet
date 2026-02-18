# Timesheet App

## Tech Stack
- **Backend**: Hono + Drizzle ORM + MySQL
- **Frontend**: Nuxt 4 (Vue 3) + Tailwind CSS
- **Auth**: JWT (access + refresh tokens)

## Local Development

```bash
# Start MySQL
docker compose up -d mysql

# Backend
cd backend
npm install
npm run dev        # runs on :3001

# Frontend
cd frontend
npm install
npm run dev        # runs on :3000
```

## Database

```bash
cd backend
npm run db:push      # sync schema to DB (dev)
npm run db:generate  # generate migration files
npm run db:migrate   # run migrations (production)
npm run db:seed      # seed admin user (admin@timesheet.local / Admin@123!)
```

Schema defined in `backend/src/db/schema.ts`. Drizzle config in `backend/drizzle.config.ts`.

Connection: `DATABASE_URL` env var, defaults to `mysql://timesheet:timesheet@localhost:3306/timesheet`.

## Deployment

Hosted on **Coolify** at `157.90.167.16`.

- **Auto-deploy**: Push to `main` triggers automatic deployment via Coolify's git integration
- **No manual SSH needed**: Coolify watches the repo and rebuilds on push
- **Docker**: Backend and frontend each have their own `Dockerfile` (multi-stage, Node 22-alpine)

```bash
# Deploy = just push to main
git push origin main
```

If a schema change is needed post-deploy, run migrations inside the backend container on the server:
```bash
ssh root@157.90.167.16
docker exec -it <backend-container> npm run db:migrate
```

## Project Structure

```
backend/
  src/
    routes/          # Hono route handlers
    middleware/       # auth, admin middleware
    db/              # schema, seed, connection
    utils/           # auth helpers
  drizzle/           # generated migrations
  Dockerfile
frontend/
  app/
    pages/           # Nuxt file-based routing
    layouts/         # default layout with nav + clock bar
    composables/     # useApi, useAuth, useClock
    components/
  Dockerfile
docker-compose.yml   # local dev (mysql + backend + frontend)
```

## Key Conventions
- Admin routes use `authMiddleware` + `adminMiddleware`
- API routes registered in `backend/src/index.ts` via `app.route()`
- Frontend admin pages at `frontend/app/pages/admin/`
- Nav links in `frontend/app/layouts/default.vue`
- Employment types: FULL_TIME, PART_TIME, CONTRACT
- Entry types: REGULAR, PAID_LEAVE, APPROVED_LEAVE
- Work types: DEVELOPMENT, QA, MANAGEMENT
