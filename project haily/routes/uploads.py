from flask import Blueprint, render_template, request, jsonify, session, flash, redirect, url_for
from werkzeug.utils import secure_filename
from models import db, Resource, School, User
from utils.auth import login_required, class_rep_required
from utils.file_handler import save_uploaded_file, ALLOWED_EXTENSIONS
import os

uploads_bp = Blueprint('uploads', __name__)


@uploads_bp.route('/upload')
@class_rep_required
def upload_page():
    schools = School.query.all()
    return render_template('upload.html', schools=schools, allowed_extensions=ALLOWED_EXTENSIONS)


# THIS IS THE CORRECT, UNIFIED UPLOAD FUNCTION
@uploads_bp.route('/upload', methods=['POST'])
@class_rep_required
def upload_resource():
    user = User.query.get(session['user_id'])

    # 1. Get data from the form
    title = request.form.get('title', '').strip()
    course_code = request.form.get('course_code', '').strip()
    course_name = request.form.get('course_name', '').strip()
    lecturer_name = request.form.get('lecturer', '').strip() # Matches HTML name="lecturer"
    academic_year = request.form.get('academic_year', '').strip()
    semester = request.form.get('semester', '').strip()
    resource_type = request.form.get('resource_type', '').strip()
    file = request.files.get('file')

    # 2. Validation
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
    if semester not in ['Semester 1', 'Semester 2', 'Semester 3']:
        errors.append('Please select a valid semester.')
    if resource_type not in ['Notes', 'Past Paper', 'Slides', 'Summary']:
        errors.append('Please select a valid resource type.')
    if not file or file.filename == '':
        errors.append('Please select a file to upload.')

    if errors:
        for error in errors:
            flash(error, 'error')
        return redirect(url_for('uploads.upload_page'))

    # 3. Save file using your existing utility
    try:
        file_path = save_uploaded_file(file)
    except ValueError as e:
        flash(str(e), 'error')
        return redirect(url_for('uploads.upload_page'))

    original_filename = secure_filename(file.filename)

    # 4. Save to Database
    new_resource = Resource(
        title=title,
        course_code=course_code.upper(),
        course_name=course_name,
        lecturer_name=lecturer_name,
        academic_year=academic_year,
        semester=semester,
        resource_type=resource_type,
        file_path=file_path,
        original_filename=original_filename,
        status='pending',
        uploader_id=user.user_id,
        school_id=user.school_id
    )
    db.session.add(new_resource)
    db.session.commit()

    flash('Resource uploaded successfully! It is now pending moderator approval.', 'success')
    return redirect(url_for('uploads.my_uploads'))


@uploads_bp.route('/my-uploads')
@class_rep_required
def my_uploads():
    return render_template('my_uploads.html')


@uploads_bp.route('/api/uploads', methods=['GET'])
@class_rep_required
def get_my_uploads():
    user = User.query.get(session['user_id'])
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
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
@class_rep_required
def check_duplicate():
    """Check for potential duplicates before upload."""
    user = User.query.get(session['user_id'])
    data = request.json or {}

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


@uploads_bp.route('/api/uploads/<int:resource_id>', methods=['PUT'])
@class_rep_required
def update_upload(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.uploader_id != user.user_id:
        return jsonify({'success': False, 'message': 'You can only edit your own uploads'}), 403

    if resource.is_deleted:
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    data = request.form or request.json or {}

    resource.title = data.get('title', resource.title).strip()
    resource.course_code = data.get('course_code', resource.course_code).strip().upper()
    resource.course_name = data.get('course_name', resource.course_name).strip()
    resource.lecturer_name = data.get('lecturer_name', resource.lecturer_name).strip()
    resource.academic_year = data.get('academic_year', resource.academic_year).strip()
    resource.semester = data.get('semester', resource.semester).strip()
    resource.resource_type = data.get('resource_type', resource.resource_type).strip()

    # Handle file replacement
    file = request.files.get('file') if hasattr(request, 'files') else None
    if file and file.filename:
        try:
            new_path = save_uploaded_file(file)
            resource.file_path = new_path
            resource.original_filename = secure_filename(file.filename)
        except ValueError as e:
            return jsonify({'success': False, 'message': str(e)}), 400

    # Reset to pending for re-moderation
    resource.status = 'pending'
    resource.rejection_reason = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource updated and resubmitted for moderation', 'data': resource.to_dict()})


@uploads_bp.route('/api/uploads/<int:resource_id>/resubmit', methods=['POST'])
@class_rep_required
def resubmit_upload(resource_id):
    user = User.query.get(session['user_id'])
    resource = Resource.query.get_or_404(resource_id)

    if resource.uploader_id != user.user_id:
        return jsonify({'success': False, 'message': 'You can only resubmit your own uploads'}), 403

    if resource.status != 'rejected':
        return jsonify({'success': False, 'message': 'Only rejected resources can be resubmitted'}), 400

    resource.status = 'pending'
    resource.rejection_reason = None
    db.session.commit()

    return jsonify({'success': True, 'message': 'Resource resubmitted for moderation', 'data': resource.to_dict()})