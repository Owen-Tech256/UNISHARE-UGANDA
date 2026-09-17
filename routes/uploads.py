"""
Upload routes - ported from project haily's routes/uploads.py.

Changes vs haily (per docs/migration_plan.md):
  - class_rep_required -> uploader_required (coordinator + moderator + super_admin:
    the user's rule is that all three assigned roles can upload educational resources)
  - Description field added (frontend design's upload form has one)
  - New DELETE /api/uploads/<id> (withdraw a pending upload; soft-delete)
"""
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from models import db, Resource, User
from utils.auth import uploader_required
from utils.file_handler import save_uploaded_file

uploads_bp = Blueprint('uploads', __name__)

VALID_SEMESTERS = ['Semester 1', 'Semester 2']
VALID_TYPES = ['Notes', 'Past Paper', 'Slides', 'Summary']


@uploads_bp.route('/api/uploads')
@uploader_required
def get_my_uploads():
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 100)
    status = request.args.get('status', '').strip()

    query = Resource.query.filter_by(uploader_id=user.user_id, is_deleted=False)
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


@uploads_bp.route('/api/uploads/check-duplicate', methods=['POST'])
@uploader_required
def check_duplicate():
    """Check for potential duplicates before upload (haily logic)."""
    user = User.query.get(session['user_id'])
    data = request.get_json(silent=True) or {}

    query = Resource.query.filter_by(
        uploader_id=user.user_id,
        is_deleted=False,
        course_code=data.get('course_code', '').strip(),
        academic_year=data.get('academic_year', '').strip(),
        semester=data.get('semester', '').strip(),
        resource_type=data.get('resource_type', '').strip()
    )

    if data.get('title'):
        query = query.filter(Resource.title.ilike(f"%{data['title'].strip()}%"))

    duplicates = query.all()
    return jsonify({
        'success': True,
        'data': {
            'duplicates': [d.to_dict() for d in duplicates],
            'count': len(duplicates)
        }
    })


@uploads_bp.route('/api/uploads', methods=['POST'])
@uploader_required
def upload_resource():
    user = User.query.get(session['user_id'])

    title = request.form.get('title', '').strip()
    course_code = request.form.get('course_code', '').strip()
    course_name = request.form.get('course_name', '').strip()
    lecturer_name = request.form.get('lecturer_name', '').strip()
    academic_year = request.form.get('academic_year', '').strip()
    semester = request.form.get('semester', '').strip()
    resource_type = request.form.get('resource_type', '').strip()
    description = request.form.get('description', '').strip()
    file = request.files.get('file')

    # Validation (haily rules)
    errors = []
    if not title or len(title) < 3:
        errors.append('Title must be at least 3 characters.')
    if not course_code:
        errors.append('Course code is required.')
    if not course_name:
        errors.append('Course name is required.')
    if not lecturer_name:
        errors.append('Lecturer name is required.')
    if not academic_year:
        errors.append('Academic year is required.')
    if semester not in VALID_SEMESTERS:
        errors.append('Please select a valid semester.')
    if resource_type not in VALID_TYPES:
        errors.append('Please select a valid resource type.')
    if not file or file.filename == '':
        errors.append('Please select a file to upload.')

    if errors:
        return jsonify({'success': False, 'message': '; '.join(errors)}), 400

    # Save file (validates extension, generates uuid name)
    try:
        file_path = save_uploaded_file(file)
    except ValueError as e:
        return jsonify({'success': False, 'message': str(e)}), 400

    original_filename = secure_filename(file.filename)

    resource = Resource(
        title=title,
        course_code=course_code.upper(),
        course_name=course_name,
        lecturer_name=lecturer_name,
        academic_year=academic_year,
        semester=semester,
        resource_type=resource_type,
        description=description if description else None,
        file_path=file_path,
        original_filename=original_filename,
        status='pending',
        uploader_id=user.user_id,
        school_id=user.school_id
    )
    db.session.add(resource)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Resource uploaded successfully. Awaiting moderation.',
        'data': resource.to_dict()
    }), 201


@uploads_bp.route('/api/uploads/<int:resource_id>', methods=['PUT'])
@uploader_required
def update_upload(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    if resource.uploader_id != user.user_id:
        return jsonify({'success': False, 'message': 'You can only edit your own uploads'}), 403

    data = request.form if request.form else (request.get_json(silent=True) or {})

    if 'title' in data: resource.title = data['title'].strip()
    if 'course_code' in data: resource.course_code = data['course_code'].strip().upper()
    if 'course_name' in data: resource.course_name = data['course_name'].strip()
    if 'lecturer_name' in data: resource.lecturer_name = data['lecturer_name'].strip()
    if 'academic_year' in data: resource.academic_year = data['academic_year'].strip()
    if 'semester' in data: resource.semester = data['semester'].strip()
    if 'resource_type' in data: resource.resource_type = data['resource_type'].strip()
    if 'description' in data: resource.description = data['description'].strip()

    # Optional file replacement
    file = request.files.get('file')
    if file and file.filename:
        try:
            new_path = save_uploaded_file(file)
            resource.file_path = new_path
            resource.original_filename = secure_filename(file.filename)
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400

    # Reset to pending for re-moderation (haily behavior)
    resource.status = 'pending'
    resource.rejection_reason = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource updated and resubmitted for moderation', 'data': resource.to_dict()})


@uploads_bp.route('/api/uploads/<int:resource_id>/resubmit', methods=['POST'])
@uploader_required
def resubmit_upload(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    if resource.uploader_id != user.user_id:
        return jsonify({'success': False, 'message': 'You can only resubmit your own uploads'}), 403

    if resource.status != 'rejected':
        return jsonify({'success': False, 'message': 'Only rejected resources can be resubmitted'}), 400

    resource.status = 'pending'
    resource.rejection_reason = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource resubmitted for moderation', 'data': resource.to_dict()})


@uploads_bp.route('/api/uploads/<int:resource_id>', methods=['DELETE'])
@uploader_required
def withdraw_upload(resource_id):
    """Withdraw = soft-delete own upload. Only while still pending."""
    user = User.query.get(session['user_id'])
    resource = Resource.query.get(resource_id)

    if not resource or resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    if resource.uploader_id != user.user_id:
        return jsonify({'success': False, 'message': 'You can only withdraw your own uploads'}), 403

    if resource.status != 'pending':
        return jsonify({'success': False, 'message': 'Only pending uploads can be withdrawn'}), 400

    resource.is_deleted = True
    db.session.commit()

    return jsonify({'success': True, 'message': 'Upload withdrawn'})
