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

Hosted on **Coolify** at `157.90.167.16` (SSH port **2222**).

- **URLs**: `https://timesheet.wirbauensoftware.de` (frontend), `https://timesheet-api.wirbauensoftware.de` (backend)
- **Not auto-deploy** — must be triggered manually via Coolify PHP script
- **Docker**: Backend and frontend each have their own `Dockerfile` (multi-stage, Node 22-alpine)
- **Coolify UUIDs**: backend=`soog0o040o40kokgcsc0wg0g`, frontend=`p48o48scc8cs08ogko40ws40`

### Deploy Steps

1. Push to main:
```bash
git push origin main
```

2. SSH in and trigger Coolify deploys:
```bash
ssh -p 2222 root@157.90.167.16
```

3. Run deploy script on server:
```bash
cat > /tmp/deploy.php << 'EOFPHP'
<?php
require "/var/www/html/vendor/autoload.php";
$app = require_once "/var/www/html/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$uuids = ["soog0o040o40kokgcsc0wg0g", "p48o48scc8cs08ogko40ws40"];
foreach ($uuids as $uuid) {
    $application = App\Models\Application::where("uuid", $uuid)->first();
    $deployUuid = Illuminate\Support\Str::random(24);
    $queue = App\Models\ApplicationDeploymentQueue::create([
        "application_id" => $application->id,
        "deployment_uuid" => $deployUuid,
        "force_rebuild" => false,
        "is_webhook" => false,
        "commit" => "HEAD",
        "status" => "queued",
        "server_id" => 0,
        "destination_id" => "0",
        "application_name" => $application->name,
        "server_name" => "localhost",
        "only_this_server" => false,
        "rollback" => false,
    ]);
    App\Jobs\ApplicationDeploymentJob::dispatch($queue->id);
    echo $application->name . " deploy dispatched ($deployUuid)\n";
}
EOFPHP
docker cp /tmp/deploy.php coolify:/tmp/deploy.php
docker exec coolify php /tmp/deploy.php
```

### Run Migrations (when schema changes)
```bash
ssh -p 2222 root@157.90.167.16
docker exec -it $(docker ps --filter "name=soog0o" --format '{{.Names}}') npm run db:migrate
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
