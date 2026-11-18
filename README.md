# B2B Sales Operations CRM

A production-style B2B sales operations platform focused on lead qualification, pipeline SLA
governance, and revenue forecasting. Phase 2 adds a complete lead workspace, a visual opportunity
pipeline, database-backed metrics, record ownership controls, and realistic portfolio demo data.
Tasks and advanced reporting remain deliberately scoped to later phases.

All names shown in the interface are product/demo labels. The project does not claim real customer
implementations or business outcomes.

## Phase 1 capabilities

- Async FastAPI API with SQLAlchemy 2, PostgreSQL, Alembic, Pydantic v2, structured errors, CORS,
  application logging, health checks, and OpenAPI docs.
- UUID-based users with `admin`, `manager`, and `sales_agent` roles.
- Argon2 password hashing; short-lived access JWTs; `HttpOnly` refresh cookies; server-side hashed
  refresh sessions; refresh rotation and logout revocation.
- Reusable API role guard plus role-aware frontend navigation.
- React, strict TypeScript, React Router, TanStack Query, React Hook Form, Zod, and Tailwind CSS.
- Protected routes, automatic session refresh, responsive navigation, user/role display, a dashboard,
  and intentionally scoped next-phase placeholders.
- Docker Compose services for PostgreSQL, API, and the Nginx-served frontend, each with health checks.

## Phase 2 capabilities

- Companies and contacts with normalized, searchable commercial data.
- Paginated leads with search, owner/source/status/priority filters, sorting, follow-up tracking,
  create/edit workflows, and transactional conversion to opportunities.
- A responsive Kanban sales pipeline with stage value totals, deal probability, expected close
  dates, stage SLA warnings, drag-and-drop transitions, optimistic updates, and rollback on failure.
- Immutable deal stage history recording the actor, previous/new stages, timestamp, and time spent.
- Live dashboard metrics for active and weighted pipeline value, monthly closing value, overdue
  follow-ups, open opportunities, and deals requiring attention.
- Server-side ownership authorization: admins/managers manage all records; sales agents are scoped to
  leads and opportunities assigned to them.
- An explicit idempotent demo-data command with six stages, companies, contacts, leads, three demo
  owners, and twelve realistic opportunities. It is never run automatically.

## Architecture

```text
Browser (React/Vite)
  ├─ access JWT held in memory
  └─ HttpOnly refresh cookie
             │
             ▼
FastAPI /api/v1
  ├─ routes + dependency-based auth/RBAC
  ├─ focused authentication/user services
  └─ async SQLAlchemy sessions
             │
             ▼
PostgreSQL
  ├─ users + hashed, revocable refresh sessions
  ├─ companies + contacts + leads
  └─ pipeline stages + deals + stage history
```

The backend separates HTTP routes, configuration/security, database setup, ORM models, Pydantic
schemas, and business services. It intentionally avoids a generic repository layer: SQLAlchemy
queries remain in small domain services where they are easy to follow. The frontend has one API
client and one authentication provider, so refresh and error behavior are not duplicated between
pages.

## Repository layout

```text
backend/
  alembic/             database migration environment and revisions
  app/
    api/               routes and FastAPI dependencies
    core/              configuration, security, errors, logging
    db/                declarative base and async sessions
    models/            SQLAlchemy models
    schemas/           Pydantic request/response contracts
    services/          authentication and user operations
  scripts/             initial-admin command
  tests/               API and authentication tests
frontend/
  src/
    auth/              authentication context/provider
    components/        protected route and CRM shell
    lib/               centralized API/session code
    pages/              login, live dashboard, leads, pipeline, placeholders
    types/              shared TypeScript contracts
docker-compose.yml
```

## Start with Docker (recommended)

Requirements: Docker with Compose v2.

```bash
cp .env.example .env
# Replace POSTGRES_PASSWORD and JWT_SECRET_KEY in .env.
docker compose up --build -d
docker compose exec backend python -m scripts.create_admin
docker compose exec backend python -m scripts.seed_demo_data
```

