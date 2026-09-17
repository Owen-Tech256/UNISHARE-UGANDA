from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from models import db, User, School
from utils.auth import login_required
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__)


def password_reset_serializer():
    from flask import current_app
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='password-reset')

@auth_bp.route('/')
def index():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            if user.role == 'student':
                return redirect(url_for('resources.browse'))
            elif user.role == 'class_rep':
                return redirect(url_for('uploads.my_uploads'))
            elif user.role == 'moderator':
                return redirect(url_for('admin.moderation_queue'))
            elif user.role == 'admin':
                return redirect(url_for('admin.users'))
    return render_template('index.html')

@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    """JSON API endpoint for authentication as per v3.0 spec."""
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Invalid request payload'}), 400

    identifier = str(data.get('identifier', '')).strip()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'message': 'Invalid Student Number/Staff ID or password.'}), 401

    # Try student number first, then staff ID, then email
    user = User.query.filter(
        (User.student_number == identifier) |
        (User.staff_id == identifier) |
        (User.email == identifier)
    ).first()

    # Generic error message for security
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'message': 'Invalid Student Number/Staff ID or password.'}), 401

    # Check temporary password expiry
    if user.is_temp_password:
        if user.temp_password_expires_at and datetime.utcnow() > user.temp_password_expires_at:
            return jsonify({'message': 'Temporary password has expired. Please visit your Assistant Head of School for a new one.'}), 403

    # Login successful
    session['user_id'] = user.user_id
    session['user_role'] = user.role
    session['user_name'] = user.full_name
    session['school_id'] = user.school_id

# Determine redirect URL
    redirect_map = {
    'student': '/browse',
    'class_rep': '/my-uploads',
    'moderator': '/admin/moderation-queue',
    'admin': '/admin/users'
}

    response = {
        'message': 'Login successful',
        'user_id': user.user_id,
        'role': user.role,
        'school_id': user.school_id,
        'must_change_password': user.is_temp_password,
        'redirect_url': redirect_map.get(user.role, '/browse')
    }

    if user.is_temp_password:
        response['message'] = 'Temporary password active'

    return jsonify(response), 200

@auth_bp.route('/login')
def login():
    return render_template('login.html')


@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    reset_url = None
    if request.method == 'POST':
        identifier = request.form.get('identifier', '').strip()
        email = request.form.get('email', '').strip().lower()
        user = User.query.filter(
            ((User.student_number == identifier) | (User.staff_id == identifier)) &
            (User.email == email)
        ).first()

        if user:
            token = password_reset_serializer().dumps({'user_id': user.user_id})
            reset_url = url_for('auth.reset_password', token=token, _external=True)
        else:
            flash('We could not verify those account details. Check them and try again.', 'danger')

    return render_template('forgot_password.html', reset_url=reset_url)


@auth_bp.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    try:
        data = password_reset_serializer().loads(token, max_age=3600)
        user = User.query.get(data['user_id'])
    except (BadSignature, SignatureExpired, KeyError, TypeError):
        user = None

    if not user:
        flash('This password reset link is invalid or has expired.', 'danger')
        return redirect(url_for('auth.forgot_password'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        if len(password) < 8:
            flash('Password must be at least 8 characters.', 'danger')
        elif password != confirm_password:
            flash('Passwords do not match.', 'danger')
        else:
            user.password_hash = generate_password_hash(password)
            user.is_temp_password = False
            user.temp_password_expires_at = None
            db.session.commit()
            flash('Your password has been reset. You can now sign in.', 'success')
            return redirect(url_for('auth.login'))

    return render_template('reset_password.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.form
        full_name = data.get('full_name', '').strip()
        student_number = data.get('student_number', '').strip()
        email = data.get('email', '').strip().lower()
        school_id = data.get('school_id', type=int)
        password = data.get('password', '')
        confirm_password = data.get('confirm_password', '')
        terms = data.get('terms')

        errors = []
        if not full_name or len(full_name) < 3:
            errors.append('Full name must be at least 3 characters.')
        if not student_number or len(student_number) != 10 or not student_number.isdigit():
            errors.append('Student Number must contain exactly 10 digits.')
        if not email or '@nkumbauniversity.ac.ug' not in email:
            errors.append('Please enter a valid institutional email (@nkumbauniversity.ac.ug).')
        if not school_id:
            errors.append('Please select your school.')
        if not password or len(password) < 8:
            errors.append('Password must be at least 8 characters.')
        if password != confirm_password:
            errors.append('Passwords do not match.')
        if not terms:
            errors.append('You must agree to the Terms and Conditions.')

        if errors:
            for e in errors: flash(e, 'danger')
            return render_template('register.html', schools=School.query.all(), form=data), 400

        if User.query.filter_by(student_number=student_number).first():
            flash('A user with this Student Number already exists.', 'danger')
            return render_template('register.html', schools=School.query.all(), form=data), 409

        if User.query.filter_by(email=email).first():
            flash('An account with this email already exists.', 'danger')
            return render_template('register.html', schools=School.query.all(), form=data), 409

        school = School.query.get(school_id)
        if not school:
            flash('Invalid school selected.', 'danger')
            return render_template('register.html', schools=School.query.all(), form=data), 400

        new_user = User(
            full_name=full_name,
            student_number=student_number,
            email=email,
            password_hash=generate_password_hash(password),
            role='student',
            school_id=school_id,
            is_temp_password=False
        )
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('register.html', schools=School.query.all(), form={})

@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))  # <-- Changed from 'auth.login'

@auth_bp.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    user = User.query.get(session['user_id'])
    force = request.args.get('force') == '1' or user.is_temp_password

    if request.method == 'POST':
        data = request.form if not request.is_json else request.json
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')

        if not user.is_temp_password:
            if not check_password_hash(user.password_hash, current_password):
                return jsonify({'message': 'Current password is incorrect'}), 400 if request.is_json else (render_template('profile.html', user=user, force_change=force), 400)

        if not new_password or len(new_password) < 8:
            return jsonify({'message': 'New password must be at least 8 characters'}), 400 if request.is_json else (render_template('profile.html', user=user, force_change=force), 400)

        if new_password != confirm_password:
            return jsonify({'message': 'Passwords do not match'}), 400 if request.is_json else (render_template('profile.html', user=user, force_change=force), 400)

        user.password_hash = generate_password_hash(new_password)
        user.is_temp_password = False
        user.temp_password_expires_at = None
        db.session.commit()

        if request.is_json:
            return jsonify({'message': 'Password changed successfully', 'success': True})

        flash('Password changed successfully!', 'success')
        return redirect(url_for('auth.index'))

    return render_template('profile.html', user=user, force_change=force)

@auth_bp.route('/profile')
@login_required
def profile():
    user = User.query.get(session['user_id'])
    return render_template('profile.html', user=user, force_change=user.is_temp_password)

@auth_bp.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    user = User.query.get(session['user_id'])
    data = request.json or {}
    full_name = data.get('full_name', '').strip()
    email = data.get('email', '').strip().lower()

    if not full_name or len(full_name) < 3:
        return jsonify({'message': 'Full name must be at least 3 characters'}), 400
    if not email or '@' not in email:
        return jsonify({'message': 'Please enter a valid email'}), 400

    existing = User.query.filter(User.email == email, User.user_id != user.user_id).first()
    if existing:
        return jsonify({'message': 'Email already in use'}), 409

    user.full_name = full_name
    user.email = email
    db.session.commit()
    session['user_name'] = user.full_name
    return jsonify({'message': 'Profile updated', 'success': True, 'data': user.to_dict()})