# TalentHub

TalentHub is an internship management platform for SLT Mobitel trainee operations. It combines intern self-service, admin monitoring, gate-staff short-leave validation, attendance tracking, seat reservations, logbook submissions, reporting, and scheduled compliance checks in one full-stack application.


## Features

- Intern authentication with Google OAuth, plus email/password login for test accounts.
- Admin authentication with JWT-protected dashboards and management screens.
- Gate-staff login and approved short-leave pass validation.
- SLT Prohub trainee synchronization for active intern records.
- Intern profile management, team assignment, availability, and location mapping.
- **Face Recognition Attendance** with facial embedding (128-D vector), geolocation verification (2km radius from SLT), and 85% confidence threshold matching.
- QR-based attendance and meeting attendance capture.
- Daily logbook CRUD with PDF exports and institute-specific PDF templates.
- AI-assisted logbook quality validation with local heuristics and optional Gemini validation.
- Short-leave requests with NIC validation, proof document upload, approval flow, pass tokens, and PDF/Excel reports.
- Seat reservation for up to 96 seats with admin seat locking.
- Admin announcements with intern-facing active announcement feed.
- Weekly compliance, non-submission, and meeting attendance email reports.
- Excel/PDF exports for attendance, approved leave, on-leave interns, and non-attendance reports.
- Rotating short-lived PIN fallback for meeting attendance, with admin generate, rotate, stop, and validate controls.
- Certificate issuance and a public, token-based certificate verification portal for third parties.
- Project management module for intern project assignments, milestones, tasks, progress, and feedback.
- Federated login endpoint for the companion TalentHub mobile app.
- Admin manual and bulk attendance marking outside the Face/QR capture flow.
- Logbook restriction management, allowing admins to restrict or lift an intern's submission access with history tracking.
- Inactive-intern tracking and archival workflow.
- Admin-authored feature tips shown to interns on their next dashboard login.
- Public holiday calendar integration for attendance and logbook scheduling logic.

## Admin invitation email configuration

User Management sends a sign-in email when an Admin or Super Admin creates a Google Admin/Supervisor account. Configure the production admin login URL and SMTP relay as deployment secrets:

```env
ADMIN_PORTAL_URL=https://your-domain.example/admin-login
ADMIN_INVITE_EMAIL=talenthub@example.com
ADMIN_INVITE_SMTP_HOST=mail.example.com
ADMIN_INVITE_SMTP_PORT=25
```

For authenticated SMTP, also configure `ADMIN_INVITE_EMAIL_PASS`. When the dedicated invitation settings are omitted, the backend falls back to the existing `SHORT_LEAVE_EMAIL`, `SHORT_LEAVE_SMTP_HOST`, `SHORT_LEAVE_SMTP_PORT`, and `SHORT_LEAVE_EMAIL_PASS` settings. Never commit production credentials to the repository.
