# UniShare Uganda — Migration Plan (v1.0)

**Date:** 2026-09-17 · **Branch:** `fred` · **Status:** Planning complete, implementation not started

---

## 0. Purpose

Port the **full-stack logic** of `project haily/` (a working Flask + SQLite academic resource platform) onto the **frontend design** of the `frontend/` folder, adapted to this project's new business rules. **No styling comes from project haily** — every page must keep the `frontend/` design system. The old root design folders (`css/`, `js/`, `admin/`) are kept **as reference only** and are **never deleted**.

**Three Golden Rules for every step below:**
1. **Design = `frontend/` folder.** All HTML pages are adapted from `frontend/` pages, all styling from `frontend/css/style.css`. Nothing is styled from project haily.
2. **Logic = `project haily/`.** Port schemas, endpoints, permissions, and flows from haily, with the documented role/permission changes.
3. **One step = one commit.** Every numbered step ends with: run → verify → `git add` → `git commit` → `git push`. No step carries an AI footer (no "Generated with Codebuff" lines — clean messages only).

---

## 1. Source-of-Truth Summary (verified facts)

### 1.1 `project haily/` — Flask monolith (the logic donor)

```
project haily/
├── app.py            # create_app(), 4 blueprints, JSON/HTML error handlers, context processor
├── config.py         # SECRET_KEY, sqlite URI, UPLOAD_FOLDER (uploads/resources), 16 MB cap
├── models.py         # SQLAlchemy: School, User, Resource, Report, Upvote
├── init_db.py        # db.create_all() + seeds 7 schools + staff accounts (Nkumba@2026)
├── requirements.txt  # Flask 3.0.0, Flask-SQLAlchemy 3.1.1, Flask-WTF 1.2.1, Werkzeug 3.0.1
├── routes/
│   ├── auth.py       # /, /api/auth/login, /login, /register, /logout, /change-password, /profile, /api/profile
│   ├── resources.py  # /browse, /api/resources, /resource/<id>, /download/<id>, upvote/report/upvote-status
│   ├── uploads.py    # /upload, /my-uploads, /api/uploads CRUD, /api/uploads/check-duplicate
│   └── admin.py      # moderation queue, approve/reject/edit, users, promote/demote, reports, soft-delete, /api/admin/stats
├── utils/
│   ├── auth.py         # login_required, role_required(roles), student_required, class_rep_required, moderator_required, admin_required, staff_required, school_access_required
│   ├── permissions.py  # can_user_access_resource, user_belongs_to_school, can_moderate_resource, can_admin_resource
│   └── file_handler.py # ALLOWED_EXTENSIONS {pdf,doc,docx,ppt,pptx,txt}, save_uploaded_file (uuid), get_full_path, delete_file
├── static/js/{main,browse,upload,auth,admin,profile}.js   # fetch() clients for the /api endpoints
└── templates/          # Jinja2 (NOT to be copied; we keep static HTML + fetch instead)
```

**Verified schema (haily):**

| Table | Key columns |
|---|---|
| `schools` | school_id PK, school_name unique |
| `users` | user_id PK, full_name, student_number (10-digit, unique, nullable), staff_id (unique, nullable), email unique, password_hash, role default `student`, school_id FK→schools, is_temp_password, temp_password_expires_at, created_at |
| `resources` | resource_id PK, title, course_code, course_name, lecturer_name, academic_year, semester, resource_type, file_path, original_filename, status default `pending`, rejection_reason, upvotes (counter), uploader_id FK→users, school_id FK→schools, is_deleted, deleted_at, deleted_by, created_at, updated_at |
| `reports` | report_id PK, resource_id FK, reporter_id FK, reason, comment, status default `open`, created_at |
| `upvotes` | upvote_id PK, resource_id FK, user_id FK, created_at, **UNIQUE(resource_id, user_id)** |

**Verified roles in haily:** `student`, `class_rep`, `moderator`, `admin`. Every new account = `student`. Staff cannot self-register; seeded via `init_db.py`. Data isolation is per-`school_id` for staff.

**Verified API contract (haily):** JSON envelope `{success, message, data}`; paginated lists return `{resources|users|reports, total, pages, current_page}`; auth = Flask session cookie (`session['user_id']`); errors return proper HTTP status codes with JSON for `/api/*` paths.

