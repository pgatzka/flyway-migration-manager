# Flyway Migration Manager

A single-user web application for managing PostgreSQL Flyway migrations across multiple projects. Acts as a central migration registry backed by its own PostgreSQL database.

## Tech Stack

- **Backend:** TypeScript, Fastify, Drizzle ORM, Pino
- **Frontend:** React 19, Vite, shadcn/ui, Tailwind CSS, Monaco Editor
- **Database:** PostgreSQL (external)
- **Validation:** Testcontainers (spins up temporary PostgreSQL instances)
- **Containerization:** Docker

## Prerequisites

- Node.js 22+
- PostgreSQL 14+ (running externally)
- Docker (required for migration validation feature)

## Quick Start

### 1. Create the database

```sql
CREATE DATABASE flyway_manager;
```

### 2. Set environment variables

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flyway_manager
export PORT=3000
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run in development mode

In two terminals:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to the backend on port 3000.

### 5. Open the app

Navigate to `http://localhost:5173`

## Docker

### Build and run with Docker Compose

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

Configure the database connection via the `DATABASE_URL` environment variable in `docker-compose.yml`.

## Features

- **Project Management** — Create and manage multiple migration projects
- **Migration Editor** — Full SQL editor with Monaco (syntax highlighting, auto-complete, minimap)
- **Import/Export** — Drag-and-drop .sql file import, ZIP export, single file export
- **Flyway Naming** — Automatic parsing and generation of `V{version}__{description}.sql` filenames
- **Version Management** — Auto-versioning, insert-at-version with shift, renumbering
- **Validation** — Run all migrations against a temporary PostgreSQL container via Testcontainers
- **Real-time Progress** — SSE streaming of validation progress per migration
- **Dashboard** — Project cards with migration count, SQL line count, validation status

## Project Structure

```
├── backend/           # Fastify API server
│   └── src/
│       ├── db/        # Drizzle schema and client
│       ├── routes/    # API route handlers
│       ├── services/  # Business logic
│       ├── errors/    # Custom error classes
│       └── utils/     # Flyway naming, ZIP utilities
├── frontend/          # React + Vite SPA
│   └── src/
│       ├── api/       # API client
│       ├── components/# UI components (shadcn/ui)
│       ├── pages/     # Route pages
│       └── hooks/     # Custom React hooks
├── shared/            # Shared TypeScript types
├── Dockerfile         # Multi-stage production build
└── docker-compose.yml
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects with stats |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project name |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/migrations` | List migrations |
| POST | `/api/projects/:id/migrations` | Create migration (auto-version) |
| POST | `/api/projects/:id/migrations/insert/:ver` | Insert at version |
| POST | `/api/projects/:id/migrations/renumber` | Renumber migrations |
| GET | `/api/migrations/:id` | Get migration |
| PUT | `/api/migrations/:id` | Update migration |
| DELETE | `/api/migrations/:id` | Delete migration |
| POST | `/api/projects/:id/import` | Import .sql files |
| GET | `/api/projects/:id/export` | Export as ZIP |
| GET | `/api/migrations/:id/export` | Export single .sql |
| POST | `/api/projects/:id/validate` | Run validation (SSE) |
| GET | `/api/projects/:id/validations` | List validation history |
