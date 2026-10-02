# Firebase authentication and access control roadmap

## Decisions confirmed

- Firebase Authentication remains the identity provider.
- Keep email/password and Google sign-in.
- Use two application roles: `ADMIN` and `NURSE`.
- Anyone may self-register and, after Firebase verifies their email, sign in immediately. Self-registered accounts receive `NURSE` by default.
- The first administrator is `66200193@kmitl.ac.th`; only a Firebase-verified identity with this email receives `ADMIN` on first API sign-in.
- Self-registration is open to all verified email addresses. Every such account can access the patient records available to nurses.
- Move duty shifts and color assignments to PostgreSQL through the API; PostgreSQL is the single application database.

## Current state found in the repository

- The active interface is the static app under `Front-end/`.
- Firebase sign-in is present, but protected API requests do not verify Firebase identity.
- Several API routes can read or change patient, stock, borrow/return, and shared legacy-storage data without authentication.
- Admin-only page checks rely on a value in `sessionStorage`, which a browser user can edit.
- A demo-admin path is hardcoded in frontend JavaScript.
- Prisma has one `User` model mapped to the existing Firebase-linked PostgreSQL `"User"` table.
- Duty data is currently local to the browser (`FMSStorage`) with a dormant Firestore implementation. The Prisma schema has a `DutyShift` table tied to `User`.
- The active duty page now uses the PostgreSQL-backed storage API only. Local Firestore rules deny client access; this does not delete existing Firestore documents.
- Backend Firebase Admin credentials are not configured in the local backend environment, so the API cannot verify Firebase identities or create sessions yet.

## Proposed permission matrix

| Area | Nurse | Admin |
| --- | --- | --- |
| Patient and visit records | Read and record care; update assessment and visit details | All nurse permissions; correct and remove records where policy allows |
| Medicine catalog and dispensing | Read catalog; dispense during a visit | All nurse permissions; add/edit/remove catalog and adjust inventory |
| Borrow and return | Record borrowing and returns; read history | All nurse permissions; correct/remove records |
| Duty calendar | Read calendar; create/update own duty entries and color | Read and manage all entries and color assignments |
| Accounts and roles | Read own profile | Create/disable accounts and assign roles |
| System settings and audit | No access to administration controls | Read/manage settings and audit records |

This is a proposed starting point based on the existing screens. Confirm the intended edit/delete rules before enforcing the matrix on clinical records.

## Implementation order

1. Signup boundary and initial administrator identity are confirmed. Immediate public signup with nurse access exposes patient data to anyone who can create and verify a Firebase account; the owner explicitly chose that access model.
2. Consolidate application authorization around one PostgreSQL identity-to-role record keyed by Firebase UID. Preserve existing data and migrate roles without deleting either legacy model during the first pass.
3. Add a server-verified Firebase session for the web app, CSRF protection for writes, logout/revocation handling, and API authentication middleware.
4. Enforce role checks on every patient, stock, borrow/return, settings, and user-management API route. Treat legacy-storage keys as explicit permissions; do not let a generic key/value route bypass them.
5. Replace browser-only admin checks and the demo-admin login with the server profile/role response. Keep both Firebase login providers.
6. Move duty records and color uniqueness to PostgreSQL transactions and API routes. The web client no longer calls Firestore; import any old Firestore duty documents before treating the migration as complete.
7. Configure backend secrets through environment/secrets management; do not commit Firebase service-account keys or SMTP credentials. Decide whether password reset stays on Firebase-native flows or retains the custom OTP implementation.
8. Migrate/backfill existing account roles and duty data, review access with the owner, then enable the protections in the running environment.

## Open decisions

- Are nurses allowed to edit/delete existing patient records and inventory, or only add visits and dispense stock?

## Local configuration still needed

The backend must receive Firebase Admin credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`) to verify ID tokens and issue sessions. These values belong in the ignored `Back-end/.env`; the initial administrator email allowlist is set there. Signup email verification and password resets now use Firebase's client SDK, so an SMTP server is not needed. The submitted password was not copied into the repository or environment files.
