"""
Authentication routes - ported from project haily's routes/auth.py.

Changes vs haily (per MIGRATION_PLAN.md):
  - /register becomes a JSON API (POST /api/auth/register) with auto-login
  - Registration requires haily's 10-digit student number and
    institutional email domain (configurable via STUDENT_EMAIL_DOMAIN)
  - Adds GET /api/auth/me for the frontend header
  - Redirect targets point at the static pages of the new app
"""
from flask import Blueprint, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

from models import db, User, School
from utils.auth import login_required
from config import Config

auth_bp = Blueprint('auth', __name__)

# Role -> landing page after login (static pages of the new app)
REDIRECT_MAP = {
    'student': '/index.html',
    'coordinator': '/upload.html',
    'moderator': '/admin/moderation_queue.html',
    'super_admin': '/admin/users.html',
}


@auth_bp.route('/')
def index():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return redirect(REDIRECT_MAP.get(user.role, '/index.html'))
    return redirect('/index.html')


@auth_bp.route('/api/auth/register', methods=['POST'])
def api_register():
    """JSON registration per v3.0-style spec. New accounts are students."""
    data = request.get_json(silent=True) or {}

    full_name = str(data.get('full_name', '')).strip()
    student_number = str(data.get('student_number', '')).strip()
    email = str(data.get('email', '')).strip().lower()
    school_id = data.get('school_id')
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    errors = []
    if not full_name or len(full_name) < 3:
        errors.append('Full name must be at least 3 characters.')
    if not student_number or len(student_number) != 10 or not student_number.isdigit():
        errors.append('Student Number must contain exactly 10 digits.')
    if not email or '@' not in email:
        errors.append('Please enter a valid email address.')
    elif not email.endswith('@' + Config.STUDENT_EMAIL_DOMAIN):
        errors.append(f'Please use your institutional email (@{Config.STUDENT_EMAIL_DOMAIN}).')
    if not school_id:
        errors.append('Please select your school.')
    if not password or len(password) < 8:
        errors.append('Password must be at least 8 characters.')
    if password != confirm_password:
        errors.append('Passwords do not match.')

    if errors:
        return jsonify({'success': False, 'message': '; '.join(errors)}), 400

    if User.query.filter_by(student_number=student_number).first():
        return jsonify({'success': False, 'message': 'A user with this Student Number already exists.'}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'An account with this email already exists.'}), 409

    school = School.query.get(school_id)
    if not school:
        return jsonify({'success': False, 'message': 'Invalid school selected.'}), 400

    new_user = User(
        full_name=full_name,
        student_number=student_number,
        email=email,
        password_hash=generate_password_hash(password),
        role='student',
        school_id=school.school_id,
        is_temp_password=False,
    )
    db.session.add(new_user)
    db.session.commit()

    # Auto-login (friction reduction: registration is only for upvote/comment/report)
    session['user_id'] = new_user.user_id
    session['user_role'] = new_user.role
    session['user_name'] = new_user.full_name
    session['school_id'] = new_user.school_id

    return jsonify({
        'success': True,
        'message': 'Account created successfully.',
        'data': {
            'user': new_user.to_dict(),
            'redirect_url': REDIRECT_MAP.get(new_user.role, '/index.html'),
        }
    }), 201


@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    """JSON login: identifier may be student number, staff ID, or email."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'success': False, 'message': 'Invalid request payload'}), 400

    identifier = str(data.get('identifier', '')).strip()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'success': False, 'message': 'Invalid Student Number/Staff ID or password.'}), 401

    user = User.query.filter(
        (User.student_number == identifier) |
        (User.staff_id == identifier) |
        (User.email == identifier)
    ).first()

    # Generic error message for security
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'success': False, 'message': 'Invalid Student Number/Staff ID or password.'}), 401

    # Check temporary password expiry
    if user.is_temp_password:
        if user.temp_password_expires_at and datetime.utcnow() > user.temp_password_expires_at:
            return jsonify({'success': False, 'message': 'Temporary password has expired. Please contact your super admin for a new one.'}), 403

    session['user_id'] = user.user_id
    session['user_role'] = user.role
    session['user_name'] = user.full_name
    session['school_id'] = user.school_id

    response = {
        'success': True,
        'message': 'Login successful',
        'data': {
            'user': user.to_dict(),
            'must_change_password': user.is_temp_password,
            'redirect_url': REDIRECT_MAP.get(user.role, '/index.html'),
        }
    }

    if user.is_temp_password:
        response['message'] = 'Temporary password active'

    return jsonify(response), 200


@auth_bp.route('/api/auth/me')
def api_me():
    """Current session user (or null) for the frontend header."""
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    return jsonify({'success': True, 'data': {'user': user.to_dict() if user else None}})


@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    session.clear()
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({'success': True, 'message': 'You have been logged out.'})
    return redirect('/login.html')


@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    user = User.query.get(session['user_id'])

    data = request.get_json(silent=True) or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')

    # Temp-password holders skip the current-password check (haily behavior)
    if not user.is_temp_password:
        if not check_password_hash(user.password_hash, current_password):
            return jsonify({'success': False, 'message': 'Current password is incorrect'}), 400

    if not new_password or len(new_password) < 8:
        return jsonify({'success': False, 'message': 'New password must be at least 8 characters'}), 400

    if new_password != confirm_password:
        return jsonify({'success': False, 'message': 'Passwords do not match'}), 400

    user.password_hash = generate_password_hash(new_password)
    user.is_temp_password = False
    user.temp_password_expires_at = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Password changed successfully'})


@auth_bp.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    user = User.query.get(session['user_id'])
    data = request.get_json(silent=True) or {}
    full_name = data.get('full_name', '').strip()
    email = data.get('email', '').strip().lower()

    if not full_name or len(full_name) < 3:
        return jsonify({'success': False, 'message': 'Full name must be at least 3 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'success': False, 'message': 'Please enter a valid email'}), 400

    existing = User.query.filter(User.email == email, User.user_id != user.user_id).first()
    if existing:
        return jsonify({'success': False, 'message': 'Email already in use'}), 409

    user.full_name = full_name
    user.email = email
    db.session.commit()
    session['user_name'] = user.full_name
    return jsonify({'success': True, 'message': 'Profile updated', 'data': user.to_dict()})
