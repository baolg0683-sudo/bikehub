"""
Authentication Endpoints for BikeHub API
Handles user login, token refresh, and logout
"""
import re
from datetime import datetime

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy import or_

from api.middleware.auth import require_auth, require_admin
from api.utils.jwt_utils import TokenManager, get_current_user
from infrastructure.databases import db
from infrastructure.models.auth.user_model import UserModel
from infrastructure.models.interactions.review_model import ReviewModel
from infrastructure.models.orders.models import Order
import bcrypt

# Create auth blueprint
auth_endpoints_bp = Blueprint('auth_endpoints', __name__, url_prefix='/api/users')


def _user_block_reason(user: UserModel):
    """Return block reason string when account cannot login, else None."""
    now = datetime.utcnow()
    status = (user.status or 'ACTIVE').upper()

    # Auto-unban expired temporary bans.
    if status == 'BANNED' and not bool(user.banned_permanent) and user.banned_until and user.banned_until <= now:
        user.status = 'ACTIVE'
        user.banned_until = None
        user.banned_permanent = False
        db.session.commit()
        return None

    if status == 'LOCKED':
        return 'Tài khoản đang bị khóa bởi quản trị viên.'
    if status == 'BANNED':
        if bool(user.banned_permanent):
            return 'Tài khoản đã bị cấm vĩnh viễn.'
        if user.banned_until:
            return f"Tài khoản bị cấm đến {user.banned_until.isoformat()}."
        return 'Tài khoản đang bị cấm.'
    return None


