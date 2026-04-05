from flask import Blueprint, request, jsonify, current_app, send_from_directory
from api.middleware.auth import require_auth
from werkzeug.utils import secure_filename
import os
import uuid

media_bp = Blueprint('media', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@media_bp.route('/uploads', methods=['POST'])
@require_auth
def upload_files():
    """Upload one or more image files. Returns list of accessible URLs."""
    files = request.files.getlist('images') or []
    if not files:
        return jsonify({"success": False, "message": "No files provided"}), 400

    upload_dir = os.path.join(current_app.root_path, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    saved = []
    for f in files:
        if not f or not getattr(f, 'filename', None):
            continue
        filename = secure_filename(f.filename)
        if not allowed_file(filename):
            continue
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        dest = os.path.join(upload_dir, unique_name)
        f.save(dest)
        saved.append(f"/uploads/{unique_name}")

    if not saved:
        return jsonify({"success": False, "message": "No valid image files received"}), 400

    return jsonify({"success": True, "files": saved}), 201


@media_bp.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    upload_dir = os.path.join(current_app.root_path, 'uploads')
    return send_from_directory(upload_dir, filename)
