# Architecture — UniShare Uganda

This document explains how the system is put together and **why** each part is
shaped that way. It is the map a new developer should read before touching
code. Companion documents: [`history.md`](history.md) (how we got here) and
[`runbook.md`](runbook.md) (how to run and test it).

---

## 1. The stack, and why

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | **Flask 3** (sync, JSON API) | Mirrors `reference/project haily/`, our logic donor, so ports are verifiable line-by-line; tiny surface for a v1. |
| Database | **SQLite** via Flask-SQLAlchemy | Zero-ops for v1; single-writer is fine at this scale. Swapping to Postgres later only touches `SQLALCHEMY_DATABASE_URI`. |
| Auth | **Server-side sessions** (signed cookie) | Haily's model; keeps tokens out of JS entirely and makes role revocation instant (no client-held credentials to expire). |
| Frontend | **Static HTML in `pages/` + vanilla JS in `static/js/`** | The design donor was a static mockup; preserving its structure exactly was the requirement. No build step, no framework drift. |
| Styling | `static/css/style.css` — a copy of `reference/frontend/css/style.css` | Flask must serve assets itself; the `reference/frontend/` original is never modified. |
| Errors | JSON for `/api/*`, HTML for pages | Browsers show a friendly page; `fetch()` callers get machine-readable errors — one contract for each consumer. |

**Deliberately not used (v1):** JS frameworks, a build step, email/notifications,
background jobs. See the deferred list in `docs/migration_plan.md` §7.

---

## 2. Repository layout

```
app.py                  App factory: config, blueprint registry, error handlers
config.py               Env-driven config (APP_ENV profiles; SECRET_KEY required in production)
models.py               SQLAlchemy models — the 6 tables
init_db.py              Idempotent schema creation + seeds (7 schools, super admin)
requirements.txt        Exact pins

routes/
  auth.py               register / login / logout / me / change-password / profile / REDIRECT_MAP
  schools.py            GET /api/schools (registered onto auth_bp)
  resources.py          Public browse/detail/download + upvote/report/comments
  uploads.py            check-duplicate / upload / list own / edit / resubmit / withdraw
  admin.py              Moderation, reports, stats, user management (moderator + super admin)
  pages.py              Serves pages/*.html (path-traversal guard; / -> index or role landing)

pages/                  The live HTML (adapted from reference/frontend/ — design preserved)
static/css|js           The app's own assets (copies adapted to the real API)
templates/errors/       Styled 400/401/403/404/500 for page requests

utils/
  auth.py               Decorators: login/role/uploader/staff/super-admin required
  permissions.py        Resource-access predicates (can_user_access_resource, can_moderate_resource)
  file_handler.py       Secure filename + uuid storage, path resolution, delete

reference/              MIGRATION REFERENCE ONLY — never imported at runtime
  project haily/          the logic donor (original Flask app)
  frontend/, css/, js/, admin/, ignore_*   the design donors & legacy files — never modified
```

The `reference/` folder is the key invariant of this codebase: the live app
is `app.py` + `routes/` + `models.py` + `utils/` + `pages/` + `static/` +
`templates/` (+ `docs/` for documentation). Everything in `reference/` exists
so the sources of our logic and design stay inspectable.

---

## 3. Request lifecycle (two shapes)

**API shape** (`fetch()` from `static/js/*.js`):

```
browser fetch('/api/resources?…', {credentials:'same-origin'})
  → Flask routes/resources.py
  → decorator chain (login_required / role_required) → session lookup → role check
  → SQLAlchemy query (filters + pagination)
  → jsonify({'success': True, 'data': {…}})          [errors: {'success': False, 'message': …} + 4xx/5xx]
  → JS apiFetch() unwraps: ok ? data : throw Error(message)
  → page renders / toast shows the message
```

**Page shape** (navigating to `/browse.html`):

```
GET /browse.html
  → routes/pages.py  (safe_join against 'pages'; traversal → 404)
  → send_file(pages/browse.html)
  → main.js DOMContentLoaded: await fetchAuthState() (GET /api/auth/me)
  → renderHeader(page)  ← role-gated nav built here, per request
  → page script (browse.js etc.) pulls data from the API and renders
```