@auth_endpoints_bp.route('/check-uniqueness', methods=['POST'])
def check_uniqueness():
    """
    Check if email or phone is already taken.
    
    Request body:
    {
        "email": "string (optional)",
        "phone": "string (optional)"
    }
    
    Response:
    {
        "success": true,
        "available": {
            "email": true|false,
            "phone": true|false
        }
    }
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "No data provided"
            }), 400

        email = data.get('email', '').strip().lower() if data.get('email') else None
        phone = data.get('phone', '').strip() if data.get('phone') else None

        if not email and not phone:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Email or phone is required"
            }), 400

        result = {"email": True, "phone": True}

        if email:
            # Validate email format first
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Email format is invalid"
                }), 400
            
            existing_email = db.session.query(UserModel).filter(UserModel.email == email).first()
            result["email"] = existing_email is None

        if phone:
            # Clean and validate phone format first
            cleaned_phone = re.sub(r'[^0-9+]', '', phone)
            digits_only = re.sub(r'[^0-9]', '', cleaned_phone)
            
            # Check if starts with 0
            if not digits_only.startswith('0'):
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Phone must start with 0"
                }), 400
            
            # Check length (10-11 digits for Vietnam)
            if not cleaned_phone or len(digits_only) < 10 or len(digits_only) > 11:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Phone format is invalid (10-11 digits)"
                }), 400
            
            existing_phone = db.session.query(UserModel).filter(UserModel.phone == cleaned_phone).first()
            result["phone"] = existing_phone is None

        return jsonify({
            "success": True,
            "available": result
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user account.
    
    Request body:
    {
        "email": "string",
        "password": "string (min 6 chars)",
        "phone": "string",
        "full_name": "string (optional)",
        "date_of_birth": "YYYY-MM-DD (optional)",
        "role": "ADMIN|USER"
    }
    
    Response:
    {
        "success": true,
        "message": "User registered successfully",
        "user": {
            "user_id": int,
            "email": "string",
            "phone": "string",
            "role": "string"
        }
    }
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "No data provided"
            }), 400

        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))
        phone = str(data.get('phone', '')).strip()
        full_name = str(data.get('full_name', '')).strip()
        date_of_birth_str = data.get('date_of_birth')
        role = str(data.get('role', 'USER')).upper()

        valid_roles = ['ADMIN', 'USER']

        if len(password) < 6:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Password must be at least 6 characters long"
            }), 400

        if not email or not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Email không hợp lệ"
            }), 400

        cleaned_phone = re.sub(r'[^0-9+]', '', phone)
        digits_only = re.sub(r'[^0-9]', '', cleaned_phone)
        
        # Check if starts with 0
        if not digits_only.startswith('0'):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Số điện thoại phải bắt đầu bằng 0"
            }), 400
        
        # Check length (10-11 digits for Vietnam)
        if not digits_only or len(digits_only) < 10 or len(digits_only) > 11:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Số điện thoại không hợp lệ (10-11 chữ số)"
            }), 400

        if not full_name or len(full_name) < 2:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Họ tên không được để trống"
            }), 400

        # Validate date of birth if provided
        date_of_birth = None
        if date_of_birth_str:
            try:
                date_of_birth = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
                # Check if user is at least 13 years old
                today = datetime.now().date()
                age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
                if age < 13:
                    return jsonify({
                        "success": False,
                        "error": "Validation error",
                        "message": "Bạn phải từ 13 tuổi trở lên"
                    }), 400
            except ValueError:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Ngày sinh không hợp lệ (định dạng: YYYY-MM-DD)"
                }), 400

        if role not in valid_roles:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": f"Role must be one of: {', '.join(valid_roles)}"
            }), 400

        existing_user = db.session.query(UserModel).filter(
            or_(
                UserModel.email == email,
                UserModel.phone == cleaned_phone
            )
        ).first()

        if existing_user:
            conflict_field = 'email' if existing_user.email == email else 'phone'
            return jsonify({
                "success": False,
                "error": "Conflict",
                "message": f"{conflict_field.capitalize()} đã tồn tại"
            }), 409

        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

        new_user = UserModel()
        new_user.email = email  # type: ignore[assignment]
        new_user.password_hash = hashed_password  # type: ignore[assignment]
        new_user.full_name = full_name  # type: ignore[assignment]
        new_user.phone = cleaned_phone  # type: ignore[assignment]
        new_user.date_of_birth = date_of_birth  # type: ignore[assignment]
        new_user.role = role  # type: ignore[assignment]

        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "user": {
                "user_id": new_user.user_id,
                "email": new_user.email,
                "phone": new_user.phone,
                "role": new_user.role
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/create', methods=['POST'])
@require_admin
def create_user():
    """
    Admin-only endpoint to create a new user account with a specified role.
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "No data provided"
            }), 400

        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', ''))
        phone = str(data.get('phone', '')).strip()
        full_name = str(data.get('full_name', '')).strip()
        date_of_birth_str = data.get('date_of_birth')
        role = str(data.get('role', 'USER')).upper()

        valid_roles = ['ADMIN', 'USER', 'INSPECTOR']

        if len(password) < 6:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Password must be at least 6 characters long"
            }), 400

        if not email or not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Email không hợp lệ"
            }), 400

        cleaned_phone = re.sub(r'[^0-9+]', '', phone)
        digits_only = re.sub(r'[^0-9]', '', cleaned_phone)
        if not digits_only.startswith('0'):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Số điện thoại phải bắt đầu bằng 0"
            }), 400

        if not digits_only or len(digits_only) < 10 or len(digits_only) > 11:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Số điện thoại không hợp lệ (10-11 chữ số)"
            }), 400

        if not full_name or len(full_name) < 2:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Họ tên không được để trống"
            }), 400

        avatar_url = str(data.get('avatar_url', '')).strip() or None
        service_area = str(data.get('service_area', '')).strip() or None
        if not avatar_url:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Ảnh đại diện là bắt buộc"
            }), 400

        if not date_of_birth_str:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Ngày sinh là bắt buộc"
            }), 400

        date_of_birth = None
        try:
            date_of_birth = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
            today = datetime.now().date()
            age = today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))
            if age < 13:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Bạn phải từ 13 tuổi trở lên"
                }), 400
        except ValueError:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Ngày sinh không hợp lệ (định dạng: YYYY-MM-DD)"
            }), 400

        if role not in valid_roles:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": f"Role must be one of: {', '.join(valid_roles)}"
            }), 400

        existing_user = db.session.query(UserModel).filter(
            or_(
                UserModel.email == email,
                UserModel.phone == cleaned_phone
            )
        ).first()

        if existing_user:
            conflict_field = 'email' if existing_user.email == email else 'phone'
            return jsonify({
                "success": False,
                "error": "Conflict",
                "message": f"{conflict_field.capitalize()} đã tồn tại"
            }), 409

        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

        new_user = UserModel()
        new_user.email = email  # type: ignore[assignment]
        new_user.password_hash = hashed_password  # type: ignore[assignment]
        new_user.full_name = full_name  # type: ignore[assignment]
        new_user.phone = cleaned_phone  # type: ignore[assignment]
        new_user.date_of_birth = date_of_birth  # type: ignore[assignment]
        new_user.avatar_url = avatar_url  # type: ignore[assignment]
        new_user.role = role  # type: ignore[assignment]
        
        # Set service area for inspectors
        if role == 'INSPECTOR' and service_area:
            new_user.service_area = service_area  # type: ignore[assignment]

        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "User created successfully",
            "user": {
                "user_id": new_user.user_id,
                "email": new_user.email,
                "phone": new_user.phone,
                "role": new_user.role,
                "service_area": new_user.service_area if role == 'INSPECTOR' else None
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/login', methods=['POST'])
def login():
    """
    Login user and receive access and refresh tokens.
    
    Request body:
    {
        "identifier": "email|phone",
        "password": "string"
    }
    
    Response:
    {
        "success": true,
        "message": "Login successful",
        "data": {
            "access_token": "string",
            "refresh_token": "string",
            "token_type": "Bearer",
            "expires_in": int (seconds),
            "user": {
                "user_id": int,
                "email": "string",
                "phone": "string",
                "role": "string",
                "reputation_score": float,
                "certificate_id": "string"
            }
        }
    }
    """
    try:
        data = request.get_json(silent=True)
        if not data or not data.get('identifier') or not data.get('password'):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Identifier and password are required"
            }), 400

        identifier = str(data.get('identifier', '')).strip()
        password = str(data.get('password', ''))

        user = db.session.query(UserModel).filter(
            or_(
                UserModel.email == identifier,
                UserModel.phone == identifier
            )
        ).first()

        if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            return jsonify({
                "success": False,
                "error": "Authentication error",
                "message": "Invalid email/phone or password"
            }), 401

        block_reason = _user_block_reason(user)
        if block_reason:
            return jsonify({
                "success": False,
                "error": "Account blocked",
                "message": block_reason
            }), 403

        tokens = TokenManager.create_tokens(
            user_id=int(user.user_id),  # type: ignore[arg-type]
            user_role=str(user.role)
        )

        return jsonify({
            "success": True,
            "message": "Login successful",
            "data": {
                **tokens,
                "user": {
                    "user_id": user.user_id,
                    "email": user.email,
                    "phone": user.phone,
                    "full_name": user.full_name,
                    "avatar_url": user.avatar_url,
                    "role": user.role,
                    "reputation_score": user.reputation_score,
                "certificate_id": user.certificate_id,
                "service_area": user.service_area or ""
                }
            }
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh_access_token():
    """
    Refresh access token using refresh token.
    
    Headers:
    Authorization: Bearer <refresh_token>
    
    Response:
    {
        "success": true,
        "message": "Token refreshed successfully",
        "data": {
            "access_token": "string",
            "token_type": "Bearer",
            "expires_in": int (seconds)
        }
    }
    """
    try:
        user_id = get_jwt_identity()
        claims = get_jwt()
        user_role = claims.get('role', 'USER')

        user = db.session.query(UserModel).filter(UserModel.user_id == int(user_id)).first()
        if user:
            block_reason = _user_block_reason(user)
            if block_reason:
                return jsonify({
                    "success": False,
                    "error": "Account blocked",
                    "message": block_reason
                }), 403
        
        # Create new access token
        access_token = TokenManager.create_access_token_from_refresh(
            user_id=user_id,
            user_role=user_role
        )
        
        return jsonify({
            "success": True,
            "message": "Token refreshed successfully",
            "data": {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in": 86400  # 24 hours in seconds
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """
    Logout user (invalidate tokens).
    Note: This is a basic implementation. For production, implement token blacklist.
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response:
    {
        "success": true,
        "message": "Logout successful"
    }
    """
    # In a production environment, add token to blacklist here
    # For now, just return success
    return jsonify({
        "success": True,
        "message": "Logout successful"
    }), 200


@auth_endpoints_bp.route('/profile', methods=['PATCH'])
@require_auth
def update_profile():
    """
    Update authenticated user's profile information.
    Fields allowed: full_name, email, phone, certificate_id, password
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "No profile data provided"
            }), 400

        user_id = g.user.get('user_id')
        user = db.session.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()

        if not user:
            return jsonify({
                "success": False,
                "error": "Not found",
                "message": "User not found"
            }), 404

        if 'avatar_url' in data:
            user.avatar_url = str(data.get('avatar_url', user.avatar_url or '')).strip()  # type: ignore[assignment]
        if 'full_name' in data:
            full_name = str(data.get('full_name', user.full_name or '')).strip()
            if full_name and len(full_name) < 2:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Họ tên không hợp lệ"
                }), 400
            user.full_name = full_name  # type: ignore[assignment]
        if 'date_of_birth' in data and data.get('date_of_birth') is not None:
            if data.get('date_of_birth') == '':
                user.date_of_birth = None  # type: ignore[assignment]
            else:
                try:
                    user.date_of_birth = datetime.strptime(str(data.get('date_of_birth')), '%Y-%m-%d').date()  # type: ignore[assignment]
                except ValueError:
                    return jsonify({
                        "success": False,
                        "error": "Validation error",
                        "message": "Ngày sinh không hợp lệ (định dạng YYYY-MM-DD)"
                    }), 400
        if 'certificate_id' in data:
            user.certificate_id = str(data.get('certificate_id', user.certificate_id or '')).strip()  # type: ignore[assignment]
        if 'service_area' in data:
            service_area = str(data.get('service_area', user.service_area or '')).strip()
            if service_area and len(service_area) < 2:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Khu vực hoạt động không hợp lệ"
                }), 400
            user.service_area = service_area  # type: ignore[assignment]
        if 'email' in data:
            email = str(data.get('email', user.email or '')).strip().lower()
            if not email or not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Email không hợp lệ"
                }), 400
            if email != user.email:
                existing_email = db.session.query(UserModel).filter(UserModel.email == email).first()
                if existing_email:
                    return jsonify({
                        "success": False,
                        "error": "Conflict",
                        "message": "Email đã tồn tại"
                    }), 409
            user.email = email  # type: ignore[assignment]
        if 'phone' in data:
            phone = str(data.get('phone', user.phone or '')).strip()
            cleaned_phone = re.sub(r'[^0-9+]', '', phone)
            if cleaned_phone and (len(re.sub(r'[^0-9]', '', cleaned_phone)) < 9 or len(re.sub(r'[^0-9]', '', cleaned_phone)) > 15):
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Số điện thoại không hợp lệ"
                }), 400
            if cleaned_phone and cleaned_phone != user.phone:
                existing_phone = db.session.query(UserModel).filter(UserModel.phone == cleaned_phone).first()
                if existing_phone:
                    return jsonify({
                        "success": False,
                        "error": "Conflict",
                        "message": "Số điện thoại đã tồn tại"
                    }), 409
            user.phone = cleaned_phone  # type: ignore[assignment]
        if 'password' in data and data.get('password'):
            current_password = str(data.get('current_password', '')).strip()
            if not current_password:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Cần nhập mật khẩu cũ để thay đổi mật khẩu"
                }), 400
            if not bcrypt.checkpw(current_password.encode('utf-8'), user.password_hash.encode('utf-8')):
                return jsonify({
                    "success": False,
                    "error": "Unauthorized",
                    "message": "Mật khẩu cũ không đúng"
                }), 401
            if len(data.get('password')) < 6:
                return jsonify({
                    "success": False,
                    "error": "Validation error",
                    "message": "Password must be at least 6 characters"
                }), 400
            salt = bcrypt.gensalt()
            user.password_hash = bcrypt.hashpw(  # type: ignore[assignment]
                data['password'].encode('utf-8'),
                salt
            ).decode('utf-8')

        db.session.commit()

        age = None
        if user.date_of_birth:
            today = datetime.now().date()
            age = today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))

        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "data": {
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "full_name": user.full_name or "",
                "phone": user.phone or "",
                "avatar_url": user.avatar_url or "",
                "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
                "age": age,
                "reputation_score": user.reputation_score,
                "certificate_id": user.certificate_id or "",
                "service_area": user.service_area or ""
            }
        }), 200

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/me', methods=['GET'])
@require_auth
def get_current_user_info():
    """
    Get current authenticated user information.
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response:
    {
        "success": true,
        "data": {
            "user_id": int,
            "username": "string",
            "email": "string",
            "role": "string",
            "full_name": "string",
            "phone": "string",
            "reputation_score": float,
            "certificate_id": "string"
        }
    }
    """
    try:
        user_id = g.user.get('user_id')
        user = db.session.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()
        
        if not user:
            return jsonify({
                "success": False,
                "error": "Not found",
                "message": "User not found"
            }), 404
        
        age = None
        if user.date_of_birth:
            today = datetime.now().date()
            age = today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))

        return jsonify({
            "success": True,
            "data": {
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "full_name": user.full_name or "",
                "phone": user.phone or "",
                "avatar_url": user.avatar_url or "",
                "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
                "age": age,
                "reputation_score": user.reputation_score,
                "certificate_id": user.certificate_id or "",
                "service_area": user.service_area or ""
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
        }), 500


@auth_endpoints_bp.route('/me/reviews', methods=['GET'])
@require_auth
def get_my_reviews():
    try:
        user_id = g.user.get('user_id')

        received_rows = (
            db.session.query(
                ReviewModel,
                UserModel.full_name.label('reviewer_name'),
                UserModel.avatar_url.label('reviewer_avatar'),
                Order.status.label('order_status'),
                Order.final_price.label('order_price')
            )
            .join(UserModel, UserModel.user_id == ReviewModel.reviewer_id)
            .join(Order, Order.order_id == ReviewModel.order_id)
            .filter(ReviewModel.target_id == user_id)
            .all()
        )

        received_reviews = [
            {
                'review_id': row.ReviewModel.review_id,
                'order_id': row.ReviewModel.order_id,
                'rating': row.ReviewModel.rating,
                'comment': row.ReviewModel.comment,
                'reviewer_name': row.reviewer_name,
                'reviewer_avatar': row.reviewer_avatar,
                'order_status': row.order_status,
                'order_price': str(row.order_price) if row.order_price is not None else None,
                'created_at': row.ReviewModel.created_at.isoformat() if row.ReviewModel.created_at else None
            }
            for row in received_rows
        ]

        given_rows = (
            db.session.query(
                ReviewModel,
                UserModel.full_name.label('target_name'),
                UserModel.avatar_url.label('target_avatar'),
                Order.status.label('order_status'),
                Order.final_price.label('order_price')
            )
            .join(UserModel, UserModel.user_id == ReviewModel.target_id)
            .join(Order, Order.order_id == ReviewModel.order_id)
            .filter(ReviewModel.reviewer_id == user_id)
            .all()
        )

        given_reviews = [
            {
                'review_id': row.ReviewModel.review_id,
                'order_id': row.ReviewModel.order_id,
                'rating': row.ReviewModel.rating,
                'comment': row.ReviewModel.comment,
                'target_name': row.target_name,
                'target_avatar': row.target_avatar,
                'order_status': row.order_status,
                'order_price': str(row.order_price) if row.order_price is not None else None,
                'created_at': row.ReviewModel.created_at.isoformat() if row.ReviewModel.created_at else None
            }
            for row in given_rows
        ]

        return jsonify({
            'success': True,
            'data': {
                'received_reviews': received_reviews,
                'given_reviews': given_reviews
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Server error',
            'message': str(e)
        }), 500


@auth_endpoints_bp.route('/verify-token', methods=['POST'])
@require_auth
def verify_token():
    """
    Verify if a token is valid.
    
    Headers:
    Authorization: Bearer <access_token>
    
    Response:
    {
        "success": true,
        "data": {
            "valid": true,
            "user_id": int,
            "role": "string"
        }
    }
    """
    return jsonify({
        "success": True,
        "data": {
            "valid": True,
            "user_id": g.user.get('user_id'),
            "role": g.user.get('role')
        }
    }), 200


@auth_endpoints_bp.route('/admin-check', methods=['GET'])
@require_admin
def admin_check():
    """
    Check if user has admin privileges.
    
    Headers:
    Authorization: Bearer <access_token> (admin user required)
    
    Response:
    {
        "success": true,
        "message": "User is admin"
    }
    """
    return jsonify({
        "success": True,
        "message": "User is admin"
    }), 200
