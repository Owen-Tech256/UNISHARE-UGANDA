"""
Application configuration.

APP_ENV selects the profile:
  - development (default): dev SECRET_KEY fallback, debug allowed
  - production: SECRET_KEY must come from the environment (fail fast),
    DEBUG forced off.

Environment variables:
  - SECRET_KEY             session signing secret (required in production)
  - APP_ENV                'development' | 'production'
  - SUPER_ADMIN_PASSWORD   initial super admin password used by init_db.py
  - STUDENT_EMAIL_DOMAIN   institutional email domain for registration
"""
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

APP_ENV = os.environ.get('APP_ENV', 'development')


class Config:
    # Fail fast in production: no silent fallback to a dev secret.
    if APP_ENV == 'production' and not os.environ.get('SECRET_KEY'):
        raise RuntimeError(
            'SECRET_KEY environment variable is required when APP_ENV=production.'
        )

    SECRET_KEY = os.environ.get('SECRET_KEY') or 'unishare-uganda-dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'unishare_uganda.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'resources')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB
    # Extended from project haily to match the frontend design's accepted formats
    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png'}
    TEMP_PASSWORD_EXPIRY_HOURS = 24
    WTF_CSRF_ENABLED = True
    # Registration domain check (haily enforced @nkumbauniversity.ac.ug)
    STUDENT_EMAIL_DOMAIN = os.environ.get('STUDENT_EMAIL_DOMAIN', 'unishare.ug')
