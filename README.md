# FMS Platform

Full-stack foundation for the First Aid & Medicine Management System.

## Stack

- Frontend: Next.js, React, Tailwind CSS, shadcn-style UI components
- API: Node.js, Express, TypeScript
- Data: PostgreSQL, Prisma ORM
- Deployment: Docker Compose

## Run the full local environment

```bash
npm run dev:stack
```

Docker Compose starts PostgreSQL, the Express API used by the current web pages, the Next.js web app, and Prisma Studio together. The API and Studio connect to the same database container.

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Prisma Studio: `http://localhost:5555`

Stop the environment with `docker compose down`. Database data stays in the `postgres_data` volume.

The active workflows remain in `Front-end/` and are served by Next.js from `apps/web/`. The active API is in `Back-end/`.

## Front-end structure

- [Front-end guide](Front-end/README.md) — รายการหน้า โมดูล และไฟล์กลางของระบบที่ใช้งานจริง
- [Architecture guide](docs/FRONTEND-STRUCTURE.md) — ความสัมพันธ์ระหว่าง Legacy Front-end, Next.js, API และฐานข้อมูล
