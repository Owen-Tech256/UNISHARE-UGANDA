import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'unishare-uganda-dev-secret-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'unishare_uganda.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'resources')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB
    # Extended from project haily to match the frontend design's accepted formats
    ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png'}
    TEMP_PASSWORD_EXPIRY_HOURS = 24
    WTF_CSRF_ENABLED = True
