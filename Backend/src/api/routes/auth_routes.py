"""
Authentication Endpoints for BikeHub API
Handles user login, token refresh, and logout
"""
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from api.middleware.auth import require_auth, require_admin
from api.utils.jwt_utils import TokenManager, get_current_user
from infrastructure.databases import db
from infrastructure.models.auth.user_model import UserModel
import bcrypt

# Create auth blueprint
auth_endpoints_bp = Blueprint('auth_endpoints', __name__, url_prefix='/api/auth')


@auth_endpoints_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user account.
    
    Request body:
    {
        "username": "string",
        "password": "string (min 6 chars)",
        "email": "string",
        "full_name": "string (optional)",
        "role": "USER|SELLER|BUYER|INSPECTOR|ADMIN"
    }
    
    Response:
    {
        "success": true,
        "message": "User registered successfully",
        "user": {
            "user_id": int,
            "username": "string",
            "role": "string"
        }
    }
    """
    try:
        data = request.get_json()
        
        # Validation
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Username and password are required"
            }), 400
        
        if len(data.get('password', '')) < 6:
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Password must be at least 6 characters long"
            }), 400
        
        # Check if user already exists
        existing_user = db.session.query(UserModel).filter(
            UserModel.username == data['username']
        ).first()
        
        if existing_user:
            return jsonify({
                "success": False,
                "error": "Conflict",
                "message": "Username already exists"
            }), 409
        
        # Hash password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(
            data['password'].encode('utf-8'),
            salt
        ).decode('utf-8')
        
        # Create new user
        new_user = UserModel(
            username=data['username'],
            password_hash=hashed_password,
            email=data.get('email'),
            full_name=data.get('full_name', ''),
            role=data.get('role', 'USER')
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "user": {
                "user_id": new_user.user_id,
                "username": new_user.username,
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


@auth_endpoints_bp.route('/login', methods=['POST'])
def login():
    """
    Login user and receive access and refresh tokens.
    
    Request body:
    {
        "username": "string",
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
                "username": "string",
                "role": "string"
            }
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('username') or not data.get('password'):
            return jsonify({
                "success": False,
                "error": "Validation error",
                "message": "Username and password are required"
            }), 400
        
        # Find user by username
        user = db.session.query(UserModel).filter(
            UserModel.username == data['username']
        ).first()
        
        if not user:
            return jsonify({
                "success": False,
                "error": "Authentication error",
                "message": "Invalid username or password"
            }), 401
        
        # Verify password
        if not bcrypt.checkpw(
            data['password'].encode('utf-8'),
            user.password_hash.encode('utf-8')
        ):
            return jsonify({
                "success": False,
                "error": "Authentication error",
                "message": "Invalid username or password"
            }), 401
        
        # Generate tokens
        tokens = TokenManager.create_tokens(
            user_id=user.user_id,
            user_role=user.role
        )
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "data": {
                **tokens,
                "user": {
                    "user_id": user.user_id,
                    "username": user.username,
                    "role": user.role
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
            "role": "string",
            "email": "string",
            "full_name": "string"
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
        
        return jsonify({
            "success": True,
            "data": {
                "user_id": user.user_id,
                "username": user.username,
                "role": user.role,
                "email": user.email or "",
                "full_name": user.full_name or ""
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "Server error",
            "message": str(e)
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