### 1.2 `frontend/` — the design source (the design donor)

```
frontend/
├── css/style.css           # 681 lines, CSS vars: --color-primary #174A7E, teal, gold…
├── js/main.js              # 431 lines. HEADER/FOOTER renderer, ICONS (inline SVG), api shim, showToast, requireAuth
├── js/{browse,upload,auth,admin}.js
├── index.html, browse.html, resource_detail.html, upload.html, my_uploads.html,
│   profile.html, login.html, register.html
└── admin/{moderation_queue.html, reports.html}
```

Key design facts (verified):
- Pages are **static HTML** that mount header/footer via JS (`renderHeader()`/`renderFooter()` in `main.js`), use `data-page` on `<body>`, inline SVG icons via `data-icon="name"` hydration.
- `frontend/js/main.js` already defines an **`api` shim**: `getUniversities, getResources, getResource, getMyUploads, getNotifications, login, register, vote, report, submitResource` — each currently resolves from local arrays. **Migration = replace the bodies with `fetch()` calls. Nothing calling `api.*` changes.** This is the cleanest seam in the whole project.
- Frontend is **multi-university** in its mock data; per user decision the backend is **single-university** — university dropdowns stay in the UI but are cosmetic until scope expands (see §3 note).
- `frontend/` has **no** admin/users page, no moderation edit modal, no password-change UI beyond a stub, no my-uploads edit/resubmit wiring — those get built in `frontend/` design language during this migration.

### 1.3 Root directory — current state

| Item | What it is | Verdict |
|---|---|---|
| `index.html`, `browse.html`, `login.html`, `register.html`, `upload.html`, `my_uploads.html`, `profile.html`, `resource_detail.html` | Old-design pages using `css/style.css` + `js/` | Rename to `ignore_*` (kept, not deleted) |
| `css/`, `js/`, `admin/` | Old-design assets ("library-catalog" design) | **Keep as reference**, untouched |
| `frontend/` | New-design reference | **Keep as reference**, untouched; pages get *copied* from it into the live app |
| `style.css`, `script.js` | Unrelated "Arcode" navbar demo, referenced by nothing (only a `.kilo` worktree) | Rename `ignore_style.css` / `ignore_script.js` |
| `hildah.html` | Empty placeholder | Rename `ignore_hildah.html` |
| `.vscode/`, `.kilo/`, `README.md` | Tooling/config | Leave as-is |

---

## 2. Target Business Rules (user-confirmed decisions)

