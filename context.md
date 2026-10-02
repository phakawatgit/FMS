# FMS Project Context

## Project purpose

FMS (First Aid & Medicine Management System) supports school or organization infirmary workflows: medicine and supply inventory, visits, catalog orders, borrowing and returns, duty shifts, assessments, activity history, and reports. Treat this as operational data. Changes to stock, visits, or transactions must preserve accurate quantities, ownership, and history.

## Current shape of the project

The repository contains a live legacy frontend and a newer application that is still being built. Check which implementation serves the requested screen or workflow before editing.

| Area | Location | Current role |
|---|---|---|
| Legacy frontend | `Front-end/` | Static HTML/CSS/JavaScript used by existing workflows. Pages use shared scripts/styles and relative links. |
| New frontend | `apps/web/` | Next.js 15 App Router and React 19. Some routes are starter screens; several real workflows still open `/legacy/*.html`. |
| Active backend | `Back-end/` | Express API, Prisma schema, Firebase session auth, and legacy storage routes used by Docker Compose. |
| Architecture docs | `docs/` | Frontend boundaries and migration guidance. |

## Data and architecture facts

- The legacy frontend stores some state in browser `localStorage`; shared legacy data may sync through `/api/legacy-storage`.
- Some pages use Firebase Authentication. Confirm the page's existing auth flow before changing login or access behavior.
- Run the full local environment with `npm run dev:stack` (Docker Compose): web on host port `3000`, API on `4000`, PostgreSQL on `5434`, and Prisma Studio on `5555`. Inside Compose, services connect by service name and PostgreSQL port `5432`.
- The root `prisma.config.ts` and root database scripts point to `Back-end/prisma/schema.prisma` and `Back-end/prisma/migrations/`.
- `Back-end/prisma/schema.prisma` is the only source schema. The running API and Prisma Studio use this schema.
- The legacy pages are served from the Next.js web container and use the active `Back-end/` API for shared PostgreSQL data.

## Local development

The single-command full-stack startup is:

```powershell
npm run dev:stack
```

For isolated development, `npm run dev:web` and `npm run dev:api` are available.

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
