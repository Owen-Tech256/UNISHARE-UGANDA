"""
UniShare Uganda - Database Initialization Script.

Creates all tables, seeds the school categories used by the frontend
design, and seeds one super_admin account. Idempotent: safe to run
multiple times.
"""
import os
import sys
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, School, User

# School categories from the frontend design (js SCHOOL_CATEGORIES)
SCHOOLS = [
    'School of Computing',
    'School of Business',
    'School of Law',
    'School of Health Sciences',
    'School of Science',
    'School of Education',
    'School of Social Sciences',
]

SUPER_ADMIN = {
    'full_name': 'Super Admin',
    'staff_id': 'STF-SUPER-001',
    'email': 'superadmin@unishare.ug',
}

# Prefer env var; fall back to a printed development default.
DEFAULT_SUPER_ADMIN_PASSWORD = os.environ.get('SUPER_ADMIN_PASSWORD') or 'UniShare@2026'


def init_database():
    app = create_app()
    with app.app_context():
        print('Creating database tables...')
        db.create_all()
        print('Tables created successfully.')

        print('\nSeeding schools...')
        for school_name in SCHOOLS:
            if not School.query.filter_by(school_name=school_name).first():
                db.session.add(School(school_name=school_name))
        db.session.commit()
        print(f'Schools seeded ({len(SCHOOLS)}).')

        print('\nSeeding super admin account...')
        admin = User.query.filter_by(staff_id=SUPER_ADMIN['staff_id']).first()
        if not admin:
            school = School.query.filter_by(school_name='School of Computing').first()
            admin = User(
                full_name=SUPER_ADMIN['full_name'],
                staff_id=SUPER_ADMIN['staff_id'],
                email=SUPER_ADMIN['email'],
                password_hash=generate_password_hash(DEFAULT_SUPER_ADMIN_PASSWORD),
                role='super_admin',
                school_id=school.school_id,
                is_temp_password=False,
            )
            db.session.add(admin)
            db.session.commit()
            print('Super admin created.')
        else:
            print('Super admin already exists (skipped).')

        print('\n' + '=' * 60)
        print('UniShare Uganda database initialized successfully!')
        print('=' * 60)
        print(f'Super Admin login: {SUPER_ADMIN["staff_id"]} or {SUPER_ADMIN["email"]}')
        print(f'Super Admin password: {DEFAULT_SUPER_ADMIN_PASSWORD}')
        print('Change this via the SUPER_ADMIN_PASSWORD env var in production.')


if __name__ == '__main__':
    init_database()
