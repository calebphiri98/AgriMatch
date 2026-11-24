# Source-to-source migration notes

Original source inspected: `AgriMatch.rar` (PHP, MySQLi, Bootstrap and PHPMailer).

- Original PHP database constructor creates 7 tables. Equivalent tables are in `database/schema.sql`; an eighth `stored_files` table is new for persistent private uploads.
- UI preserves the main colours: green `#176B45`, cream `#F7F5ED`, yellow `#F2BD4B`; responsive navigation and spacing were added.
- Authentication uses hashed passwords and JWT instead of PHP session cookies.
- Farmer and buyer registration retain their distinct required identity documents and administrator review.
- Matching engine port retains crop-only filtering, aggregated supply, unit conversion, bidirectional requests, other-side approval and post-acceptance contact disclosure.
- Administration retains review, moderation, status changes, and summary reporting. Reporting now converts weight-based amounts to kilogram equivalents and labels crates separately instead of summing incompatible units.
- Notifications support Gmail SMTP, Brevo and Resend using private backend environment variables; Neon/Render credentials are never embedded into frontend files.
- **Original upload images and identity documents were not copied into the ZIP**, because they may identify real users; a separate authorised transfer is needed for data migration.

## Scope and limitations

Automated unit tests verify the matching calculations and file/role design at source level. Frontend syntax was checked as JSX and backend scripts passed Node syntax checks. Live Neon, browser build and cross-role end-to-end testing require a database connection and npm dependencies on the destination machine. Do not present those as completed tests without actually running them.
