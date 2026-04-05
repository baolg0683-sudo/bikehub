from flask import Flask
from config import Config
from api.middleware import setup_middleware
from api.routes import register_routes
from infrastructure.databases import init_db
from app_logging import setup_logging

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.setdefault('SQLALCHEMY_DATABASE_URI', app.config.get('DATABASE_URI'))

    setup_logging()
    init_db(app)
    setup_middleware(app)
    register_routes(app)

    return app