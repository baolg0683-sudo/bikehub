from flask import Flask
from flask_jwt_extended import JWTManager
from config import Config
from config_jwt import JWTConfig
from api.middleware import setup_middleware
from api.middleware.auth import register_jwt_error_handlers
from api.routes import register_routes
from infrastructure.databases import init_db
from app_logging import setup_logging

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.from_object(JWTConfig)
    app.config.setdefault('SQLALCHEMY_DATABASE_URI', app.config.get('DATABASE_URI'))

    setup_logging()
    init_db(app)
    
    # Initialize JWT
    jwt = JWTManager(app)
    register_jwt_error_handlers(app)
    
    setup_middleware(app)
    register_routes(app)

    return app