The header is rendered *client-side* from the session (not templated) so that
cached pages still show the correct logged-in state.

---

## 4. The data model (6 tables)

```
schools        school_id, school_name                       ← 7 seeded categories (from the design's JS)
users          user_id, full_name,
               student_number (unique, 10 digits, students) ← login identifier #1
               staff_id       (unique, staff accounts)      ← login identifier #2
               email (unique)                               ← login identifier #3 (institutional domain)
               password_hash, role, school_id,
               is_temp_password, temp_password_expires_at   ← staff onboarding mechanics
resources      resource_id, title, course_code, course_name, lecturer_name,
               academic_year, semester, resource_type, description,
               file_path, original_filename,
               status (pending|approved|rejected), rejection_reason,
               upvotes (denormalized counter), uploader_id, school_id,
               is_deleted, deleted_at, deleted_by, created_at
reports        report_id, resource_id, reporter_id, reason, comment, status(open|resolved), created_at
upvotes        upvote_id, resource_id, user_id  UNIQUE(resource_id, user_id)
comments       comment_id, resource_id, user_id, body, created_at, is_deleted
```

Design notes:

- **`resources.upvotes` is denormalized** on purpose (haily pattern): browse
  lists sort/count without a join; the `upvotes` table is the source of truth
  for "has *this* user voted" and the unique constraint makes double-votes
  impossible at the DB level.
- **Soft deletes everywhere** (`is_deleted` on resources and comments):
  moderation removes content from public view without destroying history —
  and `deleted_by`/`deleted_at` give an audit trail.
- **Rejection lives on the resource** (`rejection_reason`), not on a
  notification table — the uploader sees *why* directly in My Uploads.
- **Roles are a string column**, not a table: four literals only —
  `student`, `coordinator`, `moderator`, `super_admin` (haily's `class_rep`
  and `admin` were renamed; the old strings appear nowhere).

---

## 5. Roles & permissions (server-enforced)

| Action | Guest | Student | Coordinator | Moderator | Super Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Browse / detail / download (approved) / read comments | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upvote / comment / report | ❌ 401 | ✅ | ✅ | ✅ | ✅ |
| Upload / edit / resubmit / withdraw own | ❌ | ❌ | ✅ | ✅ | ✅ |
| Moderate queue, approve/reject/edit metadata | ❌ | ❌ | ❌ | ✅ own school | ✅ global |
| Soft-delete resources, view/resolve reports | ❌ | ❌ | ❌ | ❌ | ✅ |
| Users list, assign/revoke roles, create staff | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reset passwords (temp password) | ❌ | ❌ | ❌ | ❌ | ✅ |

Decorator map (`utils/auth.py`):

| Decorator | Roles allowed | Used for |
|---|---|---|
| `login_required` | any authenticated | upvote/report/comment, change-password, profile, stats gate |
| `uploader_required` | coordinator, moderator, super_admin | the whole uploads blueprint |
| `moderator_required` | moderator, super_admin | moderation queue, approve/reject/edit |
| `super_admin_required` | super_admin | reports, soft-delete, user management |
| `role_required([...])` | explicit list | the building block for all of the above |

**School scoping lives in the handlers, not the decorators**: moderators are
scoped by `resource.school_id == user.school_id` inside each moderation
endpoint; the super admin bypasses via the parallel `/api/super-admin/*`
endpoints. This keeps one mechanism (handler checks) for the rule that matters
most and a deliberate, explicit escape hatch for the platform-wide role.

**Revocation is immediate** because authorization is computed from the session
lookup on *every* request: change the role in the DB and the next request with
that session gets 403. There is no token cache to invalidate.

---

## 6. Authentication & the temp-password lifecycle

```
register(student)  → validated (10-digit number, @STUDENT_EMAIL_DOMAIN email,
                     school exists, unique number/email) → role=student → AUTO-LOGIN
login(identifier)  → matches student_number OR staff_id OR email
                   → generic 401 on any failure (no user enumeration)
                   → if is_temp_password and expired → 403 with a support message
                   → session[user_id, user_role, user_name, school_id]
                   → response includes must_change_password + role-based redirect_url
force-change       → POST /change-password (temp holders skip the current-password
                     check — they don't have one they chose)
                   → clears is_temp_password + expiry
create staff       → super admin POST /api/admin/users → 8-char secrets.choice
                     password, 24 h expiry, shown ONCE in the UI modal
reset password     → same generator; old password stops working immediately
```

