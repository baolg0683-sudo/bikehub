from functools import wraps
from flask import g, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

def require_auth(f):
    """Decorator to verify JWT token and set user in g context"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            g.user = {"user_id": user_id}
        except Exception as e:
            return jsonify({"error": "Unauthorized", "message": str(e)}), 401
        
        return f(*args, **kwargs)
    return decorated_function
