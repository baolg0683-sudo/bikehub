from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from marshmallow import Schema, fields, validate
import bcrypt
import datetime

# IMPORT TRỰC TIẾP ĐỐI TƯỢNG DB VÀ MODEL
from infrastructure.databases import db
from infrastructure.models.auth.user_model import UserModel

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# --- 1. ĐỊNH NGHĨA SCHEMA (KHÔNG ĐƯỢC THIẾU PHẦN NÀY) ---
class LoginSchema(Schema):
    username = fields.String(required=True)
    password = fields.String(required=True)

class SignupSchema(Schema):
    username = fields.String(
        required=True, 
        error_messages={"required": "Username là bắt buộc"}
    )
    password = fields.String(
        required=True, 
        validate=validate.Length(min=6, error="Mật khẩu phải có ít nhất 6 ký tự")
    )
    full_name = fields.String(required=False)
    phone = fields.String(required=False)
    role = fields.String(
        required=True, 
        validate=validate.OneOf(["ADMIN", "USER", "INSPECTOR"])
    )

# Khởi tạo biến để các hàm bên dưới gọi tới
login_schema = LoginSchema()
signup_schema = SignupSchema()

# --- 2. API ĐĂNG KÝ ---
@auth_bp.route('/signup', methods=['POST'])
def signup():
    db_session = db.session
    try:
        # Lấy data từ request
        json_data = request.get_json()
        if not json_data:
            return jsonify({"message": "Không có dữ liệu gửi lên"}), 400

        # Validate dữ liệu bằng signup_schema đã định nghĩa ở trên
        errors = signup_schema.validate(json_data)
        if errors:
            return jsonify({"message": "Dữ liệu không hợp lệ", "errors": errors}), 400

        # Kiểm tra trùng username
        existing_user = db_session.query(UserModel).filter(UserModel.username == json_data['username']).first()
        if existing_user:
            return jsonify({"message": "Tên đăng nhập đã tồn tại"}), 409

        # Hash mật khẩu
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(json_data['password'].encode('utf-8'), salt).decode('utf-8')

        new_user = UserModel(
            username=json_data['username'],
            password_hash=hashed_password,
            full_name=json_data.get('full_name', ''),
            phone=json_data.get('phone', ''),
            role=json_data['role']
        )
        
        db_session.add(new_user)
        db_session.commit()

        return jsonify({
            "message": "Đăng ký tài khoản thành công",
            "user_id": new_user.user_id
        }), 201

    except Exception as e:
        db_session.rollback()
        return jsonify({"message": "Lỗi server nội bộ", "error": str(e)}), 500

# --- 3. API ĐĂNG NHẬP ---
@auth_bp.route('/login', methods=['POST'])
def login():
    db_session = db.session
    try:
        json_data = request.get_json()
        errors = login_schema.validate(json_data)
        if errors:
            return jsonify({"message": "Dữ liệu không hợp lệ", "errors": errors}), 400

        user = db_session.query(UserModel).filter(UserModel.username == json_data['username']).first()
        if not user:
            return jsonify({"message": "Không tìm thấy người dùng"}), 404

        is_valid = bcrypt.checkpw(json_data['password'].encode('utf-8'), user.password_hash.encode('utf-8'))
        if not is_valid:
            return jsonify({"message": "Mật khẩu không chính xác"}), 401

        access_token = create_access_token(identity=user.user_id, additional_claims={
            'role': user.role
        })
        
        return jsonify({
            "message": "Đăng nhập thành công",
            "token": access_token,
            "user": {
                "username": user.username,
                "role": user.role
            }
        }), 200

    except Exception as e:
        return jsonify({"message": "Lỗi server nội bộ", "error": str(e)}), 500