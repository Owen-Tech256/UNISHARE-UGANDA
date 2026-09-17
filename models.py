"""
UniShare Uganda - SQLAlchemy models.

Schema ported from project haily (see MIGRATION_PLAN.md section 5) with two
adaptations:
  - Roles are: student | coordinator | moderator | super_admin
    (haily's class_rep -> coordinator, admin -> super_admin)
  - New Comment model for resource comments.
"""
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class School(db.Model):
    __tablename__ = 'schools'
    school_id = db.Column(db.Integer, primary_key=True)
    school_name = db.Column(db.String(100), nullable=False, unique=True)

    users = db.relationship('User', backref='school', lazy=True)
    resources = db.relationship('Resource', backref='school', lazy=True)

    def to_dict(self):
        return {'school_id': self.school_id, 'school_name': self.school_name}


class User(db.Model):
    __tablename__ = 'users'
    user_id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    student_number = db.Column(db.String(10), unique=True, nullable=True)
    staff_id = db.Column(db.String(20), unique=True, nullable=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')
    school_id = db.Column(db.Integer, db.ForeignKey('schools.school_id'), nullable=False)
    is_temp_password = db.Column(db.Boolean, default=False)
    temp_password_expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    resources = db.relationship('Resource', backref='uploader', lazy=True)
    reports = db.relationship('Report', backref='reporter', foreign_keys='Report.reporter_id', lazy=True)
    upvotes = db.relationship('Upvote', backref='user', lazy=True)
    comments = db.relationship('Comment', backref='author', lazy=True)

    @property
    def display_id(self):
        return self.student_number or self.staff_id

    def to_dict(self, include_sensitive=False):
        data = {
            'user_id': self.user_id,
            'full_name': self.full_name,
            'display_id': self.display_id,
            'email': self.email,
            'role': self.role,
            'school_id': self.school_id,
            'school_name': self.school.school_name if self.school else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_sensitive:
            data['student_number'] = self.student_number
            data['staff_id'] = self.staff_id
        return data


class Resource(db.Model):
    __tablename__ = 'resources'
    resource_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    course_code = db.Column(db.String(30), nullable=False)
    course_name = db.Column(db.String(150), nullable=False)
    lecturer_name = db.Column(db.String(150), nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    semester = db.Column(db.String(20), nullable=False)
    resource_type = db.Column(db.String(30), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='pending')
    rejection_reason = db.Column(db.Text, nullable=True)
    upvotes = db.Column(db.Integer, default=0)
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.school_id'), nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reports = db.relationship('Report', backref='resource', lazy=True)
    upvote_records = db.relationship('Upvote', backref='resource', lazy=True)
    comments = db.relationship('Comment', backref='resource', lazy=True)

    def to_dict(self):
        return {
            'resource_id': self.resource_id,
            'title': self.title,
            'course_code': self.course_code,
            'course_name': self.course_name,
            'lecturer_name': self.lecturer_name,
            'academic_year': self.academic_year,
            'semester': self.semester,
            'resource_type': self.resource_type,
            'status': self.status,
            'rejection_reason': self.rejection_reason,
            'upvotes': self.upvotes,
            'uploader_id': self.uploader_id,
            'uploader_name': self.uploader.full_name if self.uploader else None,
            'school_id': self.school_id,
            'school_name': self.school.school_name if self.school else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'original_filename': self.original_filename
        }


class Report(db.Model):
    __tablename__ = 'reports'
    report_id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, db.ForeignKey('resources.resource_id'), nullable=False)
    reporter_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    reason = db.Column(db.String(100), nullable=False)
    comment = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='open')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'report_id': self.report_id,
            'resource_id': self.resource_id,
            'resource_title': self.resource.title if self.resource else None,
            'reporter_id': self.reporter_id,
            'reporter_name': self.reporter.full_name if self.reporter else None,
            'reason': self.reason,
            'comment': self.comment,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Upvote(db.Model):
    __tablename__ = 'upvotes'
    upvote_id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, db.ForeignKey('resources.resource_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('resource_id', 'user_id', name='unique_user_resource_upvote'),)


class Comment(db.Model):
    __tablename__ = 'comments'
    comment_id = db.Column(db.Integer, primary_key=True)
    resource_id = db.Column(db.Integer, db.ForeignKey('resources.resource_id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'comment_id': self.comment_id,
            'resource_id': self.resource_id,
            'user_id': self.user_id,
            'user_name': self.author.full_name if self.author else None,
            'body': self.body,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
