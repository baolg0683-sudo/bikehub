"""API routes package"""
from flask import Flask
from .auth_routes import auth_endpoints_bp

# Import controllers
try:
    from ..controllers.order_controller import order_bp
except ImportError:
    order_bp = None
try:
    from ..controllers.listing_controller import listing_bp
except ImportError:
    listing_bp = None
try:
    from ..controllers.media_controller import media_bp
except ImportError:
    media_bp = None
try:
    from ..controllers.interaction_controller import interactions_bp
except ImportError:
    interactions_bp = None
try:
    from ..controllers.wallet_controller import wallet_bp
except ImportError:
    wallet_bp = None

__all__ = ['auth_endpoints_bp', 'register_routes']


def register_routes(app: Flask):
    """Register all API blueprints with the Flask app"""
    # Register authentication routes
    app.register_blueprint(auth_endpoints_bp)
    
    # Register order routes if available
    if order_bp:
        app.register_blueprint(order_bp, url_prefix='/api')
    # Register listing routes if available
    if listing_bp:
        app.register_blueprint(listing_bp, url_prefix='/api')
    # Register media/upload routes
    if media_bp:
        app.register_blueprint(media_bp, url_prefix='/api')
    # Register interactions routes if available
    if interactions_bp:
        app.register_blueprint(interactions_bp, url_prefix='/api/interactions')
    # Register wallet routes if available
    if wallet_bp:
        app.register_blueprint(wallet_bp, url_prefix='/api')
