from flask import Flask, jsonify, g
from flask_jwt_extended import JWTManager
from sqlalchemy import text
from config import Config
from config_jwt import JWTConfig
from api.middleware import setup_middleware
from api.middleware.auth import register_jwt_error_handlers
from api.routes import register_routes
from api.services.interaction_service import InteractionService
from infrastructure.databases import init_db, db, SessionLocal
from infrastructure.repositories.interaction_repository import MessageRepository, ReviewRepository
from app_logging import setup_logging
from cors import init_cors

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config.from_object(JWTConfig)
    app.config.setdefault('SQLALCHEMY_DATABASE_URI', app.config.get('DATABASE_URI'))

    setup_logging()
    init_cors(app)
    
    # Initialize JWT
    jwt = JWTManager(app)
    register_jwt_error_handlers(app)
    
    # Initialize database
    init_db(app)

    @app.before_request
    def attach_interaction_service():
        db_session = SessionLocal()
        g.interaction_db = db_session
        g.interaction_service = InteractionService(
            MessageRepository(db_session),
            ReviewRepository(db_session)
        )

    @app.teardown_request
    def teardown_interaction_service(exception=None):
        db_session = getattr(g, "interaction_db", None)
        if db_session:
            db_session.close()
            g.pop("interaction_db", None)
            g.pop("interaction_service", None)
    
    # Import models to register them with db and Base metadata
    with app.app_context():
        # Declarative Base models (SQLAlchemy Core models)
        from infrastructure.databases import Base
        # Import module(s) that define Base-based models so they are registered
        try:
            from infrastructure.models.sell.models import Listing, Media, Bicycle  # ensure all sell models are imported
        except Exception:
            Listing = None
            Media = None
            Bicycle = None

        try:
            from infrastructure.models.orders.models import Order, DepositEscrow
            from infrastructure.models.pay.models import WalletTransaction
        except Exception:
            Order = None
            DepositEscrow = None
            WalletTransaction = None

        try:
            from infrastructure.models.interactions.message_model import MessageModel
            from infrastructure.models.interactions.review_model import ReviewModel
        except Exception:
            MessageModel = None
            ReviewModel = None

        # Ensure required schemas exist for PostgreSQL databases.
        try:
            dialect_name = getattr(db.engine, 'dialect', None) and db.engine.dialect.name
            if dialect_name in ('postgresql', 'postgres'):
                with db.engine.begin() as connection:
                    for schema in ('auth', 'listings', 'interactions', 'orders', 'wallet', 'inspections'):
                        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS {schema}'))
        except Exception as e:
            print(f"[create_app] warning: could not ensure required schemas exist: {e}")

        # Flask-SQLAlchemy models
        from infrastructure.models.auth.user_model import UserModel
        db.create_all()

        # Create tables for Base metadata (e.g., listings schema)
        # SQLite does not support named schemas (Postgres-style). When running
        # with SQLite, clear any schema qualifiers on tables so create_all
        # will not attempt schema-qualified CREATE statements.
        try:
            if getattr(db.engine, 'dialect', None) and db.engine.dialect.name == 'sqlite':
                # Log table schema info before altering (helps debug schema issues on SQLite)
                print("[create_app] Detected sqlite engine - clearing table.schema for Base.metadata.tables")
                for tbl in list(Base.metadata.tables.values()):
                    print(f"[create_app] before clear: table={tbl.name}, schema={tbl.schema}")
                for tbl in list(Base.metadata.tables.values()):
                    tbl.schema = None
                for tbl in list(Base.metadata.tables.values()):
                    print(f"[create_app] after clear: table={tbl.name}, schema={tbl.schema}")
        except Exception as e:
            print(f"[create_app] error while clearing schemas: {e}")

        Base.metadata.create_all(bind=db.engine)
    
    setup_middleware(app)
    register_routes(app)

    # Basic index and health endpoints for quick validation
    @app.route("/")
    def index():
        return jsonify({"message": "BikeHub API"}), 200

    @app.route("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    return app
