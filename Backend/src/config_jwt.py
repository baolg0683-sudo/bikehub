"""
JWT Configuration for BikeHub API
"""
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class JWTConfig:
    """JWT Token Configuration"""
    
    # Secret key for signing tokens (use strong key in production)
    SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-in-production')
    
    # Access token expiration time (in hours)
    ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 24)))
    
    # Refresh token expiration time (in days)
    REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 30)))
    
    # Algorithm for signing tokens
    ALGORITHM = 'HS256'
    
    # JWT configuration for Flask-JWT-Extended
    JWT_SECRET_KEY = SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = ACCESS_TOKEN_EXPIRES
    JWT_REFRESH_TOKEN_EXPIRES = REFRESH_TOKEN_EXPIRES
    JWT_ALGORITHM = ALGORITHM
    
    # Token location (where to look for tokens)
    JWT_TOKEN_LOCATION = ['headers', 'cookies', 'json']
    
    # Header name for token
    JWT_HEADER_NAME = 'Authorization'
    
    # Header type (e.g., "Bearer")
    JWT_HEADER_TYPE = 'Bearer'
    
    # CSRF protection for cookies (disable for development)
    JWT_CSRF_CHECK_FORM = False
    
    # Enable token blacklist (optional, for logout functionality)
    JWT_TOKEN_BLACKLIST_ENABLED = os.getenv('JWT_TOKEN_BLACKLIST_ENABLED', 'False').lower() == 'true'
    JWT_TOKEN_BLACKLIST_KEY_PREFIX = 'jwt-blacklist'


class RoleConfig:
    """Role-based Access Control Configuration"""
    
    ROLES = {
        'ADMIN': ['read', 'write', 'delete', 'admin'],
        'INSPECTOR': ['read', 'inspect'],
        'USER': ['read'],
    }
    
    ROLE_HIERARCHY = {
        'ADMIN': ['INSPECTOR', 'USER'],
        'INSPECTOR': ['USER'],
        'USER': [],
    }
