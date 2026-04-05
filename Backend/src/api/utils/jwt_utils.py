"""
JWT Utilities for token creation, validation, and management
"""
from datetime import datetime, timedelta
from functools import wraps
from flask import current_app, jsonify, g
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
    verify_jwt_in_request
)


class TokenManager:
    """Manage JWT token creation and validation"""
    
    @staticmethod
    def create_tokens(user_id: int, user_role: str = 'USER', additional_claims: dict = None):
        """
        Create both access and refresh tokens for a user
        
        Args:
            user_id: User ID
            user_role: User role (ADMIN, SELLER, BUYER, INSPECTOR, USER)
            additional_claims: Additional claims to include in token
            
        Returns:
            dict: Contains access_token and refresh_token
        """
        claims = {
            'user_id': user_id,
            'role': user_role,
        }
        
        if additional_claims:
            claims.update(additional_claims)
        
        access_token = create_access_token(identity=user_id, additional_claims=claims)
        refresh_token = create_refresh_token(identity=user_id, additional_claims={'role': user_role})
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'expires_in': current_app.config['JWT_ACCESS_TOKEN_EXPIRES'].total_seconds()
        }
    
    @staticmethod
    def create_access_token_from_refresh(user_id: int, user_role: str = 'USER'):
        """
        Create a new access token from refresh token data
        
        Args:
            user_id: User ID
            user_role: User role
            
        Returns:
            str: New access token
        """
        return create_access_token(
            identity=user_id,
            additional_claims={
                'user_id': user_id,
                'role': user_role,
            }
        )
    
    @staticmethod
    def decode_token(token: str) -> dict:
        """
        Decode JWT token without verification (for debugging only)
        WARNING: Do not use in production for security decisions
        
        Args:
            token: JWT token string
            
        Returns:
            dict: Token payload
        """
        try:
            from jwt import decode
            from config_jwt import JWTConfig
            payload = decode(
                token,
                JWTConfig.SECRET_KEY,
                algorithms=[JWTConfig.ALGORITHM]
            )
            return payload
        except Exception as e:
            return {'error': str(e)}


def get_current_user():
    """Get current authenticated user from JWT token"""
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        user_id = get_jwt_identity()
        
        return {
            'user_id': user_id,
            'role': claims.get('role', 'USER'),
            'claims': claims
        }
    except Exception:
        return None


def get_user_role():
    """Get current user's role from JWT token"""
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        return claims.get('role', 'USER')
    except Exception:
        return None
