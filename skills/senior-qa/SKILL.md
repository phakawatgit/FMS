---
name: senior-qa
description: Review FMS backend changes for correctness and risk, prepare safe manual test instructions, and create or run focused Jest and Playwright API tests when QA work is requested.
---

# Senior QA for FMS

Use this skill when the user asks for a QA review, test plan, integration tests, API E2E tests, or verification of an FMS backend workflow. Do not activate it for ordinary feature implementation unless testing or review is part of the request.

## QA workflow

1. Inspect the target API routes, controllers, validation, Prisma schema, package scripts, environment setup, and existing test conventions. FMS uses `Back-end/` for the active API and PostgreSQL persistence.
2. Turn the requested behavior into observable cases: success, invalid input, missing records, business-rule failures, concurrent writes when relevant, and persistence or rollback.
3. Review data integrity and trust boundaries. For inventory workflows, check whether conditional database updates prevent overselling under concurrent transactions, and whether all related writes share one transaction. Check identity and authorization separately from request validation.
4. Provide a sequential manual guide with schema/client setup, server startup, realistic requests, expected status codes, and how to verify persisted effects. Use the repository's actual Prisma schema path and commands.
5. Add automated tests using the target workspace's existing tools. Keep integration tests isolated, repeatable, and responsible for cleaning only the unique fixtures they created. Prefer Playwright's API request fixture for API-only E2E checks.
6. Report which checks were actually run. Distinguish generated test files and static type checks from tests executed against a live database.

## Database safety

- Use only a disposable local or dedicated test database for integration/E2E tests. Never run tests or schema-writing commands against a production or shared database.
- Require an explicit test database setting such as `FMS_TEST_DATABASE_URL`; validate that its database name clearly identifies it as a test database before creating or deleting fixtures.
- Do not use `db push`, migrations, seed scripts, or cleanup that can overwrite or delete records in an unverified database.
- Do not print database URLs, credentials, patient information, or other secrets in test logs or examples.
- Keep fixtures synthetic, uniquely named, and narrowly scoped. Clean up only those fixtures and dependent rows created by the test.
- If the test database target cannot be verified, prepare the guide and tests without connecting to or mutating a database.

## Review focus

For each requested workflow, check:

- **Concurrency:** whether the database itself enforces the invariant under simultaneous requests, not only an earlier read in application code.
- **Atomicity:** whether a later failure rolls back all related writes and stock changes.
- **Validation:** malformed identifiers, missing fields, negative/zero/out-of-range quantities, numeric precision, duplicate line items, and unexpected properties.
- **Errors:** correct HTTP status mapping, useful client messages, server-side diagnostics, and no stack traces or connection secrets in production responses.
- **Authorization:** whether user or staff identifiers come from trusted authentication context rather than an untrusted request body.
- **Coverage:** whether tests verify both the response and persisted state where applicable.

## Reporting

Summarize findings by severity and explain practical impact. Separate confirmed defects from hardening suggestions. State the exact commands used and whether the database-backed tests ran. Include remaining risks such as missing authentication when the API accepts caller-supplied staff IDs.
