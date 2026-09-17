from flask import Blueprint, render_template, request, jsonify, session, send_file, current_app
from models import db, Resource, School, Report, Upvote, User
from utils.auth import login_required, student_required
from utils.file_handler import get_full_path
from utils.permissions import can_user_access_resource
from datetime import datetime
import os

resources_bp = Blueprint('resources', __name__)


@resources_bp.route('/browse')
@student_required
def browse():
    schools = School.query.all()
    return render_template('browse.html', schools=schools)


@resources_bp.route('/api/resources', methods=['GET'])
@student_required
def get_resources():
    """Get approved resources with filtering and search."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    search = request.args.get('search', '').strip()
    school_id = request.args.get('school_id', type=int)
    course_code = request.args.get('course_code', '').strip()
    resource_type = request.args.get('resource_type', '').strip()
    semester = request.args.get('semester', '').strip()
    academic_year = request.args.get('academic_year', '').strip()
    sort = request.args.get('sort', 'newest')

    query = Resource.query.filter_by(is_deleted=False, status='approved')

    if school_id:
        query = query.filter(Resource.school_id == school_id)
    if course_code:
        query = query.filter(Resource.course_code.ilike(f'%{course_code}%'))
    if resource_type:
        query = query.filter(Resource.resource_type == resource_type)
    if semester:
        query = query.filter(Resource.semester == semester)
    if academic_year:
        query = query.filter(Resource.academic_year == academic_year)
    if search:
        search_pattern = f'%{search}%'
        query = query.filter(
            db.or_(
                Resource.title.ilike(search_pattern),
                Resource.course_code.ilike(search_pattern),
                Resource.course_name.ilike(search_pattern),
                Resource.lecturer_name.ilike(search_pattern)
            )
        )

    if sort == 'newest':
        query = query.order_by(Resource.created_at.desc())
    elif sort == 'oldest':
        query = query.order_by(Resource.created_at.asc())
    elif sort == 'popular':
        query = query.order_by(Resource.upvotes.desc())
    elif sort == 'title':
        query = query.order_by(Resource.title.asc())

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


@resources_bp.route('/resource/<int:resource_id>')
@student_required
def resource_detail(resource_id):
    resource = Resource.query.get_or_404(resource_id)
    if not can_user_access_resource(User.query.get(session['user_id']), resource):
        from flask import abort
        abort(404)
    return render_template('resource_detail.html', resource=resource)


@resources_bp.route('/download/<int:resource_id>')
@login_required
def download_resource(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    # Students can only download approved resources
    if user.role in ['student', 'class_rep'] and resource.status != 'approved':
        if not (user.role == 'class_rep' and resource.uploader_id == user.user_id):
            return jsonify({'success': False, 'message': 'Resource not available'}), 403

    # Staff can download pending resources in their school
    if user.role in ['moderator', 'admin']:
        if resource.school_id != user.school_id:
            return jsonify({'success': False, 'message': 'Access denied'}), 403

    file_path = get_full_path(resource.file_path)
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'message': 'File not found on server'}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=resource.original_filename
    )


@resources_bp.route('/api/resources/<int:resource_id>/upvote', methods=['POST'])
@student_required
def upvote_resource(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.is_deleted or resource.status != 'approved':
        return jsonify({'success': False, 'message': 'Resource not available'}), 404

    # Check if already upvoted
    existing = Upvote.query.filter_by(resource_id=resource_id, user_id=user.user_id).first()
    if existing:
        # Remove upvote (toggle)
        db.session.delete(existing)
        resource.upvotes = max(0, resource.upvotes - 1)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Upvote removed', 'data': {'upvotes': resource.upvotes, 'upvoted': False}})

    upvote = Upvote(resource_id=resource_id, user_id=user.user_id)
    db.session.add(upvote)
    resource.upvotes += 1
    db.session.commit()

    return jsonify({'success': True, 'message': 'Upvoted', 'data': {'upvotes': resource.upvotes, 'upvoted': True}})


@resources_bp.route('/api/resources/<int:resource_id>/report', methods=['POST'])
@student_required
def report_resource(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    data = request.json or {}
    reason = data.get('reason', '').strip()
    comment = data.get('comment', '').strip()

    valid_reasons = [
        'Wrong academic material',
        'Duplicate resource',
        'Inappropriate content',
        'Incorrect course information',
        'Copyright/problematic material',
        'Other'
    ]

    if reason not in valid_reasons:
        return jsonify({'success': False, 'message': 'Invalid report reason'}), 400

    # Check for duplicate report by same user
    existing = Report.query.filter_by(resource_id=resource_id, reporter_id=user.user_id, status='open').first()
    if existing:
        return jsonify({'success': False, 'message': 'You have already reported this resource'}), 409

    report = Report(
        resource_id=resource_id,
        reporter_id=user.user_id,
        reason=reason,
        comment=comment if comment else None
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({'success': True, 'message': 'Report submitted successfully'})


@resources_bp.route('/api/resources/<int:resource_id>/upvote-status')
@login_required
def upvote_status(resource_id):
    user = User.query.get(session['user_id'])
    upvote = Upvote.query.filter_by(resource_id=resource_id, user_id=user.user_id).first()
    return jsonify({'success': True, 'data': {'upvoted': upvote is not None}})