`GET /api/auth/me` returns `{user, must_change_password}` — the frontend calls
it on every page load; a temp-password holder gets the non-dismissible
force-change modal wherever they land.

---

## 7. Files & uploads

- `config.MAX_CONTENT_LENGTH` caps requests at **16 MB**;
  `ALLOWED_EXTENSIONS` = pdf, doc, docx, ppt, pptx, txt, jpg, jpeg, png
  (the design's accepted formats — extended from haily's list).
- `save_uploaded_file()` keeps `secure_filename`, then **renames to
  `uuid4().hex + ext`** — user-supplied names never touch the disk, and
  collisions can't happen. The original name is kept in `original_filename`
  for the download experience.
- Files live under `uploads/resources/` (gitignored). The DB stores the
  *relative* path; `get_full_path()` resolves it against the app root.
- Downloads go through `GET /download/<id>` — the handler re-checks status
  and role **at download time**, then `send_file` streams with the original
  filename. Direct file URLs are never exposed.

---

## 8. Error handling & page serving

- `app.py` registers handlers for 400/401/403/404/500. Rule: **JSON envelope
  for `/api/*` (or JSON requests), styled HTML page otherwise.** Both use the
  same design chrome.
- `routes/pages.py` resolves `/x.html` to `pages/x.html` with `safe_join` —
  `..%2f`-style traversal is dead on arrival. `/` redirects to `index.html`
  (or the role's landing page when logged in).
- `REDIRECT_MAP` (routes/auth.py) is the single source of truth for
  post-login destinations: student → `/index.html`, coordinator →
  `/upload.html`, moderator → `/moderation_queue.html`, super admin →
  `/users.html`.

---

## 9. Frontend patterns (how JS talks to the backend)

- **`apiFetch(url, options)`** (main.js) is the only `fetch` wrapper:
  `credentials: 'same-origin'`, JSON headers unless FormData, and on non-OK it
  **throws `Error(message)` from the server's JSON** — so every caller's
  `catch` shows a human-readable toast.
- **`api` shim** keeps the design's original method names
  (`api.login`, `api.getMyUploads`, …) but their bodies are now real calls —
  the seam the design donor left us.
- **Session state**: `fetchAuthState()` caches `/api/auth/me` once per page;
  `renderHeader()` builds nav links per role; `requireAuth()` gates pages by
  redirecting to `/login.html`.
- **XSS discipline**: all interpolated strings go through `escapeHtml()`;
  icons are an inline-SVG `ICONS` map hydrated via `data-icon` attributes.
- Page scripts (`browse.js`, `upload.js`, `admin.js`, `users.js`, `auth.js`)
  follow one rhythm: fetch → render with design classes → delegate click
  events → toast the result → re-fetch. No state library, no routing.

---

## 10. Configuration & environments

| Variable | Default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | `production` forces DEBUG off and **requires** `SECRET_KEY` (boot fails without it) |
| `SECRET_KEY` | dev-only fallback | Signs the session cookie |
| `SUPER_ADMIN_PASSWORD` | `UniShare@2026` (dev) | Initial super admin password used by `init_db.py` |
| `STUDENT_EMAIL_DOMAIN` | `unishare.ug` | Registration email domain check |

SQLite lives at `unishare_uganda.db` (gitignored). To reset the world:
delete the file, run `init_db.py`, re-run the demo-account seed from
`docs/runbook.md` §3.

---

## 11. Testing posture

There is no CI suite yet (deliberate v1 scope); the guarantee instead is:
- **Every feature landed with an assertion-heavy curl/test-client run** whose
  exact status codes were checked (see `docs/history.md` per phase).
- `docs/runbook.md` §5–§6 is the manual regression script: it walks every role
  through every page with expected outcomes.
- To re-verify programmatically, the acceptance checklist pattern from
  Phase 8.2 (Flask `test_client` + asserts) is the template to turn into
  pytest files — each block maps 1:1 to a future test.
