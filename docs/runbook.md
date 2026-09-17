# Runbook — UniShare Uganda

Operational handbook: how to run the app locally, which accounts to test with,
what you should **expect to see** on every page, and the logic behind each
role. Written so anyone can onboard anyone else in one sitting.

Companion documents: [`architecture.md`](architecture.md) (how it works) and
[`history.md`](history.md) (how it was built and why).

---

## 1. One-time setup

Prerequisites: Python 3.12+ (developed and tested on 3.12), Git, any modern browser.

```bash
git clone https://github.com/Owen-Tech256/UNISHARE-UGANDA.git
cd UNISHARE-UGANDA

python3 -m venv venv
./venv/bin/pip install -r requirements.txt     # Windows: venv\Scripts\pip install -r requirements.txt

./venv/bin/python init_db.py                   # creates tables + seeds 7 schools + super admin
./venv/bin/python app.py                       # serves on http://localhost:5000
```

> **Using an activated venv?** If you ran `source venv/bin/activate`, plain
> `python app.py` and `pip install -r requirements.txt` are equivalent to the
> `./venv/bin/...` forms above — both work in every command in this runbook.

`init_db.py` is **idempotent** — safe to re-run; it only prints the super
admin password when it creates the account for the first time. The database
file is `unishare_uganda.db` (gitignored). To start over: delete it, re-run
`init_db.py`, then re-run the demo seed in §3.

## 2. Environment variables

| Variable | Default | When to set |
|---|---|---|
| `APP_ENV` | `development` | Set to `production` in deployment — forces DEBUG off and **refuses to boot** without `SECRET_KEY`. |
| `SECRET_KEY` | dev fallback | Required in production: `export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"` |
| `PORT` | `5000` | Port for `python app.py`. Use e.g. `PORT=5001 python app.py` when 5000 is taken. |
| `SUPER_ADMIN_PASSWORD` | `UniShare@2026` | Set before the **first** `init_db.py` run to choose the real super admin password. |
| `STUDENT_EMAIL_DOMAIN` | `unishare.ug` | Change if deploying for a different institution. |

## 3. Dummy accounts for testing (all roles)

After a fresh `init_db.py`, only the super admin exists. Seed the other demo
accounts by running this snippet once (idempotent — it creates or resets):

```bash
./venv/bin/python - <<'EOF'
from app import create_app
from models import db, User, School
from werkzeug.security import generate_password_hash

DEMO_USERS = [
    ({'student_number': '2400104444'}, dict(full_name='Aisha Nabirye', email='aisha@unishare.ug',
        password_hash=generate_password_hash('Demo@Student1'), role='student')),
    ({'student_number': '2400999888'}, dict(full_name='Daniel Okello', email='coord@unishare.ug',
        password_hash=generate_password_hash('Demo@Coord1'), role='coordinator')),
    ({'staff_id': 'STF-MOD-001'}, dict(full_name='Grace Amoding', email='mod@unishare.ug',
        password_hash=generate_password_hash('Demo@Mod1'), role='moderator')),
]

app = create_app()
with app.app_context():
    school = School.query.filter_by(school_name='School of Computing').first()
    for keys, fields in DEMO_USERS:
        user = User.query.filter_by(**keys).first()
        if not user:
            user = User(**keys, **fields, school_id=school.school_id,
                        is_temp_password=False, temp_password_expires_at=None)
            db.session.add(user)
        else:
            for k, v in fields.items():
                setattr(user, k, v)
            user.school_id = school.school_id
            user.is_temp_password = False
            user.temp_password_expires_at = None
        db.session.commit()
        print('seeded:', user.role, user.display_id)
EOF
```

### The accounts

