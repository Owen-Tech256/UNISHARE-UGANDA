"""
Admin routes - moderation & super admin. Ported from project haily's routes/admin.py.

Changes vs haily (per docs/migration_plan.md):
  - Roles: admin/class_rep -> super_admin/moderator/coordinator.
  - Moderation endpoints exist for BOTH roles:
      moderator    -> school-scoped (haily behavior)
      super_admin  -> global (no school filter)
  - Reports management: super_admin only (global); moderators keep queue/actions.
  - promote/demote reworked into generic assign-role/revoke-role (Step 5.4).
  - New POST /api/admin/users (staff creation with temp password).
"""
from flask import Blueprint, request, jsonify, session
from models import db, Resource, Report, User
from utils.auth import login_required, moderator_required, super_admin_required
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import secrets
import string

admin_bp = Blueprint('admin', __name__)

STAFF_ROLES = ['coordinator', 'moderator']


def _generate_temp_password(length=8):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# ============ MODERATION QUEUE ============

@admin_bp.route('/api/admin/moderation-queue')
@moderator_required
def get_moderation_queue():
    """Moderators: school-scoped queue (haily behavior)."""
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 100)
    status = request.args.get('status', 'pending').strip()

    query = Resource.query.filter_by(school_id=user.school_id, is_deleted=False)
    if status:
        query = query.filter(Resource.status == status)
    query = query.order_by(Resource.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True,
        'data': {
            'resources': [r.to_dict() for r in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': pagination.page
        }
    })


@admin_bp.route('/api/super-admin/moderation-queue')
@super_admin_required
def get_super_admin_moderation_queue():
    """Super admin: queue across ALL schools (optional school filter)."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 100)
    status = request.args.get('status', 'pending').strip()
    school_id = request.args.get('school_id', type=int)

    query = Resource.query.filter_by(is_deleted=False)
    if school_id:
        query = query.filter(Resource.school_id == school_id)
    if status:
        query = query.filter(Resource.status == status)
    query = query.order_by(Resource.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True,
        'data': {
            'resources': [r.to_dict() for r in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': pagination.page
        }
    })


def _moderate(resource_id, new_status, reason=None):
    """Shared approve/reject logic. Caller has verified the role."""
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    # School scoping applies to moderators only; super admin moderates globally
    if user.role != 'super_admin' and resource.school_id != user.school_id:
        return jsonify({'success': False, 'message': 'You can only moderate resources in your school'}), 403

    resource.status = new_status
    if new_status == 'approved':
        resource.rejection_reason = None
    else:
        resource.rejection_reason = reason
    db.session.commit()

    return jsonify({'success': True, 'message': f'Resource {new_status}', 'data': resource.to_dict()})


@admin_bp.route('/api/admin/resources/<int:resource_id>/approve', methods=['POST'])
@moderator_required
def approve_resource(resource_id):
    return _moderate(resource_id, 'approved')


@admin_bp.route('/api/admin/resources/<int:resource_id>/reject', methods=['POST'])
@moderator_required
def reject_resource(resource_id):
    data = request.get_json(silent=True) or {}
    reason = data.get('reason', '').strip()
    if not reason:
        return jsonify({'success': False, 'message': 'Rejection reason is required'}), 400
    return _moderate(resource_id, 'rejected', reason=reason)


@admin_bp.route('/api/super-admin/resources/<int:resource_id>/approve', methods=['POST'])
@super_admin_required
def super_admin_approve_resource(resource_id):
    return _moderate(resource_id, 'approved')


@admin_bp.route('/api/super-admin/resources/<int:resource_id>/reject', methods=['POST'])
@super_admin_required
def super_admin_reject_resource(resource_id):
    data = request.get_json(silent=True) or {}
    reason = data.get('reason', '').strip()
    if not reason:
        return jsonify({'success': False, 'message': 'Rejection reason is required'}), 400
    return _moderate(resource_id, 'rejected', reason=reason)


@admin_bp.route('/api/admin/resources/<int:resource_id>', methods=['PUT'])
@moderator_required
def edit_resource(resource_id):
    """Metadata edit before approval (moderator: own school; super admin: any)."""
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    if user.role != 'super_admin' and resource.school_id != user.school_id:
        return jsonify({'success': False, 'message': 'You can only edit resources in your school'}), 403

    data = request.get_json(silent=True) or {}
    if 'title' in data: resource.title = data['title'].strip()
    if 'course_code' in data: resource.course_code = data['course_code'].strip().upper()
    if 'course_name' in data: resource.course_name = data['course_name'].strip()
    if 'lecturer_name' in data: resource.lecturer_name = data['lecturer_name'].strip()
    if 'academic_year' in data: resource.academic_year = data['academic_year'].strip()
    if 'semester' in data: resource.semester = data['semester'].strip()
    if 'resource_type' in data: resource.resource_type = data['resource_type'].strip()
    if 'description' in data: resource.description = data['description'].strip()

    db.session.commit()
    return jsonify({'success': True, 'message': 'Resource updated', 'data': resource.to_dict()})


@admin_bp.route('/api/admin/resources/<int:resource_id>/soft-delete', methods=['POST'])
@super_admin_required
def soft_delete_resource(resource_id):
    """Remove a resource from public view. Super admin only (per plan Step 5.1)."""
    resource = Resource.query.get(resource_id)
    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    resource.is_deleted = True
    resource.deleted_at = datetime.utcnow()
    resource.deleted_by = session['user_id']
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource removed from public view'})


# ============ REPORTS ============

@admin_bp.route('/api/admin/reports')
@super_admin_required
def get_reports():
    """Super admin only (per plan Step 5.1); global, optional status filter."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 100)
    status = request.args.get('status', 'open').strip()

    query = Report.query.join(Resource).filter(Resource.is_deleted == False)  # noqa: E712
    if status:
        query = query.filter(Report.status == status)
    query = query.order_by(Report.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True,
        'data': {
            'reports': [r.to_dict() for r in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': pagination.page
        }
    })


