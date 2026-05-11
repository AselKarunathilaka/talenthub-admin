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
