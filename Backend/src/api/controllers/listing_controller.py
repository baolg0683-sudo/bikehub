from flask import Blueprint, request, jsonify, g
from api.middleware.auth import require_auth, optional_auth
from infrastructure.databases import SessionLocal
from infrastructure.models.sell.models import Listing
from decimal import Decimal
import re

listing_bp = Blueprint("listing", __name__)


@listing_bp.route("/listings", methods=["GET"])
@optional_auth
def get_listings():
    """Return listings from the database (public)."""
    db = SessionLocal()
    try:
        rows = db.query(Listing).order_by(Listing.created_at.desc()).limit(100).all()
        result = [
            {
                "listing_id": r.listing_id,
                "title": r.title,
                "description": r.description,
                "price": str(r.price),
                "status": r.status,
                "seller_id": r.seller_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
        return jsonify(result), 200
    finally:
        db.close()


@listing_bp.route("/listings", methods=["POST"])
@require_auth
def create_listing():
    """Create a listing and persist it to the DB. Requires authentication."""
    data = request.get_json() or {}
    seller = g.get('user')
    if not seller:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    title = data.get('title') or data.get('title', '')
    description = data.get('description', '')
    price_raw = str(data.get('price', '0'))

    # Clean price string like "12,000,000" -> "12000000"
    cleaned = re.sub(r"[^0-9.]+", "", price_raw)
    if cleaned == "":
        cleaned = "0"
    try:
        price = Decimal(cleaned)
    except Exception:
        price = Decimal('0')

    db = SessionLocal()
    try:
        listing = Listing(
            seller_id=seller.get('user_id'),
            title=title,
            description=description,
            price=price,
            status=data.get('status', 'PENDING')
        )
        db.add(listing)
        db.commit()
        db.refresh(listing)

        return jsonify({
            "listing_id": listing.listing_id,
            "title": listing.title,
            "description": listing.description,
            "price": str(listing.price),
            "status": listing.status,
            "seller_id": listing.seller_id,
            "created_at": listing.created_at.isoformat() if listing.created_at else None,
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()
