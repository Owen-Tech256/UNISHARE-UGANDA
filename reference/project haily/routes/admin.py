from flask import Blueprint, render_template, request, jsonify, session
from models import db, Resource, Report, User, School
from utils.auth import login_required, moderator_required, admin_required, staff_required, school_access_required
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import secrets
import string
import os
from utils.file_handler import get_full_path

admin_bp = Blueprint('admin', __name__)


# ============ MODERATOR ROUTES ============

@admin_bp.route('/admin/moderation-queue')
@moderator_required
def moderation_queue():
    return render_template('admin/moderation_queue.html')


@admin_bp.route('/api/admin/moderation-queue', methods=['GET'])
@moderator_required
def get_moderation_queue():
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
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


@admin_bp.route('/api/admin/resources/<int:resource_id>/approve', methods=['POST'])
@moderator_required
def approve_resource(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.school_id != user.school_id:
        return jsonify({'success': False, 'message': 'You can only moderate resources in your school'}), 403

    if resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    resource.status = 'approved'
    resource.rejection_reason = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource approved successfully', 'data': resource.to_dict()})


@admin_bp.route('/api/admin/resources/<int:resource_id>/reject', methods=['POST'])
@moderator_required
def reject_resource(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.school_id != user.school_id:
        return jsonify({'success': False, 'message': 'You can only moderate resources in your school'}), 403

    if resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    data = request.json or {}
    reason = data.get('reason', '').strip()

    if not reason:
        return jsonify({'success': False, 'message': 'Rejection reason is required'}), 400

    resource.status = 'rejected'
    resource.rejection_reason = reason
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource rejected', 'data': resource.to_dict()})


@admin_bp.route('/api/admin/resources/<int:resource_id>', methods=['PUT'])
@moderator_required
def edit_resource(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.school_id != user.school_id:
        return jsonify({'success': False, 'message': 'You can only edit resources in your school'}), 403

    data = request.json or {}
    if 'title' in data: resource.title = data['title'].strip()
    if 'course_code' in data: resource.course_code = data['course_code'].strip().upper()
    if 'course_name' in data: resource.course_name = data['course_name'].strip()
    if 'lecturer_name' in data: resource.lecturer_name = data['lecturer_name'].strip()
    if 'academic_year' in data: resource.academic_year = data['academic_year'].strip()
    if 'semester' in data: resource.semester = data['semester'].strip()
    if 'resource_type' in data: resource.resource_type = data['resource_type'].strip()

    db.session.commit()
    return jsonify({'success': True, 'message': 'Resource updated', 'data': resource.to_dict()})


@admin_bp.route('/api/admin/users/<int:user_id>/reset-password', methods=['POST'])
@moderator_required
def reset_user_password(user_id):
    moderator = User.query.get(session['user_id'])
    target_user = User.query.get_or_404(user_id)

    if target_user.school_id != moderator.school_id:
        return jsonify({'success': False, 'message': 'You can only reset passwords for students in your school'}), 403

    if target_user.role not in ['student', 'class_rep']:
        return jsonify({'success': False, 'message': 'Can only reset student/class rep passwords'}), 400

    # Generate 8-character temp password
    alphabet = string.ascii_letters + string.digits
    temp_password = ''.join(secrets.choice(alphabet) for _ in range(8))

    target_user.password_hash = generate_password_hash(temp_password)
    target_user.is_temp_password = True
    target_user.temp_password_expires_at = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Temporary password generated',
        'data': {
            'temp_password': temp_password,
            'expires_at': target_user.temp_password_expires_at.isoformat(),
            'user_name': target_user.full_name
        }
    })


# ============ ADMIN ROUTES ============
@admin_bp.route('/admin/users')
@admin_required
def users():
    user = User.query.get(session['user_id'])
    school_id = user.school_id
    
    # Calculate all stats server-side
    total_students = User.query.filter_by(school_id=school_id, role='student').count()
    total_class_reps = User.query.filter_by(school_id=school_id, role='class_rep').count()
    total_moderators = User.query.filter_by(school_id=school_id, role='moderator').count()
    total_admins = User.query.filter_by(school_id=school_id, role='admin').count()
    
    return render_template(
        'admin/users.html', 
        total_students=total_students, 
        total_class_reps=total_class_reps,
        total_moderators=total_moderators,
        total_admins=total_admins
    )


@admin_bp.route('/api/admin/users', methods=['GET'])
@admin_required
def get_users():
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    role = request.args.get('role', '').strip()

    query = User.query.filter_by(school_id=user.school_id)
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


@admin_bp.route('/api/admin/users/<int:user_id>/promote', methods=['POST'])
@admin_required
def promote_user(user_id):
    admin = User.query.get(session['user_id'])
    target = User.query.get_or_404(user_id)

    if target.school_id != admin.school_id:
        return jsonify({'success': False, 'message': 'You can only manage users in your school'}), 403

    if target.role != 'student':
        return jsonify({'success': False, 'message': 'Only students can be promoted to Class Rep'}), 400

    target.role = 'class_rep'
    db.session.commit()

    return jsonify({'success': True, 'message': f'{target.full_name} promoted to Class Representative', 'data': target.to_dict()})


@admin_bp.route('/api/admin/users/<int:user_id>/demote', methods=['POST'])
@admin_required
def demote_user(user_id):
    admin = User.query.get(session['user_id'])
    target = User.query.get_or_404(user_id)

    if target.school_id != admin.school_id:
        return jsonify({'success': False, 'message': 'You can only manage users in your school'}), 403

    if target.role != 'class_rep':
        return jsonify({'success': False, 'message': 'Only Class Reps can be demoted'}), 400

    target.role = 'student'
    db.session.commit()

    return jsonify({'success': True, 'message': f'{target.full_name} demoted to Student', 'data': target.to_dict()})


# ============ REPORTS ============

@admin_bp.route('/admin/reports')
@admin_required
def reports():
    return render_template('admin/reports.html')


@admin_bp.route('/api/admin/reports', methods=['GET'])
@admin_required
def get_reports():
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status = request.args.get('status', 'open').strip()

    # Get reports for resources in admin's school
    query = Report.query.join(Resource).filter(
        Resource.school_id == user.school_id,
        Resource.is_deleted == False
    )
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
@admin_required
def resolve_report(report_id):
    admin = User.query.get(session['user_id'])
    report = Report.query.get_or_404(report_id)
    resource = Resource.query.get(report.resource_id)

    if not resource or resource.school_id != admin.school_id:
        return jsonify({'success': False, 'message': 'You can only resolve reports in your school'}), 403

    report.status = 'resolved'
    db.session.commit()

    return jsonify({'success': True, 'message': 'Report resolved', 'data': report.to_dict()})


@admin_bp.route('/api/admin/resources/<int:resource_id>/soft-delete', methods=['POST'])
@admin_required
def soft_delete_resource(resource_id):
    admin = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.school_id != admin.school_id:
        return jsonify({'success': False, 'message': 'You can only manage resources in your school'}), 403

    resource.is_deleted = True
    resource.deleted_at = datetime.utcnow()
    resource.deleted_by = admin.user_id
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource removed from public view'})


# ============ DASHBOARD STATS ============

@admin_bp.route('/api/admin/stats')
@staff_required
def get_stats():
    user = User.query.get(session['user_id'])
    school_id = user.school_id

    stats = {}
    if user.role == 'moderator':
        stats['pending'] = Resource.query.filter_by(school_id=school_id, status='pending', is_deleted=False).count()
        stats['approved'] = Resource.query.filter_by(school_id=school_id, status='approved', is_deleted=False).count()
        stats['rejected'] = Resource.query.filter_by(school_id=school_id, status='rejected', is_deleted=False).count()
    elif user.role == 'admin':
        stats['total_students'] = User.query.filter_by(school_id=school_id, role='student').count()
        stats['total_class_reps'] = User.query.filter_by(school_id=school_id, role='class_rep').count()
        stats['pending_reports'] = Report.query.join(Resource).filter(
            Resource.school_id == school_id,
            Report.status == 'open',
            Resource.is_deleted == False
        ).count()
        stats['approved_resources'] = Resource.query.filter_by(school_id=school_id, status='approved', is_deleted=False).count()
        stats['reported_resources'] = Resource.query.join(Report).filter(
            Resource.school_id == school_id,
            Report.status == 'open',
            Resource.is_deleted == False
        ).distinct().count()

    return jsonify({'success': True, 'data': stats})