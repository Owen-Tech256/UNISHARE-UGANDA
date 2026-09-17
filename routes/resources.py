"""
Resource routes - ported from project haily's routes/resources.py.

Changes vs haily (per docs/migration_plan.md section 2):
  - Browsing, detail, and downloading are PUBLIC (no login required)
  - Detail is a JSON API returning the resource + related resources
  - Non-approved resources remain visible only to their uploader and
    same-school staff
"""
from flask import Blueprint, request, jsonify, session, send_file
from models import db, Resource, User, Upvote, Report, Comment
from utils.file_handler import get_full_path
from utils.auth import login_required
import os

resources_bp = Blueprint('resources', __name__)

RESOURCE_TYPES = ['Notes', 'Past Paper', 'Slides', 'Summary']

# Report reasons use the frontend design's modal labels
REPORT_REASONS = ['Wrong course', 'Outdated', 'Incorrect content', 'Duplicate', 'Inappropriate', 'Other']


def _current_user():
    if 'user_id' in session:
        return User.query.get(session['user_id'])
    return None


def _can_view(user, resource):
    """Approved resources are public; non-approved only for uploader/staff."""
    if not resource or resource.is_deleted:
        return False
    if resource.status == 'approved':
        return True
    if user is None:
        return False
    if user.role in ['moderator', 'super_admin']:
        return user.school_id == resource.school_id
    return resource.uploader_id == user.user_id


@resources_bp.route('/api/resources')
def get_resources():
    """List approved resources with filtering, search, sort, pagination."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 12, type=int), 100)
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


@resources_bp.route('/api/resources/<int:resource_id>')
def get_resource_detail(resource_id):
    """Resource detail + related resources for the same course. Public."""
    resource = Resource.query.get(resource_id)
    user = _current_user()

    if not _can_view(user, resource):
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    related = Resource.query.filter(
        Resource.course_code == resource.course_code,
        Resource.resource_id != resource.resource_id,
        Resource.status == 'approved',
        Resource.is_deleted == False  # noqa: E712
    ).order_by(Resource.created_at.desc()).limit(4).all()

    return jsonify({
        'success': True,
        'data': {
            'resource': resource.to_dict(),
            'related': [r.to_dict() for r in related]
        }
    })


@resources_bp.route('/download/<int:resource_id>')
def download_resource(resource_id):
    """Download a resource file. Public for approved resources."""
    user = _current_user()
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    if resource.status != 'approved':
        allowed = user is not None and (
            resource.uploader_id == user.user_id or
            (user.role in ['moderator', 'super_admin'] and user.school_id == resource.school_id)
        )
        if not allowed:
            return jsonify({'success': False, 'message': 'Resource not available'}), 403

    file_path = get_full_path(resource.file_path)
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'message': 'File not found on server'}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=resource.original_filename
    )


@resources_bp.route('/api/resources/<int:resource_id>/upvote', methods=['POST'])
@login_required
def upvote_resource(resource_id):
    """Toggle upvote for the current user (haily logic)."""
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted or resource.status != 'approved':
        return jsonify({'success': False, 'message': 'Resource not available'}), 404

    existing = Upvote.query.filter_by(resource_id=resource_id, user_id=user.user_id).first()
    if existing:
        db.session.delete(existing)
        resource.upvotes = max(0, resource.upvotes - 1)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Upvote removed',
                        'data': {'upvotes': resource.upvotes, 'upvoted': False}})

    upvote = Upvote(resource_id=resource_id, user_id=user.user_id)
    db.session.add(upvote)
    resource.upvotes += 1
    db.session.commit()

    return jsonify({'success': True, 'message': 'Upvoted',
                    'data': {'upvotes': resource.upvotes, 'upvoted': True}})


@resources_bp.route('/api/resources/<int:resource_id>/upvote-status')
@login_required
def upvote_status(resource_id):
    user = User.query.get(session['user_id'])
    upvote = Upvote.query.filter_by(resource_id=resource_id, user_id=user.user_id).first()
    return jsonify({'success': True, 'data': {'upvoted': upvote is not None}})


@resources_bp.route('/api/resources/<int:resource_id>/report', methods=['POST'])
@login_required
def report_resource(resource_id):
    """Report a resource. Login required; one open report per user per resource."""
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    data = request.get_json(silent=True) or {}
    reason = data.get('reason', '').strip()
    comment = data.get('comment', '').strip()

    if reason not in REPORT_REASONS:
        return jsonify({'success': False, 'message': 'Invalid report reason'}), 400

    existing = Report.query.filter_by(
        resource_id=resource_id, reporter_id=user.user_id, status='open').first()
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


# ============ COMMENTS (new feature - haily patterns) ============

@resources_bp.route('/api/resources/<int:resource_id>/comments')
def get_comments(resource_id):
    """List comments for a resource. Public reading; login only to post."""
    resource = Resource.query.get(resource_id)
    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    comments = Comment.query.filter_by(
        resource_id=resource_id, is_deleted=False
    ).order_by(Comment.created_at.asc()).all()

    return jsonify({
        'success': True,
        'data': {'comments': [c.to_dict() for c in comments]}
    })


@resources_bp.route('/api/resources/<int:resource_id>/comments', methods=['POST'])
@login_required
def add_comment(resource_id):
    """Post a comment. Login required; body must be 1-2000 characters."""
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    data = request.get_json(silent=True) or {}
    body = str(data.get('body', '')).strip()

    if not body:
        return jsonify({'success': False, 'message': 'Comment cannot be empty'}), 400
    if len(body) > 2000:
        return jsonify({'success': False, 'message': 'Comment must be at most 2000 characters'}), 400

    comment = Comment(resource_id=resource_id, user_id=user.user_id, body=body)
    db.session.add(comment)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Comment posted',
        'data': {'comment': comment.to_dict()}
    }), 201


@resources_bp.route('/api/comments/<int:comment_id>', methods=['DELETE'])
@login_required
def delete_comment(comment_id):
    """Soft-delete a comment. Allowed for its author or same-school staff."""
    user = User.query.get(session['user_id'])
    comment = Comment.query.get(comment_id)

    if not comment or comment.is_deleted:
        return jsonify({'success': False, 'message': 'Comment not found'}), 404

    is_owner = comment.user_id == user.user_id
    is_staff = user.role in ['moderator', 'super_admin'] and user.school_id == comment.resource.school_id
    if not (is_owner or is_staff):
        return jsonify({'success': False, 'message': 'You can only delete your own comments'}), 403

    comment.is_deleted = True
    db.session.commit()

    return jsonify({'success': True, 'message': 'Comment deleted'})
