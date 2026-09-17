from functools import wraps
from flask import session, redirect, url_for, flash, jsonify, request
from models import User


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'success': False, 'message': 'Authentication required'}), 401
            flash('Please log in to continue.', 'warning')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated


def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if 'user_id' not in session:
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'success': False, 'message': 'Authentication required'}), 401
                return redirect(url_for('auth.login'))
            user = User.query.get(session['user_id'])
            if not user or user.role not in roles:
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'success': False, 'message': 'Insufficient permissions'}), 403
                flash('You do not have permission to access this page.', 'danger')
                return redirect(url_for('auth.login'))
            return f(*args, **kwargs)
        return decorated
    return decorator


def student_required(f):
    return role_required(['student', 'coordinator', 'moderator', 'super_admin'])(f)


def coordinator_required(f):
    return role_required(['coordinator'])(f)


def uploader_required(f):
    """Upload rights: coordinators, moderators and super admins (assigned roles;
    revocation by the super admin removes access immediately)."""
    return role_required(['coordinator', 'moderator', 'super_admin'])(f)


def moderator_required(f):
    # Super admin can also moderate (globally); see routes/admin.py
    return role_required(['moderator', 'super_admin'])(f)


def super_admin_required(f):
    return role_required(['super_admin'])(f)


def staff_required(f):
    return role_required(['moderator', 'super_admin'])(f)


def school_access_required(f):
    """Ensures staff can only access resources within their own school."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        user = User.query.get(session['user_id'])
        if not user or user.role not in ['moderator', 'super_admin']:
            return jsonify({'success': False, 'message': 'Insufficient permissions'}), 403
        # Pass user's school_id for downstream checks
        request.user_school_id = user.school_id
        return f(*args, **kwargs)
    return decorated