1. **Access without account (friction-free):** Browsing, searching, filtering, viewing detail pages, and **downloading** resources require **no login**.
2. **Account required for:** **upvoting**, **reporting**, and **commenting** (new feature).
3. **Roles:** `super_admin` (assign/revoke roles incl. moderators & coordinators; user management; reports), `moderator` (approve/reject/edit uploads in their school), `coordinator` (upload resources — replaces haily's `class_rep`), `student` (default for everyone who registers). Haily's `class_rep` promotion/demotion endpoints are re-purposed to coordinator assignment.
4. **Role revocation:** Super admin can revoke `moderator`/`coordinator` at any time; the user immediately loses the upload/moderation UI and API access (decorators enforce this server-side).
5. **Staff accounts:** Super admin can **either** create staff accounts directly (system generates a temp password, haily's 24h-expiry flow) **or** promote existing registered users into `moderator`/`coordinator` roles. Both paths exist.
6. **Registration = haily-style:** full name, 10-digit student number, institutional email, password. (University select removed — single-university scope; course/year optional profile fields may stay in UI but are not required by the backend.)
7. **New feature: Comments** on resources (haily has none). Built following haily's exact patterns: model + `/api/resources/<id>/comments` endpoints + frontend rendering. Only logged-in users can comment; anyone can read comments.
8. **Single university** (haily-style). Haily's `schools` table is kept and becomes this project's school/category table seeded with the school categories the design already uses (School of Computing, Business, Law, Health Sciences, Science, Education, Social Sciences).
9. **Stack:** Flask + SQLite (mirror haily), session-cookie auth, JSON APIs under `/api/`, uploaded files stored on disk under `uploads/resources/`.
10. **Reporting requires an account** (deviation from the friction-free rule, user-confirmed).

---

## 3. Target Architecture

```
<repo root>/
├── app.py                  # create_app() — haily's app.py adapted (blueprint names kept)
├── config.py               # haily's config.py, adjusted: school names, allowed extensions
├── models.py               # haily models + Comment model + role renames
├── init_db.py              # creates tables, seeds schools + super_admin account
├── requirements.txt
├── routes/
│   ├── __init__.py
│   ├── auth.py             # + role-assignment endpoints (super admin), staff account creation
│   ├── resources.py        # + comments endpoints
│   ├── uploads.py          # coordinator routes (haily's uploads.py, role renamed)
│   └── admin.py            # haily's admin.py adapted to super_admin/moderator/coordinator
├── utils/
│   ├── __init__.py
│   ├── auth.py             # haily's decorators + coordinator_required
│   ├── permissions.py      # haily's permission helpers adapted to new role names
│   └── file_handler.py     # copied from haily nearly verbatim
├── templates/              # NOT from haily! Only thin static shells if needed; primary flow = static HTML
├── static/
│   └── js/                 # the app's JS (adapted FROM frontend/js/*, keeping frontend patterns)
├── frontend/               # UNTOUCHED reference (design source of truth)
├── css/ js/ admin/         # UNTOUCHED reference (old design)
├── ignore_*.html/css/js    # renamed legacy root files
├── uploads/resources/      # uploaded files (gitignored)
└── unishare_uganda.db      # SQLite (gitignored)
```

**Serving strategy (decided):** Flask serves the adapted `frontend/`-design pages as **static HTML** (like the current mockup) that talk to `/api/*` via `fetch()`. Haily's Jinja templates are used **only** where server-side rendering is unavoidable: none identified — haily's own frontend is fully API-driven, so the whole UI can stay static. The context processor and `templates/` folder from haily are kept minimal for error pages (404/500) styled with the frontend design.

**API endpoint map (target = haily's, with renames/additions):**

| Haily endpoint | Target | Change |
|---|---|---|
| `POST /api/auth/login` | same | identifier = student_number/email; response adds role → redirect map |
| `GET/POST /register` | `POST /api/auth/register` | becomes JSON API; student_number 10-digit required |
| `POST /logout` | same | — |
| `GET/POST /change-password` | same | — |
| `PUT /api/profile` | same | — |
| `GET /api/resources` | same | **no login required** (haily required student role) |
| `GET /resource/<id>` | `GET /api/resources/<id>` | JSON; no login required |
| `GET /download/<id>` | same | **no login required** |
| `POST /api/resources/<id>/upvote` | same | login required (as haily) |
| `POST /api/resources/<id>/report` | same | login required (as haily) |
| — | `GET/POST /api/resources/<id>/comments` | **NEW**: GET public, POST login required |
| `DELETE /api/comments/<id>` | **NEW** | commenter deletes own comment; super_admin/moderator can delete any |
| `POST /api/uploads` etc. | same | `class_rep_required` → `coordinator_required` |
| moderation/approve/reject/edit | same | `moderator_required` |
| users/promote/demote | same | `admin_required` → `super_admin_required`; promote = assign coordinator/moderator; demote = revoke to student |
| — | `POST /api/admin/users` | **NEW**: super admin creates staff account directly (temp password flow) |
| `POST /api/admin/users/<id>/reset-password` | same | moderator/super admin |
| `GET /api/admin/stats` | same | `staff_required` (moderator+super_admin) |
| `GET /api/admin/reports*` | same | `super_admin_required` (was admin in haily) |

---

## 4. Phased Steps (each = run → test → commit → push)

> **Conventions for all steps**
> - Commands run from repo root.
> - Test = the step's *Verification* commands must pass before committing.
> - Commit messages are clean and descriptive (no AI footers).
> - `git push` after each commit (remote `origin`, branch `fred`).

### Phase 0 — Housekeeping & scaffolding

**Step 0.1 — Rename legacy root files**
- `git mv index.html ignore_index.html`, same for `browse.html, login.html, register.html, upload.html, my_uploads.html, profile.html, resource_detail.html, hildah.html, style.css → ignore_style.css, script.js → ignore_script.js`.
- Verify: `ls *.html` shows no stray root pages; `grep -r 'src="js/main.js"' --include="*.html" .` returns no root-level matches outside ignored/reference folders.
- Commit: `chore: rename legacy root html/css/js to ignore_*`
- **Note:** `git mv` on `index.html`→`ignore_index.html` collides with nothing; if a target name ever exists, rename in two moves.

**Step 0.2 — Python scaffolding**
- Create `requirements.txt` (haily's exact pins: Flask==3.0.0, Flask-SQLAlchemy==3.1.1, Flask-WTF==1.2.1, Werkzeug==3.0.1, python-dotenv==1.0.0).
- Create venv: `python3 -m venv venv && ./venv/bin/pip install -r requirements.txt`.
- Add root `.gitignore` entries: `venv/, __pycache__/, *.pyc, unishare_uganda.db, uploads/`, keep the existing `project haily/.gitignore` untouched.
- Verify: `./venv/bin/python -c "import flask, flask_sqlalchemy; print(flask.__version__)"` → `3.0.0`.
- Commit: `chore: add Python requirements and gitignore for Flask backend`

**Step 0.3 — Backend skeleton (haily files, adapted)**
- Copy & adapt from haily: `config.py` (rename DB file to `unishare_uganda.db`; ALLOWED_EXTENSIONS extended with `jpg/jpeg/png` to match the frontend design's accepted list; MAX 16 MB — the frontend mockup says 20 MB, use 16 MB and update the UI hint to "Maximum file size: 16 MB"), `models.py` (schema in §5), `utils/` (auth decorators with `coordinator_required` added, `super_admin_required` mapping, permissions.py, file_handler.py verbatim), `routes/__init__.py`, `app.py` (haily's, same 4 blueprints, same error handlers).
- `app.py` registers: `auth_bp, resources_bp, uploads_bp, admin_bp`; adds `@app.route('/<page>.html')`-style static serving config: set `static_folder='.'` is wrong — instead keep Flask default `static/` for the app's JS and serve the adapted HTML pages via a small `pages_bp` blueprint that `send_from_directory`s the root-level HTML files (see Step 2.x for page list).
- Verify: `./venv/bin/python -c "from app import create_app; app = create_app(); print(sorted(str(r) for r in app.url_map.iter_rules()))"` runs without error.
- Commit: `feat: add Flask app skeleton with models, utils, and error handlers`

### Phase 1 — Auth (haily logic, frontend design)

**Step 1.1 — Database init script**
- `init_db.py`: `db.create_all()`, seed schools (the 7 category names from the design), seed one `super_admin` user (staff_id + email + hashed password read from `SUPER_ADMIN_PASSWORD` env var, falling back to a printed default), print credentials.
- Verify: run `./venv/bin/python init_db.py` twice — second run must be idempotent (no duplicates); `./venv/bin/python -c "import sqlite3; c=sqlite3.connect('unishare_uganda.db'); print([r[0] for r in c.execute('SELECT name FROM sqlite_master WHERE type=\"table\"')])"` lists all 6 tables.
- Commit: `feat: add database init and seeding script`

**Step 1.2 — Auth API (register/login/logout/password/profile)**
- Port haily `routes/auth.py` with changes:
  - `POST /api/auth/register` (JSON): validate full_name ≥3 chars, student_number exactly 10 digits & unique, email valid + unique, password ≥8. Role = `student`. Returns 201 + auto-login session.
  - `POST /api/auth/login`: identifier (student_number OR email) + password; generic 401 message; temp-password expiry check; response `{user_id, role, redirect_url}` with redirect map: student→`/index.html`, coordinator→`/upload.html`, moderator→`/admin/moderation_queue.html`, super_admin→`/admin/users.html`.
  - `/logout`, `/change-password`, `PUT /api/profile` — verbatim logic from haily.
- Verify (curl): register → 201; duplicate student_number → 409; login wrong password → 401; login correct → 200 with role; `GET /api/auth/me` (add tiny helper) → current user JSON; logout → session cleared.
- Commit: `feat: add auth API endpoints (register, login, logout, password, profile)`

**Step 1.3 — Login & register pages (frontend design)**
- Copy `frontend/login.html` + `frontend/register.html` to root; rewrite their inline `<script>` sections to call the real API via the shared `api()` helper: login posts `{identifier, password}`, handles `must_change_password` (force-change modal — build it now in frontend design), redirects by `role`.
- Register form: keep frontend's visual layout, swap the University select for the **Student Number** field (10-digit validation), keep course/year as optional, submit JSON to `/api/auth/register`.
- Header auth-state: `renderHeader()` in the app's `static/js/main.js` (adapted from `frontend/js/main.js`) calls `GET /api/auth/me` on load instead of localStorage; shows Login/Register links for guests, Profile/Logout for users, and Moderator/Super Admin links by role.
- Verify (browser): guest header shows Login/Register; register → auto-login → header updates; logout works; wrong-password shows alert box (frontend pattern).
- Commit: `feat: add login and register pages wired to auth API`

### Phase 2 — Resources: browse, detail, download (no login)

**Step 2.1 — Resources API (public)**
- Port haily `routes/resources.py` with changes: remove `student_required` from `get_resources`, `resource_detail`, `download_resource` (public per §2.1); keep filters (search/school/course/type/semester/year/sort) and pagination exactly as haily; detail returns resource JSON + related-by-course list.
- Verify (curl): `GET /api/resources` with no session → 200 JSON; filters work (`?search=database`, `?resource_type=Past%20Paper`); `GET /download/<id>` streams a seeded test file.
- Commit: `feat: add public resources API with filters and downloads`

**Step 2.2 — Browse page**
- Copy `frontend/browse.html`; adapt `frontend/js/browse.js` into `static/js/browse.js`: replace `browseState.all = RESOURCES` with `api.getResources(params)` fetch of `/api/resources`, keep the whole filter UI as-is (university select becomes cosmetic), pagination now server-driven (`page`, `pages` from response), vote buttons render state from `GET /api/resources/<id>/upvote-status` when logged in.
- Verify (browser): filters/search/sort/pagination all work against the API; empty state shows when no results.
- Commit: `feat: add browse page with server-backed search and filters`

**Step 2.3 — Resource detail page + Comments UI**
- Copy `frontend/resource_detail.html`; replace inline script with API-driven render: fetch `/api/resources/<id>`, hydrate all meta fields, Download button → `window.location = /download/<id>`, Upvote button wired to toggle endpoint (login-required toast pattern already exists in the design), Share button kept.
- **Build the Comments section** (new feature, frontend design): comment list + "Sign in to comment" prompt for guests + textarea + submit for logged-in users; delete button on own comments; comments render with name, date, text; `renderPagination` not needed (simple list, newest last or first — pick first).
- Verify (browser): guest sees "login to comment" prompt; logged-in user posts a comment, it appears; delete own comment works.
- Commit: `feat: add resource detail page with comments UI`

### Phase 3 — Votes, reports, comments API

**Step 3.1 — Upvote & report endpoints**
- Port haily's `upvote_resource` (toggle) and `report_resource` (login required, valid-reason list, duplicate-open-report 409) verbatim; `upvote-status` endpoint verbatim.
- Reason list: unify haily's (`Wrong academic material, Duplicate resource, Inappropriate content, Incorrect course information, Copyright/problematic material, Other`) with the frontend modal's options (Wrong course, Outdated, Incorrect content, Duplicate, Inappropriate, Other) — **use the frontend's labels**, mapped in `routes/resources.py`.
- Verify (curl): upvote → count+1; repeat → toggles off; report with invalid reason → 400; duplicate open report → 409; anonymous report/upvote → 401.
- Commit: `feat: add upvote toggle and report endpoints`

**Step 3.2 — Comments model & endpoints**
- Add to `models.py`:
  ```python
  class Comment(db.Model):
      __tablename__ = 'comments'
      comment_id = db.Column(db.Integer, primary_key=True)
      resource_id = db.Column(db.Integer, db.ForeignKey('resources.resource_id'), nullable=False)
      user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
      body = db.Column(db.Text, nullable=False)   # 1..2000 chars, validated
      created_at = db.Column(db.DateTime, default=datetime.utcnow)
      is_deleted = db.Column(db.Boolean, default=False)   # soft-delete for audit
      # to_dict(): {comment_id, resource_id, user_id, user_name, body, created_at}
  ```
- Endpoints in `routes/resources.py` following haily patterns: `GET /api/resources/<id>/comments` (public, no login, ordered newest-last, excludes soft-deleted), `POST /api/resources/<id>/comments` (`login_required`, 1–2000 chars), `DELETE /api/comments/<id>` (owner or staff).
- Wire the Step 2.3 UI to these endpoints.
- Verify (curl): POST without login → 401; with login → 201; GET is public; DELETE by non-owner → 403; owner → 200.
- Commit: `feat: add comments model, API, and page wiring`

### Phase 4 — Coordinator uploads

**Step 4.1 — Uploads API (coordinator)**
- Port haily `routes/uploads.py` replacing `class_rep_required` → `coordinator_required` everywhere; keep: validation rules, `save_uploaded_file`, `check-duplicate`, `PUT /api/uploads/<id>` (edit + optional file replacement + auto re-pending), `POST /api/uploads/<id>/resubmit`, `GET /api/uploads` (own uploads, paginated, status filter).
- Verify (curl): as student → POST /api/uploads = 403; as coordinator → 201 + file lands in `uploads/resources/`; duplicate check returns matches; resubmit only for rejected.
- Commit: `feat: add coordinator upload API with duplicate detection`

**Step 4.2 — Upload page (frontend design)**
- Copy `frontend/upload.html`; adapt `frontend/js/upload.js`: real `FormData` POST to `/api/uploads` (keep the design's dropzone, file chip, duplicate warning — wire duplicate warning to `/api/uploads/check-duplicate`), success block shows pending-moderation message, redirect to My Uploads.
- Verify (browser): coordinator can drag-drop a PDF and submit; student gets 403 toast + redirect.
- Commit: `feat: add upload page wired to coordinator API`

**Step 4.3 — My Uploads page (frontend design)**
- Copy `frontend/my_uploads.html`; wire table to `GET /api/uploads` (status tabs → `?status=`, sort select), summary cards from response totals, rejection reason display, **Edit** opens an edit modal (frontend design) that PUTs metadata + optional file, **Resubmit** for rejected, **Withdraw** = `DELETE /api/uploads/<id>` (new: soft-delete own upload when pending — add this endpoint).
- Verify (browser): all four status tabs filter; rejected shows reason; edit modal round-trips; withdraw removes from list.
- Commit: `feat: add my-uploads page with edit, resubmit, and withdraw`

### Phase 5 — Moderation & super admin

**Step 5.1 — Moderation queue API (moderator, school-scoped)**
- Port haily `routes/admin.py` moderation endpoints verbatim (school isolation included): `GET /api/admin/moderation-queue`, `POST .../approve`, `POST .../reject` (reason required), `PUT /api/admin/resources/<id>` (metadata edit), soft-delete, reports list/resolve.
- Change: `admin_required` → `super_admin_required`; role checks for `moderator` stay; reports management restricted to `super_admin`.
- Verify (curl): moderator of school A cannot approve school B's resource (403); approve/reject/edit flows work; stats endpoint returns school-scoped counts.
- Commit: `feat: add moderation queue, approve/reject, and reports APIs`

**Step 5.2 — Moderation queue page (frontend design)**
- Copy `frontend/admin/moderation_queue.html`; adapt `frontend/js/admin.js`: fetch queue with status tabs (pending/approved/rejected), school-scoped filters (type; university filter becomes cosmetic), approve/reject modal (reason select + comment), edit-before-approve modal (metadata form), bulk approve of selected, stats row from `/api/admin/stats`.
- Verify (browser): moderator sees only their school's queue; approve → disappears from pending and appears in browse; reject requires reason; edit modal round-trips.
- Commit: `feat: add moderation queue page wired to moderator APIs`

**Step 5.3 — Reports page (super admin, frontend design)**
- Copy `frontend/admin/reports.html`; wire to `GET /api/admin/reports` (status filter), Resolve and Remove (soft-delete) actions from haily, reason chips + reporter info from `to_dict()`.
- Verify (browser): super admin sees reports grouped per resource row; resolve toggles status; remove hides resource from browse.
- Commit: `feat: add reports page for super admin`

**Step 5.4 — User management (super admin) — assign/revoke roles + staff creation**
- Build new page `admin/users.html` (frontend design, modeled on the design's table patterns from `frontend/my_uploads.html` + `frontend/admin/reports.html`): stats cards (students/coordinators/moderators/super admins), search + role filter, table rows with actions:
  - student → **Assign Coordinator** / **Assign Moderator**
  - coordinator/moderator → **Revoke to Student**
  - any → **Reset Password** (generates temp password; show-once modal)
  - **Add Staff** button → modal (frontend design) with Full name / Staff ID / Email / Role / School → `POST /api/admin/users` creating the account with a generated temp password (haily's `secrets.choice` 8-char generator + 24h expiry).
- Backend: add `POST /api/admin/users` (staff creation); rework promote/demote to `POST /api/admin/users/<id>/assign-role` and `POST /api/admin/users/<id>/revoke-role` (haily's promote/demote logic generalized; both school-scoped; only super_admin; cannot revoke self; cannot revoke the last super_admin).
- Verify (curl): assign coordinator on a student → role changes; revoke → student loses upload access (403 on `/api/uploads` immediately); staff creation returns temp password once; reset-password flow works; non-super-admin gets 403.
- Commit: `feat: add user management with role assignment, revocation, and staff creation`

**Step 5.5 — Users page wiring + role-gated navigation**
- Wire the page from 5.4 fully (fetch, render, modals).
- Update the app's `static/js/main.js` header: nav links per role — guest: Browse/Login/Register; student: Browse/Upload**\*** see below; coordinator: +My Uploads; moderator: +Moderation Queue; super_admin: +Users +Reports.
- Verify (browser): nav changes live per role after login/logout.
- Commit: `feat: add users page and role-aware navigation`

### Phase 6 — Profile

**Step 6.1 — Profile page (frontend design)**
- Copy `frontend/profile.html`; wire: `GET /api/auth/me` for info, `PUT /api/profile` for edit form, change-password modal → `/change-password` (with current-password field), contribution stats from `GET /api/uploads?per_page=100` totals, recent uploads list, delete-account **hidden for v1** (haily has no endpoint; keep the design's card but disable with a tooltip "coming soon" — or skip the card; do not invent backend).
- Verify (browser): edit name persists after reload; password change works; stats match My Uploads.
- Commit: `feat: add profile page with edit and password change`

### Phase 7 — Hardening & cleanup

**Step 7.1 — Error pages & 404 fallback**
- Create `templates/errors/400/401/403/404/500.html` **styled with frontend design tokens** (copy the design's header/footer mounts + alert styles); haily's error handlers in `app.py` already route here.
- Verify: `/nonexistent` returns styled 404; API 404s return JSON.
- Commit: `feat: add styled error pages`

**Step 7.2 — Temp-password force-change UX**
- Ensure the `must_change_password` login response opens a non-dismissible force-change modal (frontend design; haily's `auth.js` logic + `closeModal` guard), posting to `/change-password`.
- Verify: login as temp-password account → modal appears and cannot be dismissed; after change, session works normally.
- Commit: `feat: add forced password change flow for temp passwords`

**Step 7.3 — Production config pass**
- `config.py`: `SECRET_KEY` from env only (fail fast if unset in prod profile), `DEBUG` off; document env vars in README section (SECRET_KEY, SUPER_ADMIN_PASSWORD).
- Verify: app boots with env vars set; grep confirms no hardcoded prod secret.
- Commit: `chore: production-ready config and env var handling`

**Step 7.4 — README rewrite**
- Document: architecture, roles/permissions matrix, setup (`python3 -m venv`, `pip install`, `init_db.py`, `flask run`), API list, the friction-free access rules, and the reference-folder policy (`frontend/`, `css/`, `js/`, `admin/`, `ignore_*` are reference-only).
- Commit: `docs: rewrite README for full-stack architecture`

### Phase 8 — Final cleanup (run LAST, only after everything works)

**Step 8.1 — Remove redundant reference artifacts (careful phase)**
Nothing from the following list is load-bearing for the new app. Verify with grep before deleting; then delete in ONE commit so it's revertible:
- `project haily/unishare_nkumba.db` (binary DB), `project haily/uploads/` (sample .docx), `project haily/check_templates.py`, `project haily/check_db.py` (diagnostic scripts) — the rest of `project haily/` **stays** as the logic reference.
- `.kilo/worktrees/` (agent tooling artifacts, gitignored or removable — check `git ls-files .kilo` first; if untracked, just delete locally, no commit needed).
- Do **NOT** touch: `frontend/`, `css/`, `js/`, `admin/`, `ignore_*` files (user explicitly keeps these as design references).
- Verify: `grep -rn "haily" --include="*.py" . | grep -v "project haily"` → empty (no runtime dependency); app boots and all flows still work after deletion.
- Commit: `chore: remove diagnostic scripts and dev database from reference folder`

**Step 8.2 — Final acceptance checklist (no commit; fix anything that fails)**
Run through the complete user journey:
- [ ] Guest: browse, search, filter, open detail, **download** — no login prompts
- [ ] Guest: sees "sign in to upvote/comment/report" prompts
- [ ] Register with 10-digit student number → auto-login
- [ ] Student: upvote toggles, comment posts/deletes, report submits
- [ ] Coordinator (assigned by super admin): upload appears in My Uploads as pending
- [ ] Moderator (assigned by super admin): sees queue, approves → resource visible in browse; reject with reason → uploader sees reason
- [ ] Super admin: creates staff account (temp password), assigns/revokes roles — revoked user immediately loses API access (403)
- [ ] Temp-password login forces change modal
- [ ] All pages match the `frontend/` design (header/footer, buttons, cards, badges)
- [ ] `git log --oneline` shows one clean commit per step

---

## 5. Target Schema (complete, final)

```python
# schools        — haily verbatim, seeded with the 7 school-category names from the design
# users          — haily verbatim, role values: student | coordinator | moderator | super_admin
# resources      — haily verbatim (status pending/approved/rejected, soft-delete, upvote counter)
# reports        — haily verbatim (reason from frontend's label set, status open/resolved)
# upvotes        — haily verbatim (UNIQUE(resource_id, user_id))
# comments       — NEW (see Step 3.2): comment_id, resource_id FK, user_id FK, body, created_at, is_deleted
```

Haily's `class_rep` string never appears in the target codebase; the four role literals are exactly: `'student'`, `'coordinator'`, `'moderator'`, `'super_admin'`.

**Permission matrix (server-enforced):**

| Action | Guest | Student | Coordinator | Moderator | Super Admin |
|---|---|---|---|---|---|
| Browse/search/view/download | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read comments | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upvote | ❌ | ✅ | ✅ | ✅ | ✅ |
| Comment | ❌ | ✅ | ✅ | ✅ | ✅ |
| Report | ❌ | ✅ | ✅ | ✅ | ✅ |
| Upload / edit / resubmit own | ❌ | ❌ | ✅ | ❌ | ❌ |
| Approve/reject/edit metadata (own school) | ❌ | ❌ | ❌ | ✅ | ✅ |
| View reports, resolve, soft-delete | ❌ | ❌ | ❌ | ❌ | ✅ |
| Assign/revoke roles, create staff, reset passwords | ❌ | ❌ | ❌ | reset only | ✅ |

---

## 6. Rollback Safety

- Every phase is an independent series of commits; `git revert <commit>` restores any step.
- The design references (`frontend/`, `css/`, `js/`, `admin/`) are never modified by any step — worst case, the whole backend can be deleted and the reference mockups still run as before.
- Phase 8 (cleanup) deletes only diagnostic files inside `project haily/`; `git revert` of that single commit restores them.

---

## 7. Open Items Deferred (explicitly out of scope for v1)

1. Multi-university data model — the single-university decision stands; the university `<select>`s remain in the UI but filter nothing until a `universities` table is added later.
2. Delete-account endpoint (haily has none).
3. Email verification / password-reset-by-email (needs an email provider; haily resets via temp passwords instead).
4. CSRF tokens on JSON APIs (haily sets `WTF_CSRF_ENABLED = True` but never uses Flask-WTF forms on the API; session cookies are `SameSite=Lax` by default, matching haily's own behavior).
5. Production WSGI server (gunicorn/waitress) — document only.