Apply migrations is part of the backend container startup. Open:

- CRM: <http://localhost:3000>
- API docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/v1/health>

Create the first administrator after the services are healthy:

```bash
docker compose exec backend python -m scripts.create_admin
```

For non-interactive local automation, `ADMIN_EMAIL`, `ADMIN_FULL_NAME`, and `ADMIN_PASSWORD` may be
passed as environment variables. Do not place real credentials in committed files.
Running the command again for an existing email exits successfully and leaves that account unchanged.

Stop services with `docker compose down`. Add `-v` only when you intentionally want to delete the
local PostgreSQL volume.

## Run services directly

Requirements: Python 3.12, Node.js 20+, npm, and PostgreSQL 16+.

The root `.env.example` is for Docker Compose. The service-specific examples below are for running
the backend and frontend directly on the host.

Backend:

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend, in a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Create an admin when running directly:

```bash
cd backend
source .venv/bin/activate
python -m scripts.create_admin
```

## Portfolio demo data

Run migrations and create the first administrator before loading demo data:

```bash
docker compose exec backend python -m scripts.create_admin
docker compose exec backend python -m scripts.seed_demo_data
```

The seed command is idempotent: rerunning it updates nothing and does not duplicate records. Demo
sales owners receive random, unrecoverable passwords and exist only for ownership display. The
command is opt-in and is never invoked by application startup or migrations.

The demo workspace contains deliberate SLA risks, varied values and close dates, won/lost deals,
and overdue follow-ups so the dashboard and pipeline communicate realistic operational states.

## Database migrations

Run existing migrations:

```bash
cd backend
alembic upgrade head
```

Create and review a migration after changing models:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

## Quality checks

Backend:

```bash
cd backend
ruff check .
ruff format --check .
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Compose configuration:

```bash
docker compose config --quiet
```

## Configuration and security notes

- Copy example environment files; never commit `.env` files.
- Compose requires an explicit database password and a random `JWT_SECRET_KEY` of at least 32
  characters; there are no runtime secret fallbacks in source control.
- Set `REFRESH_COOKIE_SECURE=true` behind HTTPS in production. When frontend/API sites differ, also
  review cookie `SameSite`, domain, and CSRF protections for the deployment topology.
- Production configuration fails fast when secure refresh cookies are disabled. `SameSite=None`
  is also rejected unless secure cookies are enabled.
- CORS origins are an explicit comma-separated allowlist; credentials are enabled for the refresh
  cookie.
- Passwords are never stored directly. Refresh JWTs are also stored only as SHA-256 digests, making
  active sessions revocable without persisting bearer tokens.
- Public self-registration is intentionally absent. Administrators are provisioned through the
  local command, leaving user management for an explicitly scoped future phase.

## API surface

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `GET /api/v1/users`
- `GET|POST|PATCH /api/v1/companies`
- `GET|POST|PATCH /api/v1/contacts`
- `GET|POST|PATCH /api/v1/leads`
- `POST /api/v1/leads/{lead_id}/convert`
- `GET /api/v1/pipeline-stages`
- `GET|POST|PATCH /api/v1/deals`
- `POST /api/v1/deals/{deal_id}/transition`
- `GET /api/v1/pipeline`
- `GET /api/v1/dashboard/summary`
- Interactive OpenAPI at `/docs` and ReDoc at `/redoc`

## Domain and authorization rules

- A contact must belong to the selected company for every lead and deal.
- Monetary values use fixed-precision decimals; probabilities are constrained to `0..100` and
  currencies to three-character codes.
- Lead conversion and deal stage movement commit atomically. Invalid/inactive stages are rejected.
- Pipeline stage transitions are made only through the transition endpoint, which creates history.
- Sales agents see their own leads and deals and cannot modify another owner's records. Admins and
  managers can view, assign, and update all CRM records.
- The dashboard and board apply the same server-side ownership scope as record endpoints.
