# Database Specification: First Aid & Medicine Management System (FMS)

## Tech Stack
- Database: PostgreSQL
- ORM: Prisma ORM (`schema.prisma`)

## Requirements by Module

### Step 1: Core Users and Activity Log
- `User` model: staff and nurses (id, employeeId, name, email, password_hash, role, created_at, updated_at).
- `ActivityLog` model: audit log tracking user actions (who did what, when, entity_type, entity_id).
- Relationship: User has many ActivityLogs.

### Step 2: Stock & Catalog Module
- `Category` model: Oral Medicine, Topical Medicine, Medical Supplies, Equipment.
- `Item` model: product info, unit of measurement, linked to Category.
- `StockBatch` model: linked to Item, tracks specific batches, expiration dates, and current stock quantity.
- `StockTransaction` model: logs stock intake/adjustment, links to User, Item, and StockBatch.

### Step 3: Infirmary Visit Module
- `Patient` model: students/employees who visit (personal info, allergies).
- `Visit` model: symptoms, diagnosis, treatment notes, referral status, linked to Patient and User (nurse).
- `Dispensation` model: tracks medicines given per visit. Many-to-Many between Visit and StockBatch (records quantity dispensed).

### Step 4: Borrow & Return Module
- `BorrowRecord` model: links to User (staff processing), Patient (borrower), dates (borrowed, expected return, actual return), and status (BORROWED, RETURNED, LATE).
- `BorrowItem` model: links BorrowRecord to Item, quantity borrowed, return condition.

### Step 5: Duty Shift Module
- `Shift` model: work time slots (date, start_time, end_time, shift_type).
- `ShiftAssignment` model: links Shift to User (nurse), attendance status (SCHEDULED, PRESENT, ABSENT).

## Instructions for AI
Generate a valid, production-ready `schema.prisma` file incorporating all models above with standard relations, primary keys (UUID or Autoincrement), foreign keys, updated_at/created_at timestamps, and proper indexes for performance.