@admin_bp.route('/api/admin/reports/<int:report_id>/resolve', methods=['POST'])
@super_admin_required
def resolve_report(report_id):
    report = Report.query.get(report_id)
    if not report:
        return jsonify({'success': False, 'message': 'Report not found'}), 404

    report.status = 'resolved'
    db.session.commit()

    return jsonify({'success': True, 'message': 'Report resolved', 'data': report.to_dict()})


# ============ DASHBOARD STATS ============

@admin_bp.route('/api/admin/stats')
@login_required
def get_stats():
    user = User.query.get(session['user_id'])

    if user.role not in ['moderator', 'super_admin']:
        return jsonify({'success': False, 'message': 'Insufficient permissions'}), 403

    stats = {}
    if user.role == 'moderator':
        # School-scoped (haily behavior)
        school_id = user.school_id
        stats['pending'] = Resource.query.filter_by(school_id=school_id, status='pending', is_deleted=False).count()
        stats['approved'] = Resource.query.filter_by(school_id=school_id, status='approved', is_deleted=False).count()
        stats['rejected'] = Resource.query.filter_by(school_id=school_id, status='rejected', is_deleted=False).count()
    else:
        # Super admin: global counts
        stats['pending'] = Resource.query.filter_by(status='pending', is_deleted=False).count()
        stats['approved'] = Resource.query.filter_by(status='approved', is_deleted=False).count()
        stats['rejected'] = Resource.query.filter_by(status='rejected', is_deleted=False).count()
        stats['total_students'] = User.query.filter_by(role='student').count()
        stats['total_coordinators'] = User.query.filter_by(role='coordinator').count()
        stats['total_moderators'] = User.query.filter_by(role='moderator').count()
        stats['pending_reports'] = Report.query.join(Resource).filter(
            Report.status == 'open',
            Resource.is_deleted == False  # noqa: E712
        ).count()

    return jsonify({'success': True, 'data': stats})


# ============ USER MANAGEMENT (super admin) ============