| Role | Login identifier | Password | Name | Notes |
|------|------------------|----------|------|-------|
| **Guest** | *(none — just don't log in)* | — | — | Full browse/download access; no account needed. |
| **Student** | `2400104444` | `Demo@Student1` | Aisha Nabirye | Can upvote/comment/report; **cannot** upload. |
| **Coordinator** | `2400999888` | `Demo@Coord1` | Daniel Okello | Uploads educational resources; sees My Uploads. |
| **Moderator** | `STF-MOD-001` | `Demo@Mod1` | Grace Amoding | Moderates **School of Computing only**; can also upload. |
| **Super Admin** | `STF-SUPER-001` or `superadmin@unishare.ug` | `UniShare@2026` | Super Admin | Everything, globally; manages users/roles/reports. |

Logins work on `/login.html` by **student number, staff ID, or email** — all
three identifiers are interchangeable. After login you land on the role's page
(student → home, coordinator → upload, moderator → moderation queue, super
admin → users).

> **Temp-password accounts are not pre-seeded** — they are created *through the
> UI* by the super admin (see §6.5), which is exactly how you should test the
> force-change flow.

---

## 4. The logic of each role (what they may do and why)

- **Guest** — the friction-free contract: browse, search, filter, open detail
  pages, **download files, and read comments** with no account. Anything
  account-gated shows a friendly sign-in prompt. *Why:* the product exists to
  spread educational resources with minimum friction.
- **Student** — a registered user. Adds: upvote (toggle), comment (post/delete
  own), report a resource. Still cannot upload. *Why:* accounts are only
  needed for actions that create content or trigger staff action — this keeps
  abuse traceable while keeping reading free.
- **Coordinator** — assigned by the super admin. Adds: upload resources
  (which enter the `pending` moderation queue), edit/resubmit them, withdraw
  pending ones. *Why:* trusted contributors, but their content still passes
  moderation before it becomes public.
- **Moderator** — assigned by the super admin, scoped to **their school**.
  Adds: the moderation queue for their school — approve, reject (with a
  mandatory reason), edit metadata before approving; plus upload rights.
  *Why:* school staff know their own courses; they cannot see or touch other
  schools' submissions (server-enforced 403).
- **Super Admin** — platform-wide. Adds: global moderation (with a school
  filter), soft-delete ("remove") any resource, resolve reports, and full user
  management: search users, **assign/revoke coordinator & moderator roles
  (effective immediately)**, create staff accounts with one-time temp
  passwords, reset passwords. *Why:* one accountable owner of access control.

---

## 5. Page-by-page walkthrough (what to expect)

Every page uses the same design chrome (header with role-gated nav, footer,
toasts). "Public" = no login required.

### `/index.html` — Home *(public)*
Hero with a search panel (school dropdown + query box), quick filters,
"Recently added" resource cards, platform stats (resources/contributors),
About, Contact (`hello@unishare.ug`), Terms sections.
- *Search →* redirects to `/browse.html?search=…&school_id=…` with results.
- *As a guest,* cards render fully — downloading is free.

### `/browse.html` — Browse *(public)*
Left filter drawer (school, type, sort) + search box; grid of resource cards
(type badge, title, course · school, lecturer · year, upvote count, View).
- Search/filters/sort/pagination all hit the **server** (`GET /api/resources`);
  the URL reflects the state (shareable).
- *Upvote buttons* as a guest → "Please log in to continue." toast.

### `/resource_detail.html?id=N` — Resource detail *(public)*
Full metadata card (course, lecturer, year/semester, school, uploader, type
badge, upvote count) + **Download** button + related resources +
**Comments** section.
- *Download* works without login (streams the file, keeps its original name).
- *Guests* see: "Create a free account or log in to comment, upvote, or
  report…" with Login/Register buttons above the comment box.
- *Logged in:* upvote toggles the count, report opens a modal (reason select
  + optional comment), comment box posts, and **your own comments get a
  Delete button**.

### `/login.html` *(public)*
Identifier + password, show/hide toggle, error alert.
- *Expect* exactly one landing page per role after login (see §3 table).
- *Temp-password login:* the modal **"Set a new password"** opens and **cannot
  be dismissed** until the password is changed — then you're redirected home.

### `/register.html` *(public)*
Full name, 10-digit student number, institutional email (`@unishare.ug`),
school dropdown, password + confirm, terms checkbox.
- *Expect* auto-login on success ("you are now signed in" toast) and field
  errors for: wrong number length, non-institutional email, duplicate
  number/email (409).

### `/upload.html` — Upload *(coordinator / moderator / super admin)*
Dropzone + metadata form (title, course code/name, lecturer, year, semester,
type, description, school **locked to the uploader's own**).
- *Duplicate check fires as you type*: if a similar resource of yours exists
  (same course code + year + semester + type), a warning appears before
  submit.
- *Students who navigate here* see an explanatory notice instead of the form:
  uploading is limited to assigned roles.

### `/my_uploads.html` — My Uploads *(coordinator / moderator / super admin)*
Summary cards (total/approved/pending/rejected/upvotes), status tabs
(All/Pending/Approved/Rejected), sortable table.
- *Pending rows* → Edit / **Withdraw** (confirm modal; removes from the
  moderation queue via soft delete).
- *Rejected rows* → the **rejection reason is displayed** on the row;
  **Resubmit** returns it to pending.
- *Edit* → modal; saving **resets the resource to pending** for re-moderation.

### `/moderation_queue.html` — Moderation *(moderator: own school · super admin: global)*
Stats row (pending count, oldest submission, today's submissions), status
tabs (Pending/Approved/Rejected), type filter, select-all + **Approve
Selected**. Each item card shows full metadata + Preview / Approve /
**Edit Before Approve** / Reject.
- *Moderator:* only their school's submissions ever appear (try the super
  admin on the same page to see the difference: a school filter appears).
- *Reject* opens a modal requiring a **Reason** (Wrong course / Outdated /
  Incorrect content / Duplicate / Inappropriate / Other) + optional comment.
- *Edit Before Approve* opens a metadata form — moderators fix typos before
  approving rather than bouncing uploads back.

### `/users.html` — User management *(super admin)*
Stats cards (students/coordinators/moderators/open reports), search +
role filter, `+ Add Staff`.
- *Student rows* → **Assign Coordinator** / **Assign Moderator** (confirm
  dialog warns the rights are effective immediately).
- *Staff rows* → **Revoke to Student** (disabled on your own row) +
  **Reset Password**.
- *Add Staff* → modal (name, staff ID, email, role, school) → on success a
  **"Temporary password" modal shows the one-time password** — this is the
  only time it is ever displayed.

### `/reports.html` — Reported resources *(super admin)*
Open/Resolved/All filter; table of report rows (resource link, reason chip +
comment, reporter, date, status).
- *Resolve* marks the report handled.
- *Remove Resource* soft-deletes the resource — it vanishes from browse
  immediately.

### `/profile.html` — Profile *(any logged-in user)*
Info card (name, email, school, role, member since), **name-only** edit form,
change-password modal, delete-account card (**disabled — coming soon**).
- *Roles with upload rights* also see Contribution Statistics + Recent
  Uploads; students don't (they can't upload — the section would always be
  zero).
- *Expect* the name change to survive a page reload (server-persisted).

---

## 6. The test scripts (role journeys worth walking)

### 6.1 Guest friction-free journey
1. Without logging in: browse → open any approved resource → **Download**.
2. Try to upvote/comment → sign-in prompts (401 behind the scenes).
3. *Pass:* downloads worked, prompts appeared, nothing blocked reading.

### 6.2 Student lifecycle
1. `/register.html` → new account (e.g. student number `2500123456`,
   `test.student@unishare.ug`) → auto-logged-in.
2. On any resource: upvote → count +1; upvote again → count back (toggle).
3. Comment → appears; Delete it → disappears from the list (soft-deleted).
4. Report → modal → submit.
5. *Pass:* all four interactions succeed; My Uploads/Upload show the
   "coordinators only" notice for students.

### 6.3 Coordinator upload → moderation loop
1. Log in as the coordinator → upload a small PDF (any course).
2. My Uploads → the new row is **Pending**.
3. Log out → log in as the **moderator** → Moderation Queue → the upload is
   listed → **Approve**.
4. Back to browse (logged out even) → the resource is publicly visible.
5. Repeat steps 1–3 but **Reject** with reason "Outdated".
6. As coordinator, My Uploads → Rejected tab → the reason shows → **Resubmit**
   → pending again.
7. *Pass:* full pending → approved/rejected → (resubmit) loop with the reason
   visible to the uploader.

### 6.4 Moderator school scoping
1. As super admin, Add Staff → create a moderator for **School of Business**.
2. Finish its force-change in a private window (see 6.5), then upload a
   resource as the **coordinator** (School of Computing).
3. Log in as the Business moderator → Moderation Queue → *Pass:* the
   Computing upload **does not appear**.
4. (API check) that moderator approving the Computing resource returns 403.

### 6.5 Staff onboarding & immediate revocation
1. As super admin → `/users.html` → **+ Add Staff** → role Coordinator,
   School of Computing → Create.
2. The one-time temp password modal appears — copy it (you won't see it
   again).
3. In a **private window**, log in with the new staff ID + temp password →
   the non-dismissible **"Set a new password"** modal opens → set a new
   password → you land on the upload page.
4. Upload something — it works (the role is live).
5. Back in the main window, super admin → `/users.html` → find that user →
   **Revoke to Student**.
6. Refresh in the private window → try to upload again → *Pass:* **403 —
   revocation took effect immediately, without re-login.**

### 6.6 Reports and removal
1. As a student, report an approved resource (any reason).
2. Super admin → `/reports.html` → the report is listed with reason +
   reporter.
3. *Resolve* one report; *Remove Resource* on another → the resource
   disappears from `/browse.html` instantly (soft delete).

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `RuntimeError: SECRET_KEY environment variable is required…` | You set `APP_ENV=production` without a secret — export `SECRET_KEY` or unset `APP_ENV`. |
| Port 5000 already in use | Run on another port: `PORT=5001 python app.py` — or free the port: `fuser -k 5000/tcp`. |
| Login says "Invalid Student Number/Staff ID or password." | Generic by design (no user enumeration). Check you used the right identifier type — staff accounts log in by Staff ID or email, not student number. |
| "Temporary password has expired." | Temp passwords last 24 h. Ask a super admin to **Reset Password** and get a fresh one. |
| Super admin password unknown | Re-run the seed with it set: `SUPER_ADMIN_PASSWORD=YourNewPass ./venv/bin/python init_db.py` (only helps if the account doesn't exist yet; otherwise reset via SQL or recreate the DB). |
| Upload rejected: file type | Allowed: pdf, doc, docx, ppt, pptx, txt, jpg, jpeg, png; max 16 MB. |
| "Please use your institutional email" | Registration requires `@unishare.ug` (or your configured `STUDENT_EMAIL_DOMAIN`). |
| Page 404 but the API works | Pages live in `pages/` and must be `*.html`; check the exact filename. |
| DB looks stale / weird test data | It's disposable: delete `unishare_uganda.db`, run `init_db.py`, re-run the §3 demo seed. |

## 8. Quick API smoke test (optional)

```bash
# public browse
curl -s http://localhost:5000/api/resources | head -c 300; echo
# login as coordinator (cookie jar)
curl -s -c /tmp/jar -H 'Content-Type: application/json' \
  -d '{"identifier":"2400999888","password":"Demo@Coord1"}' \
  http://localhost:5000/api/auth/login | head -c 200; echo
# who am I
curl -s -b /tmp/jar http://localhost:5000/api/auth/me
# my uploads (coordinator only)
curl -s -b /tmp/jar 'http://localhost:5000/api/uploads?per_page=5'
```
