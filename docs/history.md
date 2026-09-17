# Migration History — UniShare Uganda

This document tells the full story of how UniShare Uganda went from a static
design mockup to a full-stack application: what existed before, what decisions
were made and **why**, what was built in each phase and **how**, how every step
was tested, and where the final code deliberately differs from the original
plan. Anyone should be able to read this and understand not just *what* the
code does, but *why it is the way it is*.

---

## 1. The starting point (what we inherited)

The repository contained two unrelated codebases side by side:

### 1.1 `project haily/` — the logic donor (a complete Flask app)

A finished Flask 3 + SQLite application with:

- **App factory** (`create_app()`) and four blueprints: `auth`, `resources`,
  `uploads`, `admin`.
- **Five tables**: `schools`, `users`, `resources`, `reports`, `upvotes`.
- **Session-cookie auth** with role decorators
  (`class_rep_required`, `moderator_required`, `admin_required`).
- **A temp-password system**: staff accounts get an 8-character password
  generated with `secrets.choice`, valid 24 hours, forcing a change on login.
- **School-scoped moderation**: moderators only ever see/approve resources of
  their own school.
- A different identity: student numbers of *another* institution, roles named
  `class_rep`/`admin`, and its own Jinja templates and CSS (which we did **not**
  want).

### 1.2 The repo root — the design donor (a pure frontend mockup)

A fully designed but completely non-functional UI: every "API" was a mock backed
by `localStorage`, with hard-coded demo resources. Two parallel design systems
existed:

- Root `css/`, `js/`, `admin/` folders — a "library catalog" aesthetic with only
  two roles (student/moderator).
- A `frontend/` folder — a more polished "modern SaaS" aesthetic, whose
  `main.js` contained an **api shim** (a thin layer of `api.getSchools()`,
  `api.login()`, … functions) explicitly built so its bodies could later be
  swapped for real `fetch()` calls. Its field names were already snake_case,
  matching a Flask backend.

### 1.3 The problem to solve

> *Keep the design from the frontend mockup; keep the logic patterns from
> project haily; build a real backend at the repo root; never touch the design
> reference files; do it in small, tested, individually committed steps.*

---

## 2. The rules we committed to (and why)

These constraints came from the product owner before any code was written:

| # | Rule | Why it matters |
|---|------|----------------|
| 1 | **Friction-free access.** Browsing, viewing and downloading are free forever. An account is only needed to **upvote, comment, or report**. | The product's goal is maximum availability of educational resources; signup walls kill that. |
| 2 | **Roles are granted, not self-claimed.** `coordinator` and `moderator` exist only when the **super admin** assigns them — and revocation takes effect **immediately**. | Upload/moderation is a trusted privilege; the super admin must be able to pull it at any time. |
| 3 | **Comments are a new feature** (haily had none) built following haily's patterns. | Discussion was wanted; the migration was the moment to add it. |
| 4 | **Single university** (haily-style); university dropdowns stay cosmetic in the UI. | The schema models *schools* (faculties) within one institution, keeping the data model simple for v1. |
| 5 | **The design folders are never modified.** `frontend/`, `css/`, `js/`, `admin/` are reference-only. | The original mockups must keep working standalone; the live app gets *copies* adapted for the backend. |
| 6 | **Every step is tested, committed, and pushed on its own** — one commit per step, clean messages, no AI footers. | Each commit is revertible and reviewable; `git log` reads as the story of the build. |

---

## 3. Key decisions made up-front (the "why" behind the architecture)

Before Phase 0, a structured Q&A locked in the decisions that shaped everything:

1. **Which design?** → The `frontend/` folder's design. The other folders stay
   as references. *(Why: it was the more developed design and its api-shim gave
   us a clean seam to swap mocks for real HTTP.)*
2. **Where does the backend live?** → At the repository root. `pages/` serves
   the live HTML, `static/` serves the app's own CSS/JS copies.
   *(Why: simplest deployment and import model — `python app.py` from the root.)*
3. **Flask + SQLite mirroring haily?** → Yes.
   *(Why: the logic port is then line-by-line verifiable against haily, and
   SQLite keeps v1 dependency-free.)*
4. **Report requires an account?** → Yes, like upvote/comment.
   *(Why: reports trigger staff action; anonymous reports would be
   un-actionable and abuse-prone.)*
5. **Student numbers kept?** → Yes, haily's 10-digit student number +
   institutional email for registration; staff authenticate by Staff ID.
6. **Legacy root files?** → Renamed with an `ignore_` prefix (kept, not
   deleted) so nothing is lost and nothing old can be served by accident.

---

## 4. Phase-by-phase: what happened, how it was verified, and the commits

