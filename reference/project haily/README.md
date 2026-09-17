# UniShare Nkumba

A centralized academic resource sharing platform built exclusively for **Nkumba University**.

## 🎯 Overview

UniShare Nkumba replaces informal academic material distribution (WhatsApp groups, private chats) with an organized, moderated, school-based digital repository. Students can discover, access, and contribute lecture notes, past papers, slides, and course summaries — all quality-assured by school moderators.

## ✨ Features

### For Students
- 🔍 Browse and search resources across all 7 schools
- 🎯 Filter by school, course, semester, year, and resource type
- 👍 Upvote helpful resources
- 📥 Download approved materials
- 🚩 Report inappropriate content
- 👤 Manage profile and change password

### For Class Representatives
- 📤 Upload academic resources
- 📊 Track upload status (pending/approved/rejected)
- ✏️ Edit and resubmit rejected uploads
- 🔎 Automatic duplicate detection

### For School Moderators (Assistant Head of School)
- ✅ Approve or reject pending resources
- 💬 Provide rejection reasons
- ✏️ Edit resource metadata
- 🔑 Reset student passwords (generate 8-char temp passwords)

### For School Admins (Head of School/Dean)
- 👥 Manage users in their school
- ⬆️ Promote students to Class Representatives
- ⬇️ Demote Class Representatives
- 🚨 Review and resolve reports
- 🗑️ Soft-delete problematic resources

# UniShare Nkumba - Academic Resource Platform

