"""
UniShare Nkumba - Database Initialization Script (v3.0)
"""
import os
import sys
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import db, School, User

STAFF_ACCOUNTS = [
    # School of Computing
    {'full_name': 'Dr. James Okello', 'staff_id': 'STF-CMP-001', 'email': 'j.okello@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Computing'},
    {'full_name': 'Mr. Peter Ssemakula', 'staff_id': 'STF-CMP-002', 'email': 'p.ssemakula@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Computing'},
    # School of Business
    {'full_name': 'Prof. Sarah Namukasa', 'staff_id': 'STF-BUS-001', 'email': 's.namukasa@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Business'},
    {'full_name': 'Ms. Grace Akello', 'staff_id': 'STF-BUS-002', 'email': 'g.akello@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Business'},
    # School of Law
    {'full_name': 'Dr. Moses Kizza', 'staff_id': 'STF-LAW-001', 'email': 'm.kizza@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Law'},
    {'full_name': 'Mr. David Lubega', 'staff_id': 'STF-LAW-002', 'email': 'd.lubega@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Law'},
    # School of Social Sciences
    {'full_name': 'Dr. Florence Nalwoga', 'staff_id': 'STF-SOC-001', 'email': 'f.nalwoga@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Social Sciences'},
    {'full_name': 'Mr. Robert Mugisha', 'staff_id': 'STF-SOC-002', 'email': 'r.mugisha@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Social Sciences'},
    # School of Education
    {'full_name': 'Prof. Janet Nabatanzi', 'staff_id': 'STF-EDU-001', 'email': 'j.nabatanzi@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Education'},
    {'full_name': 'Ms. Carol Achieng', 'staff_id': 'STF-EDU-002', 'email': 'c.achieng@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Education'},
    # School of Fine Art & Design
    {'full_name': 'Dr. Samuel Wasswa', 'staff_id': 'STF-FAD-001', 'email': 's.wasswa@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Fine Art & Design'},
    {'full_name': 'Mr. Brian Otim', 'staff_id': 'STF-FAD-002', 'email': 'b.otim@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Fine Art & Design'},
    # School of Sciences
    {'full_name': 'Prof. Alice Tendo', 'staff_id': 'STF-SCI-001', 'email': 'a.tendo@nkumbauniversity.ac.ug', 'role': 'admin', 'school_name': 'School of Sciences'},
    {'full_name': 'Mr. Isaac Mutyaba', 'staff_id': 'STF-SCI-002', 'email': 'i.mutyaba@nkumbauniversity.ac.ug', 'role': 'moderator', 'school_name': 'School of Sciences'},
]

SCHOOLS = [
    'School of Computing', 'School of Business', 'School of Law',
    'School of Social Sciences', 'School of Education', 
    'School of Fine Art & Design', 'School of Sciences',
]

DEFAULT_STAFF_PASSWORD = 'Nkumba@2026'

def init_database():
    app = create_app()
    with app.app_context():
        print('📦 Creating database tables...')
        db.create_all()
        print('✅ Tables created successfully.')

        print('\n🏫 Seeding schools...')
        for school_name in SCHOOLS:
            if not School.query.filter_by(school_name=school_name).first():
                db.session.add(School(school_name=school_name))
        db.session.commit()
        print('✅ Schools seeded.')

        print('\n👥 Seeding staff accounts...')
        password_hash = generate_password_hash(DEFAULT_STAFF_PASSWORD)
        for staff in STAFF_ACCOUNTS:
            if not User.query.filter_by(staff_id=staff['staff_id']).first():
                school = School.query.filter_by(school_name=staff['school_name']).first()
                db.session.add(User(
                    full_name=staff['full_name'],
                    staff_id=staff['staff_id'],
                    email=staff['email'],
                    password_hash=password_hash,
                    role=staff['role'],
                    school_id=school.school_id,
                    is_temp_password=False
                ))
        db.session.commit()
        print('✅ Staff accounts seeded.')
        
        print('\n' + '='*60)
        print('🎉 UniShare Nkumba database initialized successfully!')
        print('='*60)
        print(f'📝 Default Staff Password: {DEFAULT_STAFF_PASSWORD}')
        print('🔐 Sample Staff Logins: STF-CMP-001 (Admin), STF-CMP-002 (Moderator)')

if __name__ == '__main__':
    init_database()