Every phase below lists: **Goal → What was built (how) → Verified how →
Commits.** All commits were pushed immediately after their tests passed.

### Phase 0 — Housekeeping & scaffolding

**Goal:** a clean root and a bootable Flask skeleton, before any feature work.

- **0.1** Renamed all 11 legacy root files to `ignore_*` with `git mv`
  (pure renames, no content changes — `git` tracks them as renames forever).
  - Commit `d97b553` — `chore: rename legacy root html/css/js files to ignore_* prefix`
- **0.2** Created `requirements.txt` with exact pins
  (Flask 3.0.0, Flask-SQLAlchemy 3.1.1, Flask-WTF 1.2.1, Werkzeug 3.0.1,
  python-dotenv 1.0.0), built `venv/`, wrote `.gitignore`
  (venv, db, uploads, pycache). A tracked `.vscode/settings.json` was
  deliberately *not* ignored (it is the Live Server port config).
  - Commit `6ddd86b` — `chore: add Python requirements and gitignore for Flask backend`
- **0.3** The skeleton: `config.py`, `models.py` (all six tables — including
  the new `comments` — with role literals `student|coordinator|moderator|super_admin`),
  `utils/` (auth decorators, permissions, file handler), four empty blueprint
  shells, `app.py` factory with haily's **JSON-vs-HTML error handler split**,
  and styled 404/500 error templates.
  - Commit `48e4cc8` — `feat: add Flask app skeleton with models, utils, and error handlers`
  - Commit `95d86e8` — `docs: add migration plan and reference folder gitignore` (versioned MIGRATION_PLAN.md)

**Verified:** the factory boots and lists routes; `/api/*` 404s return the JSON
envelope while page 404s return HTML — the error-handling contract held from
day one.

### Phase 1 — Auth (haily logic, frontend design)

**Goal:** registration, login, sessions, password handling — no feature code yet.

- **1.1 `init_db.py`** — idempotent: `db.create_all()`, seeds the **7 school
  categories taken from the frontend design's own JS**, and one super admin
  (`STF-SUPER-001` / `superadmin@unishare.ug`; password from
  `SUPER_ADMIN_PASSWORD` env, dev default printed once).
  - Commit `c100c1a` — `feat: add database init and seeding script`
- **1.2 Auth API** — `POST /api/auth/register` (validates the 10-digit student
  number, institutional email domain, password ≥ 8; **auto-logs-in** per the
  friction rule), `POST /api/auth/login` (identifier = student number **or**
  staff ID **or** email; generic error text; temp-password expiry check),
  `POST /logout`, `GET /api/auth/me`, `POST /change-password`, `PUT /api/profile`.
  - Commit `8040963` — `feat: add auth API endpoints (register, login, logout, password, profile)`
- **1.3 Login & register pages** — copied from `frontend/` into `pages/`, assets
  copied to `static/`, the api shim's auth bodies replaced with real `fetch()`.
  Added `routes/pages.py` (serves `pages/*.html` with a **path-traversal
  guard**), `routes/schools.py` (`GET /api/schools`), and the role-aware
  session header.
  - Commit `710142a` — `feat: add login and register pages wired to auth API`

**Verified:** 10/10 curl assertions (register, duplicate 409s, login, 401s,
me, logout, change-password, profile edit). Path traversal blocked; the
JSON/HTML error split held.

### Phase 2 — Public resources: browse, detail, comments

**Goal:** the entire guest journey and the account-gated interactions.

- **2.1** `routes/resources.py`: `GET /api/resources` (search + school/type
  filters + sorting + pagination), `GET /api/resources/<id>` (+related),
  `GET /download/<id>` (streams the file; public for approved resources only —
  pending ones visible to their uploader and same-school staff).
  - Commit `ec51c58` — `feat: add public resources API with filters and downloads`
- **2.1b** `POST /api/resources/<id>/upvote` (toggle; counter on the resource
  row + unique `(resource_id, user_id)` guard) and
  `POST /api/resources/<id>/report` (login required; reasons are **the
  frontend modal's labels**, not haily's; one open report per user/resource → 409).
  - Commit `a3df995` — `feat: add upvote toggle and report endpoints`
- **Comments (new feature)** — `Comment` model (soft-delete flag),
  `GET /api/resources/<id>/comments` (public read),
  `POST .../comments` (login; 1–2000 chars),
  `DELETE /api/comments/<id>` (author or same-school staff; soft delete).
  - Commit `1a67fd4` — `feat: add comments model, API, and page wiring`
- **2.2 Browse page** — server-backed search/filter/sort/pagination replacing
  the localStorage mock; vote buttons; mobile filter drawer.
  - Commit `2c183f5` — `feat: add browse page with server-backed search and filters`
