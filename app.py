"""
UniShare Uganda - Flask application factory.

Ported from project haily's app.py: blueprint registry, JSON/HTML
error-handling split, and session-based context injection, extended
with the pages blueprint that serves the adapted frontend-design HTML.
"""
import os
from flask import Flask, render_template, jsonify, request
from models import db
from config import Config
from routes.auth import auth_bp
from routes.resources import resources_bp
from routes.uploads import uploads_bp
from routes.admin import admin_bp
from routes.pages import pages_bp
import routes.schools  # noqa: F401  (registers /api/schools on auth_bp)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Initialize database
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(pages_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(resources_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(admin_bp)

    # ==========================================
    # ERROR HANDLERS (JSON for /api/*, HTML otherwise)
    # ==========================================
    @app.errorhandler(400)
    def bad_request(e):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'Bad request'}), 400
        return render_template('errors/400.html'), 400

    @app.errorhandler(401)
    def unauthorized(e):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        return render_template('errors/401.html'), 401

    @app.errorhandler(403)
    def forbidden(e):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'Forbidden'}), 403
        return render_template('errors/403.html'), 403

    @app.errorhandler(404)
    def not_found(e):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'Not found'}), 404
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_error(e):
        if request.is_json or request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'Internal server error'}), 500
        return render_template('errors/500.html'), 500

    # Context processor to pass current_user to all templates
    @app.context_processor
    def inject_user():
        from flask import session
        from models import User
        user = None
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
        return dict(current_user=user)

    return app


if __name__ == '__main__':
    app = create_app()
    # DEBUG is a development convenience; never in production profile.
    app.run(debug=(Config.APP_ENV != 'production'), host='0.0.0.0', port=5000)
