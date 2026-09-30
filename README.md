# FMS Platform

Full-stack foundation for the First Aid & Medicine Management System.

## Stack

- Frontend: Next.js, React, Tailwind CSS, shadcn-style UI components
- API: Node.js, Express, TypeScript
- Data: PostgreSQL, Prisma ORM
- Reports: Python, FastAPI, ReportLab, openpyxl
- Deployment: Docker Compose

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start PostgreSQL with `docker compose up postgres -d`.
4. Run `npm run db:generate`.
5. Run `npm run db:migrate -- --name init`.
6. Start the API with `npm run dev:api`.
7. Start the web app with `npm run dev:web`.

## Run with Docker

```bash
docker compose up --build
```

The web app is available at `http://localhost:3001`, the API at `http://localhost:4000`, and the report service at `http://localhost:8000`.

The existing static prototype remains in `Front-end/` while the new application is built in `apps/`, `packages/`, and `services/`.

## Front-end structure

- [Front-end guide](Front-end/README.md) — รายการหน้า โมดูล และไฟล์กลางของระบบที่ใช้งานจริง
- [Architecture guide](docs/FRONTEND-STRUCTURE.md) — ความสัมพันธ์ระหว่าง Legacy Front-end, Next.js, API และฐานข้อมูล
