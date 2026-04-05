from flask import Blueprint, request, jsonify, current_app, send_from_directory, url_for
from api.middleware.auth import require_auth
from werkzeug.utils import secure_filename
import os
import uuid
import io
from PIL import Image

media_bp = Blueprint('media', __name__)

# Allowed extensions and default limits
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
DEFAULT_MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB per file
DEFAULT_MAX_IMAGE_DIM = 1024  # max width/height in pixels


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@media_bp.route('/uploads', methods=['POST'])
@require_auth
def upload_files():
    """Upload one or more image files. Validates type/size and optionally resizes.

    Form field: `images` (one or more files)
    App config (optional):
      - MAX_UPLOAD_SIZE_BYTES: per-file size limit (default 5MB)
      - MAX_IMAGE_DIM: max width/height in px to resize (default 1024)
      - RESIZE_ON_UPLOAD: True/False whether to resize large images (default True)
    """
    files = request.files.getlist('images') or []
    if not files:
        return jsonify({"success": False, "message": "No files provided"}), 400

    max_size = int(current_app.config.get('MAX_UPLOAD_SIZE_BYTES', DEFAULT_MAX_UPLOAD_SIZE))
    max_dim = int(current_app.config.get('MAX_IMAGE_DIM', DEFAULT_MAX_IMAGE_DIM))
    resize_on_upload = bool(current_app.config.get('RESIZE_ON_UPLOAD', True))

    upload_dir = os.path.join(current_app.root_path, 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    saved = []
    errors = []

    for f in files:
        if not f or not getattr(f, 'filename', None):
            errors.append('empty filename')
            continue

        filename = secure_filename(f.filename)
        if not allowed_file(filename):
            errors.append(f"invalid extension: {filename}")
            continue

        # Read file bytes to enforce size and validate image
        data = f.read()
        if not data:
            errors.append(f"empty file: {filename}")
            continue

        if len(data) > max_size:
            errors.append(f"file too large: {filename} (>{max_size} bytes)")
            continue

        # Validate image content with Pillow
        try:
            img = Image.open(io.BytesIO(data))
            img.verify()
        except Exception:
            errors.append(f"not a valid image: {filename}")
            continue

        # Re-open for processing (verify() leaves the file closed)
        img = Image.open(io.BytesIO(data))

        # Optionally resize large images
        try:
            if resize_on_upload:
                original_size = img.size
                if max(original_size) > max_dim:
                    img.thumbnail((max_dim, max_dim), Image.LANCZOS)

            # Ensure correct mode for saving (JPEG does not accept RGBA)
            save_kwargs = {}
            fmt = img.format or filename.rsplit('.', 1)[1].upper()
            if fmt.upper() in ('JPEG', 'JPG'):
                if img.mode in ('RGBA', 'LA'):
                    img = img.convert('RGB')
                save_kwargs['quality'] = 85

            unique_name = f"{uuid.uuid4().hex}_{filename}"
            dest = os.path.join(upload_dir, unique_name)

            # Save image via Pillow to ensure any resize/formatting is applied
            img.save(dest, format=fmt, **save_kwargs)

            try:
                public_url = url_for('media.serve_upload', filename=unique_name, _external=True)
            except Exception:
                public_url = f"/api/uploads/{unique_name}"

            saved.append(public_url)
        except Exception as e:
            errors.append(f"failed processing {filename}: {e}")

    if errors and not saved:
        return jsonify({"success": False, "errors": errors}), 400

    return jsonify({"success": True, "files": saved, "errors": errors}), 201


@media_bp.route('/uploads/<path:filename>', methods=['GET'])
def serve_upload(filename):
    upload_dir = os.path.join(current_app.root_path, 'uploads')
    return send_from_directory(upload_dir, filename)