- **2.3 Resource detail page** — download/upvote/share/report modal, related
  resources, and the comments section with the guest sign-in prompt.
  - Commit `a202d1f` — `feat: add resource detail page with comments UI`

**Verified:** 30+ curl assertions across the phase. Notably: upvote toggles
0→1→0; guests get 401 on upvote/comment/report while browse/download stay open;
pending resources are hidden from guests.

> **Plan note:** the original plan had a separate "Phase 3 — votes, reports,
> comments API". It was folded into Phase 2's commits because the browse/detail
> pages needed those endpoints in the same step to stay functional. Phase
> numbering from here on follows the plan's later phases.

### Phase 4 — Coordinator uploads

**Goal:** the upload pipeline with haily's duplicate detection.

- **4.1 Uploads API** — `POST /api/uploads/check-duplicate`,
  `POST /api/uploads` (extension whitelist, 16 MB cap, duplicate warning),
  `GET /api/uploads` (own uploads), `PUT /api/uploads/<id>` (edit → **status
  resets to pending** for re-moderation), `POST /api/uploads/<id>/resubmit`
  (rejected only), `DELETE /api/uploads/<id>` (**withdraw** — new soft-delete
  endpoint, pending only).
  - Commit `d4534c0` — `feat: add coordinator upload API with duplicate detection`
- **4.2 Upload page** — dropzone with client-side validation mirroring the
  server rules, live duplicate warning before submit, school locked to the
  coordinator's own.
  - Commit `22b2172` — `feat: add upload page wired to coordinator API`
- **4.3 My Uploads** — status tabs, summary cards, edit modal, resubmit,
  withdraw with confirm.
  - Commit `e3ad8ff` — `feat: add My Uploads page with status tabs, edit/resubmit, and withdraw`

**Verified:** role enforcement (student 403 on everything), validation 400s,
duplicate detection against real rows, withdraw soft-delete disappearing from
lists.

**Deliberate deviation:** `Resource` gained a nullable `description` column —
the frontend design's upload form has a description field that haily's schema
lacked. The design took precedence; the dev DB was reset (disposable data).

### Phase 5 — Moderation & super admin

**Goal:** haily's moderation lifecycle plus the full role-management story.

- **5.1 The admin API** (`routes/admin.py`):
  - Moderation queue for **moderators: school-scoped** (haily verbatim) and a
    parallel **`/api/super-admin/*` queue: global** with an optional school
    filter — because our super admin is a platform-wide role, not haily's
    per-school admin.
  - `approve` / `reject` (reason **required**, stored and surfaced to the
    uploader) / metadata edit / **soft-delete** (super admin only).
  - **Reports** (list + resolve) restricted to the super admin.
  - **Stats** endpoint: moderators get school-scoped counts; super admin gets
    global counts + user-role counts + open reports.
  - **User management**: list with search/role filter; `POST /api/admin/users`
    creates staff with a one-time 8-char temp password (24 h expiry);
    `assign-role` / `revoke-role` generalize haily's promote/demote
    (self-revocation and revoking a super admin are blocked);
    `reset-password` issues a new temp password.
  - Commit `00bff31` — `feat: add moderation, reports, and user-management APIs`
- **5.2/5.3 Moderation queue + Reports pages** — status tabs, type filter,
  bulk approve, reject modal (reason select + comment), edit-before-approve
  modal, stats row, super-admin school filter; reports table with
  open/resolved filter, resolve, and remove-resource. The JS picks
  `/api/admin/*` vs `/api/super-admin/*` based on the logged-in role.
  - Commit `66ef912` — `feat: add moderation queue and reports pages wired to staff APIs`
- **5.4/5.5 Users page + role-gated navigation** — stats cards, debounced
  search, assign coordinator/moderator, revoke-to-student, password reset with
  a **show-once** temp-password modal, add-staff modal with school picker.
  Header nav is built per role (guest → Browse/Login/Register; student →
  +Upload; coordinator → +My Uploads; moderator → +Moderation; super admin →
  +Users +Reports).
  - Commit `39dfa93` — `feat: add users page and role-aware navigation`

**Verified:** 25 API assertions. The two headline acceptance checks from the
plan both pass: *a moderator of school A cannot approve school B's resource
(403)*, and *revoking a staff role takes effect immediately (upload → 403 on
the next request)*.