The official centralized academic resource repository for Nkumba University students.

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Default Login Credentials](#default-login-credentials)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

##  Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8 or higher** - [Download Python](https://www.python.org/downloads/)
- **pip** (Python package installer) - Comes with Python 3.4+
- **Git** (optional) - [Download Git](https://git-scm.com/downloads)

---
HOW TO RUN IT FOLLOW THE STEPS
##  Installation

### Step 1: Navigate to the Project Folder
```bash
cd "C:\Users\owen\Desktop\project haily"

# Windows
python -m venv venv

# Activate the virtual environment
venv\Scripts\activate

pip install -r requirements.txt

pip install Flask Flask-SQLAlchemy Werkzeug

python init_db.py

YOU SHOULD SEE OUT LIKE THIS

📦 Creating database tables...
✅ Tables created successfully.
🏫 Seeding schools...
✅ Schools seeded.
👥 Seeding staff accounts...
✅ Staff accounts seeded.
🎉 UniShare Nkumba database initialized successfully!

Start the flask Server

python app.py

Open your web browser and navigate to
http://localhost:5000

Or if accessing from another device on the same network:
http://192.168.225.31:5000
## 🔐 Default Staff Credentials

**⚠️ Development only — change these in production!**

**Default password for all staff:** `Nkumba@2026`

| School | Role | Staff ID | Email |
|--------|------|----------|-------|
| Computing | Admin | HOS-COMP-001 | j.okello@nkumbauniversity.ac.ug |
| Computing | Moderator | AHOS-COMP-001 | p.ssemakula@nkumbauniversity.ac.ug |
| Business | Admin | HOS-BUS-001 | s.namukasa@nkumbauniversity.ac.ug |
| Business | Moderator | AHOS-BUS-001 | g.akello@nkumbauniversity.ac.ug |
| Law | Admin | HOS-LAW-001 | m.kizza@nkumbauniversity.ac.ug |
| Law | Moderator | AHOS-LAW-001 | d.lubega@nkumbauniversity.ac.ug |
| Social Sciences | Admin | HOS-SS-001 | f.nalwoga@nkumbauniversity.ac.ug |
| Social Sciences | Moderator | AHOS-SS-001 | r.mugisha@nkumbauniversity.ac.ug |
| Education | Admin | HOS-EDU-001 | j.nabatanzi@nkumbauniversity.ac.ug |
| Education | Moderator | AHOS-EDU-001 | c.achieng@nkumbauniversity.ac.ug |
| Fine Art & Design | Admin | HOS-FAD-001 | s.wasswa@nkumbauniversity.ac.ug |
| Fine Art & Design | Moderator | AHOS-FAD-001 | b.otim@nkumbauniversity.ac.ug |
| Sciences | Admin | HOS-SCI-001 | a.tendo@nkumbauniversity.ac.ug |
| Sciences | Moderator | AHOS-SCI-001 | i.mutyaba@nkumbauniversity.ac.ug |

**To register as a student:** Use the `/register` page with your 10-digit student number.

## 📁 Folder Structure

```
unishare_nkumba/
├── app.py                    # Main Flask application
├── config.py                 # Configuration settings
├── models.py                 # SQLAlchemy database models
├── init_db.py                # Database initialization script
├── requirements.txt          # Python dependencies
├── README.md                 # This file
├── routes/                   # Route blueprints
│   ├── auth.py               # Authentication routes
│   ├── resources.py          # Resource browsing & details
│   ├── uploads.py            # Upload & my uploads
│   └── admin.py              # Admin/moderator routes
├── utils/                    # Utility modules
│   ├── auth.py               # Auth decorators
│   ├── permissions.py        # Permission helpers
│   └── file_handler.py       # File upload handling
├── templates/                # Jinja2 HTML templates
│   ├── base.html
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── browse.html
│   ├── resource_detail.html
│   ├── upload.html
│   ├── my_uploads.html
│   ├── profile.html
│   ├── errors/
│   └── admin/
├── static/
│   ├── css/style.css
│   ├── js/
│   │   ├── main.js
│   │   ├── browse.js
│   │   ├── upload.js
│   │   ├── auth.js
│   │   └── admin.js
│   └── assets/
└── uploads/resources/        # Uploaded files (gitignored)
```

## 👥 User Roles

The system has exactly **four roles**:

1. **student** — Browse, download, upvote, report resources
2. **class_rep** — Everything a student can do, plus upload resources
3. **moderator** — School Assistant Head; reviews uploads in their school
4. **admin** — School Head/Dean; manages users and reports in their school

**Important:** Every new account starts as a `student`. Only admins can promote students to class reps.

## 🔒 Security Features

- Passwords hashed with Werkzeug (PBKDF2)
- Session-based authentication
- Role-based access control (RBAC)
- School-level data isolation (staff can only access their school's data)
- File upload validation (type, size, secure filenames)
- Path traversal protection
- SQL injection protection via SQLAlchemy ORM
- XSS protection via HTML escaping
- Temporary password system with 24-hour expiry
- Soft-delete for auditable resource removal

## 🌐 API Endpoints

### Authentication
- `GET/POST /login` — Sign in
- `GET/POST /register` — Student registration
- `POST /logout` — Sign out
- `POST /change-password` — Change password
- `PUT /api/profile` — Update profile

### Resources
- `GET /browse` — Browse page
- `GET /api/resources` — List approved resources (with filters)
- `GET /resource/<id>` — Resource detail page
- `GET /download/<id>` — Download resource file
- `POST /api/resources/<id>/upvote` — Toggle upvote
- `POST /api/resources/<id>/report` — Report resource

### Uploads (Class Reps)
- `GET /upload` — Upload form
- `GET /my-uploads` — My uploads page
- `GET /api/uploads` — List my uploads
- `POST /api/uploads` — Upload new resource
- `PUT /api/uploads/<id>` — Edit & resubmit
- `POST /api/uploads/check-duplicate` — Check duplicates

### Admin / Moderator
- `GET /admin/moderation-queue` — Moderator queue
- `POST /api/admin/resources/<id>/approve` — Approve resource
- `POST /api/admin/resources/<id>/reject` — Reject resource
- `PUT /api/admin/resources/<id>` — Edit resource (moderator)
- `POST /api/admin/users/<id>/reset-password` — Generate temp password
- `GET /admin/users` — User management
- `POST /api/admin/users/<id>/promote` — Promote to class rep
- `POST /api/admin/users/<id>/demote` — Demote to student
- `GET /admin/reports` — Reports list
- `POST /api/admin/reports/<id>/resolve` — Resolve report
- `POST /api/admin/resources/<id>/soft-delete` — Soft-delete resource

## 🧪 Testing the System

### As a Student
1. Register at `/register` with a 10-digit student number
2. Browse resources at `/browse`
3. Search and filter resources
4. View details, upvote, download, or report

### As a Class Representative
1. Register as a student, then have an admin promote you
2. Or log in after being promoted
3. Upload resources at `/upload`
4. Track status at `/my-uploads`

### As a Moderator
1. Log in with staff ID (e.g., `AHOS-COMP-001`) and password `Nkumba@2026`
2. Review pending resources in the moderation queue
3. Approve, reject (with reason), or edit resources
4. Reset student passwords via the floating action button

### As an Admin
1. Log in with staff ID (e.g., `HOS-COMP-001`) and password `Nkumba@2026`
2. Manage users: promote/demote
3. Review reports and soft-delete problematic resources

## 📝 Business Rules

1. Platform belongs to Nkumba University only
2. Exactly four roles: student, class_rep, moderator, admin
3. Every new account starts as student
4. Students cannot self-promote or upload resources
5. Only class reps can upload resources
6. Class reps can only upload to their own school
7. All uploads start as `pending`
8. Only the school's moderator can approve/reject
9. Only `approved` resources are publicly visible
10. School admins manage users and reports within their school only
11. Staff cannot self-register
12. Temporary passwords expire after 24 hours
13. Deleted resources are soft-deleted (auditable)
14. All passwords are hashed
15. Authorization is enforced on the backend

## 🚀 Production Deployment

For production deployment:

1. Change `SECRET_KEY` in `config.py` to a strong random value
2. Change the default staff password in `init_db.py`
3. Set `DEBUG = False` in `config.py`
4. Use a production WSGI server (gunicorn, waitress)
5. Configure proper file permissions for the `uploads/` directory
6. Set up HTTPS
7. Consider migrating from SQLite to PostgreSQL for scale

## 📄 License

Built for Nkumba University academic use.

## 🙏 Acknowledgments

Developed as a centralized academic resource platform for Nkumba University students and staff.