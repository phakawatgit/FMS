# FMS Project Context

## Project purpose

FMS (First Aid & Medicine Management System) supports school or organization infirmary workflows: medicine and supply inventory, visits, catalog orders, borrowing and returns, duty shifts, assessments, activity history, and reports. Treat this as operational data. Changes to stock, visits, or transactions must preserve accurate quantities, ownership, and history.

## Current shape of the project

The repository contains a live legacy frontend and a newer application that is still being built. Check which implementation serves the requested screen or workflow before editing.

| Area | Location | Current role |
|---|---|---|
| Legacy frontend | `Front-end/` | Static HTML/CSS/JavaScript used by existing workflows. Pages use shared scripts/styles and relative links. |
| New frontend | `apps/web/` | Next.js 15 App Router and React 19. Some routes are starter screens; several real workflows still open `/legacy/*.html`. |
| New API | `apps/api/` | Express 5 and TypeScript API foundation, currently including health and duty shift endpoints. |
| Legacy backend | `Back-end/` | Existing Express backend, Prisma schema, legacy storage API, and Python service. Verify which service owns a requested behavior. |
| New database package | `packages/database/` | Separate Prisma schema/package used by the newer workspace foundation. Do not assume it is the schema used by every Prisma command. |
| Reports service | `services/reports/` | FastAPI service for PDF/Excel report generation. |
| Architecture docs | `docs/` | Frontend boundaries and migration guidance. |

## Data and architecture facts

- The legacy frontend stores some state in browser `localStorage`; shared legacy data may sync through `/api/legacy-storage`.
- Some pages use Firebase Authentication. Confirm the page's existing auth flow before changing login or access behavior.
- PostgreSQL is provided for local development through Docker Compose on host port `5434`; the API is exposed on `4000`, the report service on `8000`, and the web app on `3001`.
- The root `prisma.config.ts` points Prisma CLI to `Back-end/prisma/schema.prisma` and `Back-end/prisma/migrations/`. `packages/database/prisma/schema.prisma` is a different schema. Always inspect the config, package scripts, and consumers before generating a client or changing a schema.
- The model and enum definitions in both Prisma schemas have been cleared for a fresh setup; only the generator and PostgreSQL datasource configuration remain. Existing API code still references the previous models, so database-backed routes and the legacy backend seed need matching schema/client work before they can run correctly.
- The legacy frontend and newer API/database are in transition. Preserve current routes and data contracts until all relevant callers have migrated.

## Local development

The root scripts include:

```powershell
npm install
docker compose up postgres -d
npm run db:generate
npm run db:migrate -- --name <migration-name>
npm run dev:api
npm run dev:web
```

`npm run db:migrate` writes to the database selected by `DATABASE_URL`; verify the target is a disposable/local development database before running it. Check workspace `package.json` files for other scripts. Do not assume a root lint or backend test script exists.

## Product and implementation principles

- Make the smallest change that solves the requested workflow in its actual owning layer.
- Preserve Thai and English support where the affected screen already provides it.
- Keep inventory quantities, unit conversions, dispensing, borrowing/returning, and audit history consistent. Use transactions for related database writes.
- Validate API input at the boundary; do not trust browser-provided roles, ownership, or quantities.
- Protect personal and health data. Keep real records, credentials, tokens, and private keys out of source, logs, examples, and commits.
- For legacy pages, inspect shared headers, language, storage utilities, CSS, and relative asset paths before moving or changing files.
- For database work, follow [`skills/fms-database/SKILL.md`](skills/fms-database/SKILL.md). For general repository workflow, follow [`Agent.md`](Agent.md).

## Useful references

- [`README.md`](README.md) — stack and local startup
- [`docs/FRONTEND-STRUCTURE.md`](docs/FRONTEND-STRUCTURE.md) — legacy/new frontend boundaries and data ownership
- [`Front-end/README.md`](Front-end/README.md) — legacy pages and shared frontend files
- [`Agent.md`](Agent.md) — repository working instructions
- [`skills/fms-database/SKILL.md`](skills/fms-database/SKILL.md) — database workflow and Caveman style
