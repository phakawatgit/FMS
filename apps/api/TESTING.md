# API QA and manual testing guide

All commands below use the disposable local database `fms_test`. Do not point schema setup or tests at production or a shared database.

## 1. Start PostgreSQL and create the test database

From the repository root in PowerShell:

```powershell
docker compose up -d postgres
docker compose exec postgres createdb -U fms fms_test
$env:FMS_TEST_DATABASE_URL = "postgresql://fms:fms_password@localhost:5434/fms_test?schema=public"
$env:DATABASE_URL = $env:FMS_TEST_DATABASE_URL
$env:NODE_ENV = "test"
```

If `fms_test` already exists, skip `createdb`. Generate the client from the schema used by the new API and initialize the disposable database:

```powershell
npx.cmd prisma generate --schema packages/database/prisma/schema.prisma
npx.cmd prisma db push --schema packages/database/prisma/schema.prisma
```

`db push` is intended here for a fresh local test database. Use reviewed Prisma migrations for shared or production databases.

## 2. Start the API

In the same shell, keep the test database environment variables set:

```powershell
$env:API_PORT = "4000"
npm.cmd --workspace apps/api run dev
```

The API logs whether PostgreSQL connected. Keep it running and open another terminal for the requests below.

## 3. Seed a manual test patient and stock batch

Open a PostgreSQL prompt:

```powershell
docker compose exec postgres psql -U fms -d fms_test
```

Paste these deterministic, test-only records. The batch starts with 10 tablets; rerun the update before repeating successful manual requests.

```sql
INSERT INTO users (id, employee_id, name, email, password_hash, role, created_at, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', 'QA-MANUAL-001', 'QA Nurse', 'qa-manual@example.invalid', 'test-only', 'NURSE', now(), now())
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO patients (id, patient_number, name, created_at, updated_at)
VALUES ('22222222-2222-4222-8222-222222222222', 'QA-MANUAL-001', 'QA Patient', now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO categories (id, name, created_at, updated_at)
VALUES ('33333333-3333-4333-8333-333333333333', 'QA Manual Category', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO items (id, category_id, sku, name, unit, reorder_level, is_active, created_at, updated_at)
VALUES ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 'QA-MANUAL-001', 'QA Manual Medicine', 'tablet', 0, true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO stock_batches (id, item_id, batch_number, current_quantity, received_at, created_at, updated_at)
VALUES ('55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444', 'QA-MANUAL-BATCH-001', 10, now(), now(), now())
ON CONFLICT (id) DO UPDATE SET current_quantity = 10;

\q
```

## 4. Manually test the endpoints

### Health: database connected

```powershell
curl.exe -i http://localhost:4000/api/health
```

Expect HTTP 200 with `status: "ok"` and `db: "connected"`.

### Health: database disconnected

In another terminal, stop only the local PostgreSQL service, make the request, then start it again:

```powershell
docker compose stop postgres
curl.exe -i http://localhost:4000/api/health
docker compose start postgres
```

Expect HTTP 500 and `db: "disconnected"`. The API logs the underlying database error. In production, the response hides connection details.

### Visit succeeds and deducts stock

```powershell
curl.exe -i -X POST http://localhost:4000/api/visits `
  -H "Content-Type: application/json" `
  --data-raw '{"patientId":"22222222-2222-4222-8222-222222222222","nurseId":"11111111-1111-4111-8111-111111111111","symptoms":"QA test","diagnosis":"QA test","treatmentNotes":"Manual QA only","dispensedItems":[{"stockBatchId":"55555555-5555-4555-8555-555555555555","quantity":2}]}'
```

Expect HTTP 201 with a visit and one dispensation. Check the remaining quantity:

```powershell
docker compose exec postgres psql -U fms -d fms_test -c "SELECT current_quantity FROM stock_batches WHERE id = '55555555-5555-4555-8555-555555555555';"
```

Expect `8.000`. Each successful request deducts 2; reset the batch to 10 in the SQL prompt before repeating.

### Visit fails: insufficient stock

```powershell
curl.exe -i -X POST http://localhost:4000/api/visits `
  -H "Content-Type: application/json" `
  --data-raw '{"patientId":"22222222-2222-4222-8222-222222222222","nurseId":"11111111-1111-4111-8111-111111111111","dispensedItems":[{"stockBatchId":"55555555-5555-4555-8555-555555555555","quantity":999}]}'
```

Expect HTTP 409 and `code: "INSUFFICIENT_STOCK"`.

### Visit fails: batch does not exist

```powershell
curl.exe -i -X POST http://localhost:4000/api/visits `
  -H "Content-Type: application/json" `
  --data-raw '{"patientId":"22222222-2222-4222-8222-222222222222","nurseId":"11111111-1111-4111-8111-111111111111","dispensedItems":[{"stockBatchId":"66666666-6666-4666-8666-666666666666","quantity":1}]}'
```

Expect HTTP 404 and `code: "STOCK_BATCH_NOT_FOUND"`.

## 5. Run automated tests

Stop the manually started API first. From the repository root, use a shell with `FMS_TEST_DATABASE_URL` pointing to `fms_test`:

```powershell
$env:FMS_TEST_DATABASE_URL = "postgresql://fms:fms_password@localhost:5434/fms_test?schema=public"
$env:DATABASE_URL = $env:FMS_TEST_DATABASE_URL
$env:NODE_ENV = "test"
npm.cmd --workspace apps/api run test:integration
npm.cmd --workspace apps/api run test:e2e
```

The Jest suite starts and stops its own API process. The Playwright suite also starts a dedicated API process on port 4112. Both suites create unique fixtures and remove them afterward. They refuse to run unless the test database name contains a separate `test` segment.
