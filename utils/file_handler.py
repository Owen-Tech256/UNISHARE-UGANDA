import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

from config import Config

ALLOWED_EXTENSIONS = Config.ALLOWED_EXTENSIONS


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def save_uploaded_file(file):
    """Saves an uploaded file securely and returns the relative path."""
    if not file or file.filename == '':
        raise ValueError('No file provided')

    if not allowed_file(file.filename):
        raise ValueError(f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}')

    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, unique_name)
    file.save(file_path)

    # Return relative path from project root
    return os.path.join('uploads', 'resources', unique_name)


def get_full_path(relative_path):
    """Converts relative path to absolute path."""
    return os.path.join(current_app.root_path, relative_path)


def delete_file(relative_path):
    """Deletes a file from disk."""
    try:
        full_path = get_full_path(relative_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
    except Exception:
        pass
    return False
