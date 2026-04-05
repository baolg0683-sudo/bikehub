from flask import Flask
from flask_jwt_extended import JWTManager
from config import Config
from config_jwt import JWTConfig
from api.middleware import setup_middleware
from api.middleware.auth import register_jwt_error_handlers
from api.routes import register_routes
from infrastructure.databases import init_db, db
from app_logging import setup_logging

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.from_object(JWTConfig)
    app.config.setdefault('SQLALCHEMY_DATABASE_URI', app.config.get('DATABASE_URI'))

    setup_logging()
    
    # Initialize JWT
    jwt = JWTManager(app)
    register_jwt_error_handlers(app)
    
    # Initialize database
    init_db(app)
    
    # Import models to register them with db
    with app.app_context():
        from infrastructure.models.auth.user_model import UserModel
        db.create_all()
    
    setup_middleware(app)
    register_routes(app)

    return app
