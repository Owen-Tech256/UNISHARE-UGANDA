"""
Schools API - powers the school selector in the register page.

The schools table doubles as this project's school-category list
(single-university scope, per docs/migration_plan.md).
"""
from flask import jsonify

from models import School
from routes.auth import auth_bp


@auth_bp.route('/api/schools')
def get_schools():
    schools = School.query.order_by(School.school_name).all()
    return jsonify({'success': True, 'data': {'schools': [s.to_dict() for s in schools]}})
