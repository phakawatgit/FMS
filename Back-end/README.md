# FMS API

`Back-end/` contains the Express API used by the running Docker Compose stack. PostgreSQL is the system database; Firebase Authentication verifies sign-in and the API creates the application session.

## Local stack

From the repository root, start the web app, API, PostgreSQL, and Prisma Studio with:

```powershell
docker compose up --build -d
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/health`
- PostgreSQL: `localhost:5434`
- Prisma Studio: `http://localhost:5555`

The Firebase Admin service-account file is mounted read-only from `Back-end/firebase-service-account.json`. Keep that file local; it is ignored by Git.

## Running the API outside Docker

Create `Back-end/.env` from `.env.example`, set `DATABASE_URL` and `FMS_ADMIN_EMAILS`, and keep the service-account JSON in this directory. Then run:

```powershell
cd Back-end
npm install
npm run prisma:generate
npm run dev
```

The Prisma schema and migrations for the API are under `Back-end/prisma/`.
