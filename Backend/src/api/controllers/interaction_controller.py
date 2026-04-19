from dataclasses import asdict
from datetime import datetime
import json
import time

from flask import Blueprint, request, g, jsonify, Response, stream_with_context, current_app
from flask_jwt_extended import decode_token, verify_jwt_in_request, get_jwt_identity, get_jwt
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError
from api.middleware.auth import require_auth
from api.schemas.interaction_schema import MessageSchema, ReviewSchema
from api.services.interaction_service import InteractionService

interactions_bp = Blueprint("interactions", __name__)

def success(data, status_code=200):
    """Standard success response"""
    return jsonify({"success": True, "data": data}), status_code

@interactions_bp.get("/stream")
def stream_updates():
    token = request.args.get("token")
    try:
        if token:
            decoded = decode_token(token)
            user_id = decoded.get("user_id") or decoded.get("sub")
            if not user_id:
                raise ValueError("Invalid token")
            g.user = {
                "user_id": int(user_id) if isinstance(user_id, str) else user_id,
                "role": decoded.get("role", "USER"),
                "claims": decoded,
            }
        else:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            claims = get_jwt()
            g.user = {
                "user_id": int(user_id) if isinstance(user_id, str) else user_id,
                "role": claims.get("role", "USER"),
                "claims": claims,
            }
    except Exception as e:
        return jsonify({"success": False, "error": "Unauthorized", "message": str(e)}), 401

    listing_id = request.args.get("listing_id", type=int)
    peer_id = request.args.get("peer_id", type=int)
    since = request.args.get("since")

    def stream():
        previous_payload = None
        while True:
            time.sleep(2)
            try:
                conversations = g.interaction_service.get_conversation_list(g.user)
                payload = {"conversations": conversations}
                if listing_id and peer_id:
                    payload["messages"] = g.interaction_service.get_conversation(g.user, listing_id, peer_id)
                if payload != previous_payload:
                    previous_payload = payload
                    yield f"event: update\nretry: 5000\ndata: {json.dumps(payload, default=str)}\n\n"
                else:
                    yield ": keep-alive\n\n"
            except GeneratorExit:
                break
            except Exception as err:
                yield f"event: error\ndata: {json.dumps({'message': str(err)})}\n\n"

    return Response(stream_with_context(stream()), mimetype="text/event-stream")


@interactions_bp.post("/messages")
@require_auth
def send_message():
    try:
        data = MessageSchema().load(request.json)
        msg = g.interaction_service.send_message(g.user, data)
        return success(MessageSchema().dump(asdict(msg)), 201)
    except ValidationError as e:
        return jsonify({"error": "Validation error", "details": e.messages}), 400
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except IntegrityError:
        return jsonify({"error": "Dữ liệu tin nhắn không hợp lệ."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.get("/conversations")
@require_auth
def get_conversations():
    try:
        conversations = g.interaction_service.get_conversation_list(g.user)
        return success(conversations, 200)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.get("/messages")
@require_auth
def get_messages():
    try:
        listing_id = request.args.get("listing_id", type=int)
        peer_id = request.args.get("peer_id", type=int)
        if not listing_id:
            return jsonify({"error": "listing_id query parameter is required"}), 400

        messages = g.interaction_service.get_conversation(g.user, listing_id, peer_id)
        return success(messages, 200)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.delete("/messages/<int:message_id>")
@require_auth
def delete_message(message_id):
    try:
        g.interaction_service.delete_message(g.user, message_id)
        return success({"message_id": message_id}, 200)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.delete("/conversations")
@require_auth
def delete_conversation():
    try:
        listing_id = request.args.get("listing_id", type=int)
        peer_id = request.args.get("peer_id", type=int)
        if not listing_id or not peer_id:
            return jsonify({"error": "listing_id and peer_id query parameters are required"}), 400

        deleted_count = g.interaction_service.delete_conversation(g.user, listing_id, peer_id)
        return success({"deleted_count": deleted_count}, 200)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@interactions_bp.post("/conversations/report")
@require_auth
def report_conversation():
    from infrastructure.models.reports.user_report_model import UserReport
    from infrastructure.databases import SessionLocal
    from sqlalchemy.exc import IntegrityError
    try:
        payload = request.json or {}
        listing_id = payload.get("listing_id")
        peer_id = payload.get("peer_id")
        reason = (payload.get("reason") or "").strip()
        if not listing_id or not peer_id:
            return jsonify({"error": "listing_id and peer_id are required"}), 400
        if not reason:
            return jsonify({"error": "reason is required"}), 400

        reporter_id = int(g.user.get("user_id"))
        target_id = f"{listing_id}_{peer_id}"

        db_session = SessionLocal()
        try:
            existing = db_session.query(UserReport).filter(
                UserReport.reporter_id == reporter_id,
                UserReport.target_type == 'conversation',
                UserReport.target_id == target_id,
            ).first()
            if existing:
                return jsonify({"success": False, "already_reported": True, "message": "Bạn đã báo cáo cuộc trò chuyện này rồi."}), 409

            report = UserReport(
                reporter_id=reporter_id,
                target_type='conversation',
                target_id=target_id,
                reason=reason,
            )
            db_session.add(report)
            db_session.commit()
            return jsonify({"success": True, "message": "Báo cáo đã được gửi."}), 200
        except IntegrityError:
            db_session.rollback()
            return jsonify({"success": False, "already_reported": True, "message": "Bạn đã báo cáo cuộc trò chuyện này rồi."}), 409
        finally:
            db_session.close()
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