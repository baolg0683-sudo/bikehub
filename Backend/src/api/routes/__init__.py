"""API routes package"""
from flask import Flask
from .auth_routes import auth_endpoints_bp

# Import controllers
try:
    from ..controllers.order_controller import order_bp
except ImportError:
    order_bp = None

__all__ = ['auth_endpoints_bp', 'register_routes']


def register_routes(app: Flask):
    """Register all API blueprints with the Flask app"""
    # Register authentication routes
    app.register_blueprint(auth_endpoints_bp)
    
    # Register order routes if available
    if order_bp:
        app.register_blueprint(order_bp, url_prefix='/api')
