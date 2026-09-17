# UNISHARE-UGANDA

Crowdsourced, verified class notes and past papers for universities in Uganda.
Browsing and downloading are free for everyone — no account needed. An account
is only required to upvote, comment, or report a resource.

## Architecture

Flask 3 + SQLite + Jinja2 + vanilla JS (design adapted from the
`reference/frontend/` mockup). Session-cookie auth; JSON REST API under `/api/*`
consumed by the static pages via `fetch()`.

```
app.py                 App factory: blueprint registry, JSON/HTML error split
config.py              Env-driven config (SECRET_KEY required in production)
models.py              6 tables: schools, users, resources, reports, upvotes, comments
init_db.py             Idempotent DB init + seed (7 schools, super admin)
routes/
  auth.py              register/login/logout/me/change-password/profile, /api/schools
  resources.py         Public browse/detail/download + upvote/report/comments
  uploads.py           Upload/edit/resubmit/withdraw (upload roles only)
  admin.py             Moderation, reports, stats, user management
  pages.py             Serves pages/*.html with a path-traversal guard
  schools.py           GET /api/schools
static/css, static/js  The app's own styling/scripts (adapted from frontend/)
pages/                 Live HTML pages (frontend design)
templates/errors/      Styled error pages (HTML for pages, JSON for /api/*)
reference/             Migration-era reference material (see below)
docs/                  History, architecture, runbook, original migration plan
```

### The `reference/` folder (do not edit)

Everything the project was built *from* lives here, kept for traceability:

- `reference/project haily/` — the original Flask app whose logic was ported
- `reference/frontend/`, `reference/css/`, `reference/js/`, `reference/admin/`
  — the original design mockups the live pages were adapted from
- `reference/ignore_*` — the legacy root files, renamed at migration start

None of it is imported or served at runtime; the live app serves its assets
from `static/` and its pages from `pages/`.

## Roles & permissions

| Action                          | Guest | Student | Coordinator | Moderator | Super Admin |
|--------------------------------|:-----:|:-------:|:-----------:|:---------:|:-----------:|
| Browse / view / download       | ✅    | ✅      | ✅          | ✅        | ✅          |
| Upvote / comment / report      | ❌    | ✅      | ✅          | ✅        | ✅          |
| Upload educational resources   | ❌    | ❌      | ✅          | ✅        | ✅          |
| Withdraw / edit own uploads    | ❌    | ❌      | ✅          | ✅        | ✅          |
| Moderate (approve/reject/edit) | ❌    | ❌      | ❌          | ✅ school  | ✅ global   |
| Reports (view/resolve/remove)  | ❌    | ❌      | ❌          | ❌        | ✅          |
| Assign / revoke roles          | ❌    | ❌      | ❌          | ❌        | ✅          |
| Create staff accounts          | ❌    | ❌      | ❌          | ❌        | ✅          |

- Coordinators/moderators gain rights only when the super admin assigns them;
  revocation takes effect immediately.
- Staff accounts are created by the super admin and receive a one-time
  temporary password that expires after 24 hours and forces a password change.
- Students register themselves with a 10-digit student number and an
  institutional email (`@STUDENT_EMAIL_DOMAIN`).

## Setup

```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python init_db.py        # seeds schools + super admin
./venv/bin/python app.py            # http://localhost:5000
```

The initial super admin password comes from `SUPER_ADMIN_PASSWORD`
(default in development: `UniShare@2026` — change it via env in production).

### Environment variables

| Variable               | Purpose                                            |
|------------------------|----------------------------------------------------|
| `SECRET_KEY`           | Session signing secret. **Required when `APP_ENV=production`** (app refuses to boot without it). |
| `APP_ENV`              | `development` (default) or `production` (forces DEBUG off). |
| `SUPER_ADMIN_PASSWORD` | Initial super admin password used by `init_db.py`. |
| `STUDENT_EMAIL_DOMAIN` | Registration email domain (default `unishare.ug`). |

## API overview

Public (no login): `GET /api/schools`, `GET /api/resources`, `GET /api/resources/<id>`,
`GET /download/<id>` (streams the file), `GET /api/resources/<id>/comments`,
`GET /api/resources/<id>/upvote-status`

Account required: `POST /api/auth/register`, `POST /api/auth/login`,
`POST /logout`, `GET /api/auth/me`, `POST /change-password`, `PUT /api/profile`,
`POST /api/resources/<id>/upvote`, `POST /api/resources/<id>/report`,
`POST /api/resources/<id>/comments`, `DELETE /api/comments/<id>` (author or staff)

Upload roles: `POST /api/uploads/check-duplicate`, `POST /api/uploads`,
`GET /api/uploads`, `PUT /api/uploads/<id>`, `POST /api/uploads/<id>/resubmit`,
`DELETE /api/uploads/<id>` (withdraw pending)

Staff: `GET /api/admin/moderation-queue`, `POST /api/admin/resources/<id>/approve|reject`,
`PUT /api/admin/resources/<id>` — Super admin (global variants under
`/api/super-admin/*`): queue, approve/reject, `POST .../soft-delete`,
`GET/POST /api/admin/reports(/<id>/resolve)`, `GET /api/admin/stats`,
`GET/POST /api/admin/users`, `POST /api/admin/users/<id>/assign-role|revoke-role|reset-password`
