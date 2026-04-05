"""
Authorization and Authentication Middleware for BikeHub API
"""
from functools import wraps
from flask import g, jsonify, request
from flask_jwt_extended import (
    verify_jwt_in_request,
    get_jwt_identity,
    get_jwt,
    jwt_required,
)


def require_auth(f):
    """
    Decorator to verify JWT token and set user in g context.
    Basic authentication requirement.
    
    Usage:
        @app.route('/profile')
        @require_auth
        def get_profile():
            user = g.user
            return jsonify(user)
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            claims = get_jwt()
            
            g.user = {
                "user_id": user_id,
                "role": claims.get('role', 'USER'),
                "claims": claims
            }
        except Exception as e:
            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": str(e)
            }), 401
        
        return f(*args, **kwargs)
    return decorated_function


def require_role(*allowed_roles):
    """
    Decorator to verify JWT token and check user role.
    Role-based access control.
    
    Args:
        *allowed_roles: Variable length argument list of allowed roles
        
    Usage:
        @app.route('/admin')
        @require_role('ADMIN')
        def admin_only():
            return jsonify({"message": "Admin access"})
        
        @app.route('/seller')
        @require_role('SELLER', 'ADMIN')
        def seller_access():
            return jsonify({"message": "Seller or Admin access"})
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                claims = get_jwt()
                user_role = claims.get('role', 'USER')
                
                # Check if user role is in allowed roles
                if user_role not in allowed_roles:
                    return jsonify({
                        "success": False,
                        "error": "Forbidden",
                        "message": f"User role '{user_role}' is not authorized. Required roles: {', '.join(allowed_roles)}"
                    }), 403
                
                g.user = {
                    "user_id": user_id,
                    "role": user_role,
                    "claims": claims
                }
                
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": "Unauthorized",
                    "message": "Invalid token claims"
                }), 401
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": "Unauthorized",
                    "message": str(e)
                }), 401
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_admin(f):
    """
    Decorator to require ADMIN role.
    Shorthand for @require_role('ADMIN').
    
    Usage:
        @app.route('/admin-only')
        @require_admin
        def admin_endpoint():
            return jsonify({"message": "Admin only"})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            claims = get_jwt()
            user_role = claims.get('role', 'USER')
            
            if user_role != 'ADMIN':
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "Admin access required"
                }), 403
            
            g.user = {
                "user_id": user_id,
                "role": user_role,
                "claims": claims
            }
        except Exception as e:
            return jsonify({
                "success": False,
                "error": "Unauthorized",
                "message": str(e)
            }), 401
        
        return f(*args, **kwargs)
    return decorated_function


def optional_auth(f):
    """
    Decorator for optional authentication.
    Endpoint works with or without authentication.
    User data is set in g.user if token is valid, otherwise g.user is None.
    
    Usage:
        @app.route('/listings')
        @optional_auth
        def get_listings():
            user = g.get('user')
            return jsonify({"user_authenticated": user is not None})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            
            if user_id:
                claims = get_jwt()
                g.user = {
                    "user_id": user_id,
                    "role": claims.get('role', 'USER'),
                    "claims": claims
                }
            else:
                g.user = None
        except Exception:
            g.user = None
        
        return f(*args, **kwargs)
    return decorated_function


def rate_limit_per_user(requests_per_minute: int = 60):
    """
    Decorator for rate limiting per authenticated user.
    Requires user to be authenticated.
    
    Args:
        requests_per_minute: Number of requests allowed per minute
        
    Usage:
        @app.route('/api/expensive')
        @require_auth
        @rate_limit_per_user(10)
        def expensive_operation():
            return jsonify({"status": "done"})
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # This is a placeholder. Real implementation would use Redis or similar
            # For now, just execute the function
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def log_access(f):
    """
    Decorator to log API access attempts.
    Logs successful and failed authentication attempts.
    
    Usage:
        @app.route('/secure')
        @log_access
        @require_auth
        def secure_endpoint():
            return jsonify({"status": "ok"})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Try to get user info if authenticated
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            user_info = f"User {user_id}" if user_id else "Anonymous"
            print(f"[ACCESS LOG] Endpoint: {request.path} | {user_info} | IP: {request.remote_addr}")
        except Exception:
            print(f"[ACCESS LOG] Endpoint: {request.path} | Anonymous | IP: {request.remote_addr}")
        
        return f(*args, **kwargs)
    return decorated_function


# Error handlers for JWT exceptions
def register_jwt_error_handlers(app):
    """
    Register error handlers for JWT-related exceptions.
    Call this in create_app() or after app initialization.
    
    Usage:
        from api.middleware.auth import register_jwt_error_handlers
        register_jwt_error_handlers(app)
    """
    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({
            "success": False,
            "error": "Unauthorized",
            "message": "Invalid or missing authentication token"
        }), 401
    
    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({
            "success": False,
            "error": "Forbidden",
            "message": "Insufficient permissions to access this resource"
        }), 403

