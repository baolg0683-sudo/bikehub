from flask import Flask
from .controllers.order_controller import order_bp
# Import other controllers as needed

def register_routes(app: Flask):
    app.register_blueprint(order_bp, url_prefix='/api')
    # Register other blueprints