@admin_bp.route('/api/admin/users')
@super_admin_required
def get_users():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    search = request.args.get('search', '').strip()
    role = request.args.get('role', '').strip()

    query = User.query
    if search:
        pattern = f'%{search}%'
        query = query.filter(
            db.or_(
                User.full_name.ilike(pattern),
                User.student_number.ilike(pattern),
                User.staff_id.ilike(pattern),
                User.email.ilike(pattern)
            )
        )
    if role:
        query = query.filter(User.role == role)

    query = query.order_by(User.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True,
        'data': {
            'users': [u.to_dict() for u in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': pagination.page
        }
    })


@admin_bp.route('/api/admin/users', methods=['POST'])
@super_admin_required
def create_staff_user():
    """Create a staff account (coordinator/moderator) with a temp password (haily logic)."""
    data = request.get_json(silent=True) or {}

    full_name = data.get('full_name', '').strip()
    staff_id = data.get('staff_id', '').strip()
    email = data.get('email', '').strip().lower()
    role = data.get('role', '').strip()
    school_id = data.get('school_id')

    if not full_name or not staff_id or not email or not school_id:
        return jsonify({'success': False, 'message': 'Full name, staff ID, email and school are required'}), 400
    if role not in STAFF_ROLES:
        return jsonify({'success': False, 'message': "Role must be 'coordinator' or 'moderator'"}), 400

    if User.query.filter_by(staff_id=staff_id).first():
        return jsonify({'success': False, 'message': 'Staff ID already registered'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Email already registered'}), 409

    temp_password = _generate_temp_password()
    user = User(
        full_name=full_name,
        staff_id=staff_id,
        email=email,
        role=role,
        school_id=school_id,
        password_hash=generate_password_hash(temp_password),
        is_temp_password=True,
        temp_password_expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Staff account created',
        'data': {
            'user': user.to_dict(),
            'temp_password': temp_password,
            'expires_at': user.temp_password_expires_at.isoformat()
        }
    }), 201


@admin_bp.route('/api/admin/users/<int:user_id>/assign-role', methods=['POST'])
@super_admin_required
def assign_role(user_id):
    """Grant coordinator/moderator role. Works on students AND staff (role changes)."""
    target = User.query.get(user_id)
    if not target:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    role = data.get('role', '').strip()
    if role not in STAFF_ROLES:
        return jsonify({'success': False, 'message': "Role must be 'coordinator' or 'moderator'"}), 400

    if target.role == role:
        return jsonify({'success': False, 'message': f'User already has the {role} role'}), 400
    if target.role == 'super_admin':
        return jsonify({'success': False, 'message': 'Cannot assign roles to a super admin'}), 400

    old_role = target.role
    target.role = role
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'{target.full_name} assigned the {role} role (was {old_role})',
        'data': target.to_dict()
    })


@admin_bp.route('/api/admin/users/<int:user_id>/revoke-role', methods=['POST'])
@super_admin_required
def revoke_role(user_id):
    """Revoke coordinator/moderator role -> back to student. Takes effect immediately."""
    acting = User.query.get(session['user_id'])
    target = User.query.get(user_id)
    if not target:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    if target.role not in STAFF_ROLES:
        return jsonify({'success': False, 'message': 'Only coordinators and moderators can be revoked'}), 400
    if target.user_id == acting.user_id:
        return jsonify({'success': False, 'message': 'You cannot revoke your own role'}), 400

    target.role = 'student'
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'{target.full_name} revoked to student',
        'data': target.to_dict()
    })


@admin_bp.route('/api/admin/users/<int:user_id>/reset-password', methods=['POST'])
@super_admin_required
def reset_user_password(user_id):
    """Generate a temp password for any user except super admins (haily logic, generalized)."""
    target = User.query.get(user_id)
    if not target:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    if target.role == 'super_admin':
        return jsonify({'success': False, 'message': 'Super admin passwords cannot be reset here'}), 400

    temp_password = _generate_temp_password()
    target.password_hash = generate_password_hash(temp_password)
    target.is_temp_password = True
    target.temp_password_expires_at = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Temporary password generated',
        'data': {
            'temp_password': temp_password,
            'expires_at': target.temp_password_expires_at.isoformat(),
            'user_name': target.full_name
        }
    })
