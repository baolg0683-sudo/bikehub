 HEAD
﻿import os
import logging
from datetime import timedelta
from flask import Flask, g, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

 HEAD
from flask import Flask, jsonify
# from api.routes import register_routes
from api.swagger import spec
from api.controllers.todo_controller import bp as todo_bp
from api.controllers.auth_controller import auth_bp as auth_bp
from api.middleware import middleware
from api.responses import success_response
from infrastructure.databases import init_db
from config import Config
 24330b9 (Restore .gitignore and fix app/listing_service changes)
from flasgger import Swagger
from flask_swagger_ui import get_swaggerui_blueprint

import os
import logging
from datetime import timedelta
from flask import Flask, g, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from flasgger import Swagger
from flask_swagger_ui import get_swaggerui_blueprint

# --- IMPORT CONFIG & INFRASTRUCTURE ---
from config import Config, SwaggerConfig
from infrastructure.databases import init_db
from infrastructure.extensions import db
from api.middleware import middleware

# --- IMPORT BLUEPRINTS (CONTROLLERS) ---
from api.controllers.auth_controller import auth_bp
from api.controllers.listing_controller import bp as listing_bp
from api.controllers.inspection_controller import bp as inspection_bp
from api.controllers.order_controller import bp as order_bp
from api.controllers.interaction_controller import interactions_bp
 HEAD
======
1dd455 (Restore .gitignore and fix app/listing_service changes)
 24330b9 (Restore .gitignore and fix app/listing_service changes)

# --- IMPORT REPOSITORIES & SERVICES ---
from infrastructure.repositories.interaction_repository import MessageRepository, ReviewRepository
from api.services.interaction_service import InteractionService
# Giả định OrderService có sẵn từ cấu trúc cũ của bạn để map logic từ file FastAPI sang
from services.order_service import OrderService 

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_app(config_name='development'):
    """Application Factory - Hợp nhất từ 5 phiên bản app.py"""
    app = Flask(__name__)
    
    # ===== 1. CẤU HÌNH (CONFIG) =====
    app.config.from_object(Config)
    
    # Đảm bảo SQLALCHEMY_DATABASE_URI được hiểu đúng từ Config của thầy
    if not app.config.get('SQLALCHEMY_DATABASE_URI'):
        app.config['SQLALCHEMY_DATABASE_URI'] = app.config.get('DATABASE_URI')
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-2025')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
    
    # ===== 2. KHỞI TẠO EXTENSIONS =====
    # Database
    db.init_app(app)
    
    # JWT
    jwt = JWTManager(app)
    
    # CORS
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
    CORS(app, resources={
        r"/api/*": {
            "origins": cors_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Swagger (Flasgger)
    Swagger(app)
 HEAD

    # ===== 3. ĐĂNG KÝ BLUEPRINTS =====
    app.register_blueprint(auth_bp)

 HEAD
    # Đăng ký blueprint trước
    app.register_blueprint(todo_bp)
    app.register_blueprint(auth_bp)
    # register_routes(app)
     # Thêm Swagger UI blueprint


    # ===== 3. ĐĂNG KÝ BLUEPRINTS =====
    app.register_blueprint(auth_bp)
 24330b9 (Restore .gitignore and fix app/listing_service changes)
    app.register_blueprint(listing_bp, url_prefix='/api/listings')
    app.register_blueprint(inspection_bp, url_prefix='/api/inspections')
    app.register_blueprint(order_bp, url_prefix='/api/orders')
    app.register_blueprint(interactions_bp, url_prefix='/api/interactions')

    # Swagger UI Blueprint (Cấu cục giao diện /docs)
 14dd455 (Restore .gitignore and fix app/listing_service changes)
 24330b9 (Restore .gitignore and fix app/listing_service changes)
    SWAGGER_URL = '/docs'
    API_URL = '/swagger.json'
    swaggerui_blueprint = get_swaggerui_blueprint(
        SWAGGER_URL,
        API_URL,
        config={'app_name': "BikeHub API"}
    )
    app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

    # ===== 4. XỬ LÝ LỖI (ERROR HANDLERS) =====
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404
    
    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Unauthorized"}), 401
    
    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Internal error: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

    # ===== 5. KHỞI TẠO DATABASE & MIDDLEWARE =====
    try:
        init_db(app)
        with app.app_context():
            # db.create_all() # Mở comment nếu muốn tự động tạo table
            logger.info("✅ Database initialized successfully.")
    except Exception as e:
        logger.error(f"❌ Error initializing database: {e}")

    middleware(app)

    # ===== 6. SERVICE INJECTION (BEFORE REQUEST) =====
    @app.before_request
    def before_request():
        """Khởi tạo repositories và services trước mỗi request (từ app (2).py)"""
        g.msg_repo = MessageRepository(db.session)
        g.review_repo = ReviewRepository(db.session)
        g.interaction_service = InteractionService(g.msg_repo, g.review_repo)

    # ===== 7. MAP ENDPOINTS VÀO SWAGGER JSON =====
    # Tự động nạp docstring từ các controller vào spec (từ app 4.py)
    from api.swagger import spec # Đảm bảo file này tồn tại trong dự án của bạn
    with app.test_request_context():
        for rule in app.url_map.iter_rules():
 HEAD
            # Lọc các endpoint cần show trên Swagger
            if rule.endpoint.startswith(('auth.', 'interactions.', 'listing.', 'order.', 'inspection.')):

 HEAD
            # Thêm các endpoint khác nếu cần
            if rule.endpoint.startswith(('todo.', 'course.', 'user.', 'auth.')):

            # Lọc các endpoint cần show trên Swagger
            if rule.endpoint.startswith(('auth.', 'interactions.', 'listing.', 'order.', 'inspection.')):
 14dd455 (Restore .gitignore and fix app/listing_service changes)
 24330b9 (Restore .gitignore and fix app/listing_service changes)
                view_func = app.view_functions[rule.endpoint]
                try:
                    spec.path(view=view_func)
                except Exception:
                    pass

    @app.route("/swagger.json")
    def swagger_json():
        return jsonify(spec.to_dict())

    # ===== 8. HEALTH CHECK & TRẠNG THÁI (TỪ FILE FASTAPI/APP2) =====
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({
            "status": "OK",
            "service": "BikeHub-Combined-Service",
            "environment": app.config.get('ENV', 'development')
        }), 200

    return app

# Khởi tạo instance của app
app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    # Hỗ trợ cả chạy bằng uvicorn (nếu có wrapper) hoặc chạy Flask truyền thống
    # Ở đây dùng Flask run cho đúng bản chất các Blueprint hiện tại của bạn
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 9999))
    
    logger.info(f"🚀 Server starting on http://{host}:{port}")
    app.run(host=host, port=port, debug=True)