**Deliberate deviation (found by testing, traced to the owner's rules):** the
original plan restricted uploads to coordinators, but the owner's rule states
super admin, moderators **and** coordinators all gain upload rights when
assigned. A new `uploader_required` decorator
(`['coordinator', 'moderator', 'super_admin']`) replaced the coordinator-only
guard on the whole uploads blueprint.

### Phase 6 — Profile

**Goal:** the profile page from the design, wired to real endpoints.

- Info card (name, email, school, role, member since) from `/api/auth/me`;
  **name-only** edit via `PUT /api/profile` (our schema intentionally has no
  course/year-of-study fields); contribution stats + recent uploads **only for
  roles with upload rights** (students can't upload, so the section is
  hidden rather than showing zeros); change-password modal; delete-account
  card present but **disabled** ("coming soon") — no backend endpoint was
  invented, per plan.
- **Bug fixed in passing:** `REDIRECT_MAP` still pointed moderators/super
  admins at the old `/admin/*` page routes — corrected to `/moderation_queue.html`
  and `/users.html`.
- Commit `761835e` — `feat: add profile page with edit and password change`

### Phase 7 — Hardening & cleanup

**Goal:** polish the rough edges that features leave behind.

- **7.1** Styled 400/401/403 error pages joined the existing 404/500.
  - Commit `68a7ea1` — `feat: add styled error pages`
- **7.2** The **force-change modal became global**: when `/api/auth/me`
  reports `must_change_password`, any page injects and opens the
  non-dismissible modal (the login page's own modal takes precedence via a
  double-bind guard).
  - Commit `0f78c0a` — `feat: add forced password change flow for temp passwords`
- **7.3** Production config: with `APP_ENV=production` the app **refuses to
  boot** without a `SECRET_KEY` env var and forces DEBUG off;
  `STUDENT_EMAIL_DOMAIN` became env-configurable.
  - Commit `c794e69` — `chore: production-ready config and env var handling`
- **7.4** README rewritten: architecture map, roles/permissions matrix, setup,
  env vars, full API surface, reference-folder policy.
  - Commit `fa46a8e` — `docs: rewrite README for full-stack architecture`

**Verified:** all five error templates render with design chrome; production
boot fails fast without the secret and boots clean with it; dev behavior
unchanged; temp passwords flagged by both `login` and `me`.

### Phase 8 — Final cleanup (run last)

**Goal:** leave a clean tree **without** destroying the references.

- **8.1** Removed, in **one revertible commit**: haily's diagnostic scripts
  (`check_db.py`, `check_templates.py`), its development SQLite database, its
  sample uploaded document, and accidentally-committed `__pycache__` binaries.
  The rest of `project haily/` stays as the logic reference — verified first
  that no runtime code imports it (grep: only provenance comments mention
  haily). The untracked `.kilo/` agent-tooling worktree was deleted locally.
  - Commit `ad5f7d0` — `chore: remove diagnostic scripts and dev database from reference folder`
- **8.2** The full acceptance checklist ran green — all ten checks (guest
  journey, gates, registration, student interactions, upload→moderation loop,
  reject-with-reason, role revocation immediacy, temp-password force-change,
  all pages on the design, clean one-commit-per-step history). One accuracy
  fix came out of it: the README's API list had invented
  `GET /api/resources/<id>/download`; the real public route is
  `GET /download/<id>`.
  - Commit `be247c4` — `docs: correct download and comment-delete routes in API list`

---

## 5. Where the final code differs from the original plan (and why)

| Deviation | Why |
|-----------|-----|
| Upload rights = coordinator **+ moderator + super admin** (`uploader_required`) | The owner's access rules grant upload to all three assigned roles; the plan's coordinator-only step was too narrow. Revocation semantics depend on this. |
| `resources.description` column added | The frontend design's upload form has a description field; haily's schema didn't. Design wins. |
| `/api/auth/me` returns `must_change_password` | Required so the force-change modal can fire on session restore (any page), not just right after login. |
| `moderator_required` includes `super_admin` | The super admin is a platform-wide role and must be able to moderate anywhere; school scoping is enforced inside the handlers instead. |
| Separate `/api/super-admin/*` queue/approve/reject endpoints | Haily's admin was per-school; our super admin is global. Parallel endpoints keep moderator scoping airtight while giving the super admin reach, with a school filter. |
| Reports management is super-admin-only (moderators excluded) | Matches the plan's change note; reports can trigger resource removal, which is a super-admin power. |
| `REDIRECT_MAP` paths corrected | Stale values pointed at the old `/admin/*` page routes that don't exist in the new layout. |
| Phases 3 folded into 2; error pages done early (0.3/7.1) | Keep-every-commit-functional principle: pages needed the endpoints; the error-handler split needed templates to render. |

## 6. How to extend this history

Future work should follow the same rhythm: **small step → verify (curl or the
browser, assert the exact status codes) → one clean commit → push.** The
"Open Items Deferred" list in `MIGRATION_PLAN.md` (multi-university model,
delete-account, email verification, CSRF tokens, production WSGI server) is
the natural backlog, in that order of likely demand.
