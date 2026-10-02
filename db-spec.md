# FMS database schema

`Back-end/prisma/schema.prisma` is the single schema used by the API and Prisma Studio.

## Models shown in Prisma Studio

1. `User` — Firebase linked accounts.
2. `DutyShift` — duty assignments linked to users.
3. `Patient` — patient profiles and visit history.
4. `PatientMedication` — dispensed medicines linked to patients and catalog items.
5. `Catalog` — medicines and medical supplies.
6. `BorrowItem` — items in borrow records.
7. `BorrowReturn` — return entries linked to borrowed items.
8. `BorrowRecord` — borrower, due date, and status.
9. `PasswordResetOtp` — OTP/reset-token data; no active workflow currently writes to this table.

The active web application also uses `Nurse` for nurse names and `LegacyStorage` for shared page state. Keep both until their callers are migrated.

The unused empty normalized inventory/visit tables were removed after checking web routes and database row counts.