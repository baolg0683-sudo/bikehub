from flask import Blueprint, request, g, jsonify
from marshmallow import ValidationError
from api.middleware.auth import require_auth
from api.schemas.interaction_schema import MessageSchema, ReviewSchema
from api.services.interaction_service import InteractionService
from infrastructure.models.interactions.review_model import ReviewModel
from infrastructure.models.interactions.message_model import MessageModel

interactions_bp = Blueprint("interactions", __name__)

def success(data, status_code=200):
    """Standard success response"""
    return jsonify({"success": True, "data": data}), status_code

@interactions_bp.post("/messages")
@require_auth
def send_message():
    try:
        data = MessageSchema().load(request.json)
        msg = g.interaction_service.send_message(g.user, data)
        return success(MessageSchema().dump(asdict(msg)), 201)
    except ValidationError as e:
        return jsonify({"error": "Validation error", "details": e.messages}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.post("/reviews")
@require_auth
def create_review():
    try:
        data = ReviewSchema().load(request.json)
        review = g.interaction_service.create_review(g.user, data)
        return success(ReviewSchema().dump(asdict(review)), 201)
    except ValidationError as e:
        return jsonify({"error": "Validation error", "details": e.messages}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.get("/users/<int:user_id>/rating")
def get_user_rating(user_id):
    """Get user's average rating"""
    try:
        rating = g.interaction_service.get_user_rating(user_id)
        return success({"user_id": user_id, "average_rating": float(rating) if rating else 0}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500