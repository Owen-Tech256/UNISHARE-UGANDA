"""
Static page serving - serves the adapted frontend-design HTML pages.

The live pages are copies of the frontend/ design, adapted to talk to the
real API. They are served from the pages/ directory so the frontend/
reference folder is never modified.
"""
from flask import Blueprint, send_from_directory, abort
import os

pages_bp = Blueprint('pages', __name__)

PAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'pages'))


@pages_bp.route('/')
def home():
    return send_from_directory(PAGES_DIR, 'index.html')


@pages_bp.route('/<path:page>')
def serve_page(page):
    """Serves HTML pages from pages/ (e.g. login.html, admin/users.html)."""
    if not page.endswith('.html'):
        page += '.html'
    target = os.path.abspath(os.path.join(PAGES_DIR, page))
    # Path traversal guard
    if not target.startswith(PAGES_DIR + os.sep):
        abort(404)
    if os.path.isfile(target):
        return send_from_directory(PAGES_DIR, page)
    abort(404)
