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
import bcrypt
import os

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
            from infrastructure.models.orders.dispute_model import OrderDispute  # noqa: F401
            from infrastructure.models.pay.models import WalletTransaction
        except Exception:
            Order = None
            DepositEscrow = None
            OrderDispute = None
            WalletTransaction = None

        try:
            from infrastructure.models.interactions.message_model import MessageModel
            from infrastructure.models.interactions.review_model import ReviewModel
        except Exception:
            MessageModel = None
            ReviewModel = None

        try:
            from infrastructure.models.inspections.report_model import InspectionReport
        except Exception:
            InspectionReport = None

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

        # Automatically create a default admin account if one does not exist and credentials are provided.
        default_admin_email = os.getenv('DEFAULT_ADMIN_EMAIL')
        default_admin_password = os.getenv('DEFAULT_ADMIN_PASSWORD')
        default_admin_phone = os.getenv('DEFAULT_ADMIN_PHONE')
        default_admin_name = os.getenv('DEFAULT_ADMIN_NAME', 'BikeHub Admin')

        if default_admin_email and default_admin_password and default_admin_phone:
            existing_admin = db.session.query(UserModel).filter(UserModel.role == 'ADMIN').first()
            if not existing_admin:
                salt = bcrypt.gensalt()
                hashed_password = bcrypt.hashpw(default_admin_password.encode('utf-8'), salt).decode('utf-8')
                admin = UserModel(
                    email=default_admin_email.strip().lower(),
                    password_hash=hashed_password,
                    full_name=default_admin_name,
                    phone=default_admin_phone.strip(),
                    role='ADMIN'
                )
                db.session.add(admin)
                db.session.commit()

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

        try:
            if dialect_name in ('postgresql', 'postgres'):
                with db.engine.begin() as connection:
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS fiat_amount DECIMAL(15, 2) DEFAULT 0.00"))
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(5) DEFAULT 'B'"))
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS transfer_note TEXT"))
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS evidence_url TEXT"))
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS admin_note TEXT"))
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS processed_by INT REFERENCES auth.users(user_id)"))
                    connection.execute(text("ALTER TABLE wallet.transactions ADD COLUMN IF NOT EXISTS bank_info JSONB"))
                    try:
                        connection.execute(text("ALTER TABLE wallet.transactions ALTER COLUMN type TYPE VARCHAR(40)"))
                    except Exception as ex:
                        print(f"[create_app] wallet.transactions.type alter: {ex}")
                    connection.execute(text("ALTER TABLE inspections.reports ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP"))
                    connection.execute(text("ALTER TABLE inspections.reports ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(10, 2) DEFAULT 50000"))
                    connection.execute(text("ALTER TABLE inspections.reports ADD COLUMN IF NOT EXISTS condition_percent INT"))
                    for stmt in (
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS deposit_percent NUMERIC(5, 2)",
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(15, 2)",
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(15, 2)",
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS buyer_reject_reason TEXT",
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS listing_was_verified BOOLEAN DEFAULT FALSE",
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
                        "ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS meeting_confirmed_at TIMESTAMP",
                    ):
                        connection.execute(text(stmt))
                    for stmt in (
                        "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP",
                        "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_permanent BOOLEAN DEFAULT FALSE",
                        "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP",
                        "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS sanction_note TEXT",
                        "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS service_area VARCHAR(120)",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS penalty_target VARCHAR(16)",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS penalty_actions VARCHAR(128)",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS penalty_ban_days INT",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS penalty_ban_permanent BOOLEAN",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS penalty_reputation_deduction FLOAT",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS penalty_note TEXT",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS admin_penalty_applied_at TIMESTAMP",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS admin_penalty_applied_by INT REFERENCES auth.users(user_id)",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS admin_penalty_note TEXT",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS dispute_area VARCHAR(120)",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS dispute_address TEXT",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP",
                        "ALTER TABLE orders.order_disputes ADD COLUMN IF NOT EXISTS cancelled_by_user_id INT REFERENCES auth.users(user_id)",
                    ):
                        connection.execute(text(stmt))
                    try:
                        connection.execute(text("ALTER TABLE orders.orders ALTER COLUMN status TYPE VARCHAR(40)"))
                    except Exception as ex:
                        print(f"[create_app] orders.orders status column alter (may already be wide): {ex}")
        except Exception as e:
            print(f"[create_app] warning: could not migrate wallet.transactions or inspections.reports columns: {e}")

    
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
