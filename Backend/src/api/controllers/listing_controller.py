from flask import Blueprint, request, jsonify, g
from api.middleware.auth import require_auth, optional_auth
from infrastructure.databases import SessionLocal, db
from infrastructure.models.sell.models import Listing, Media, Bicycle
from infrastructure.models.auth.user_model import UserModel
from sqlalchemy import or_
from decimal import Decimal
import re

listing_bp = Blueprint("listing", __name__)


def serialize_listing(row, db_session, sellers=None, media_by_listing=None, bike_by_listing=None):
    seller = None
    if sellers is not None:
        seller = sellers.get(row.seller_id)
    else:
        seller = db_session.query(UserModel).filter(UserModel.user_id == row.seller_id).first()

    listing_media = []
    if media_by_listing is not None:
        listing_media = media_by_listing.get(row.listing_id, [])
    else:
        listing_media = db_session.query(Media).filter(Media.listing_id == row.listing_id).all()

    bike = None
    if bike_by_listing is not None:
        bike = bike_by_listing.get(row.listing_id)
    else:
        bike = db_session.query(Bicycle).filter(Bicycle.listing_id == row.listing_id).first()

    return {
        "listing_id": row.listing_id,
        "title": row.title,
        "description": row.description,
        "price": str(row.price),
        "status": row.status,
        "is_promoted": bool(row.is_verified),
        "seller_id": row.seller_id,
        "seller": {
            "seller_id": seller.user_id if seller else row.seller_id,
            "name": seller.full_name if seller and seller.full_name else (seller.email if seller else None),
            "phone": seller.phone if seller else None,
        },
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "images": [img.url for img in listing_media],
        "bike_details": {
            **({
                "brand": bike.brand,
                "model": bike.model,
                "type": bike.type,
                "frame_size": bike.frame_size,
                "frame_material": bike.frame_material,
                "wheel_size": bike.wheel_size,
                "brake_type": bike.brake_type,
                "color": bike.color,
                "manufacture_year": bike.manufacture_year,
                "groupset": bike.groupset,
                "condition_percent": bike.condition_percent,
                "mileage_km": bike.mileage_km,
                "serial_number": bike.serial_number,
                "primary_image_url": bike.primary_image_url,
            } if bike else {})
        }
    }


@listing_bp.route("/listings", methods=["GET"])
@optional_auth
def get_listings():
    """Return listings from the database (public)."""
    search_query = request.args.get('q', '').strip()
    brand_filter = request.args.get('brand', '').strip()
    material_filter = request.args.get('frame_material', '').strip()
    type_filter = request.args.get('type', '').strip()
    status_filter = request.args.get('status', 'AVAILABLE').strip()
    min_condition = request.args.get('min_condition', '').strip()

    db_session = SessionLocal()
    try:
        query = db_session.query(Listing)
        needs_join = any([search_query, brand_filter, material_filter, type_filter, min_condition])

        if needs_join:
            query = query.outerjoin(Bicycle, Bicycle.listing_id == Listing.listing_id)

        if status_filter and status_filter.lower() != 'all':
            query = query.filter(Listing.status == status_filter)

        if search_query:
            like_pattern = f"%{search_query}%"
            query = query.filter(
                or_(
                    Listing.title.ilike(like_pattern),
                    Listing.description.ilike(like_pattern),
                    Bicycle.brand.ilike(like_pattern),
                    Bicycle.model.ilike(like_pattern),
                )
            )

        if brand_filter:
            query = query.filter(Bicycle.brand.ilike(f"%{brand_filter}%"))

        if material_filter:
            query = query.filter(Bicycle.frame_material.ilike(f"%{material_filter}%"))

        if type_filter:
            query = query.filter(Bicycle.type.ilike(f"%{type_filter}%"))

        if min_condition:
            try:
                min_condition_value = int(min_condition)
                query = query.filter(Bicycle.condition_percent >= min_condition_value)
            except ValueError:
                pass

        rows = query.order_by(Listing.created_at.desc()).limit(100).all()
        listing_ids = [row.listing_id for row in rows]
        seller_ids = list({row.seller_id for row in rows})

        sellers = {seller.user_id: seller for seller in db_session.query(UserModel).filter(UserModel.user_id.in_(seller_ids)).all()} if seller_ids else {}
        media_rows = db_session.query(Media).filter(Media.listing_id.in_(listing_ids)).all() if listing_ids else []
        bike_rows = db_session.query(Bicycle).filter(Bicycle.listing_id.in_(listing_ids)).all() if listing_ids else []

        media_by_listing = {}
        for media in media_rows:
            media_by_listing.setdefault(media.listing_id, []).append(media)

        bike_by_listing = {bike.listing_id: bike for bike in bike_rows}

        result = [serialize_listing(r, db_session, sellers=sellers, media_by_listing=media_by_listing, bike_by_listing=bike_by_listing) for r in rows]
        return jsonify(result), 200
    finally:
        db_session.close()


@listing_bp.route('/listings/<int:listing_id>', methods=['GET'])
@optional_auth
def get_listing(listing_id):
    db = SessionLocal()
    try:
        row = db.query(Listing).filter(Listing.listing_id == listing_id).first()
        if not row:
            return jsonify({"success": False, "message": "Listing not found"}), 404
        result = serialize_listing(row, db)
        return jsonify(result), 200
    finally:
        db.close()


@listing_bp.route("/users/me/listings", methods=["GET"])
@require_auth
def get_my_listings():
    """Return current user listings."""
    seller = g.get('user')
    user_id = None
    if seller:
        try:
            user_id = int(seller.get('user_id'))
        except (TypeError, ValueError):
            user_id = None

    if not seller or user_id is None:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    db_session = SessionLocal()
    try:
        rows = db_session.query(Listing).filter(Listing.seller_id == user_id).order_by(Listing.created_at.desc()).all()
        listing_ids = [row.listing_id for row in rows]

        media_rows = db_session.query(Media).filter(Media.listing_id.in_(listing_ids)).all() if listing_ids else []
        bike_rows = db_session.query(Bicycle).filter(Bicycle.listing_id.in_(listing_ids)).all() if listing_ids else []

        media_by_listing = {}
        for media in media_rows:
            media_by_listing.setdefault(media.listing_id, []).append(media)

        bike_by_listing = {bike.listing_id: bike for bike in bike_rows}

        result = [serialize_listing(r, db_session, media_by_listing=media_by_listing, bike_by_listing=bike_by_listing) for r in rows]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db_session.close()


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
    price_raw = data.get('price', None)
    images = data.get('images') or []
    bike_data = data.get('bike_details') or data

    required_bike_fields = [
        'brand',
        'model',
        'type',
        'frame_size',
        'frame_material',
        'wheel_size',
        'brake_type',
        'color',
        'manufacture_year',
        'condition_percent',
        'mileage_km',
    ]

    missing_fields = []
    if not title or str(title).strip() == '':
        missing_fields.append('title')
    if price_raw is None or str(price_raw).strip() == '':
        missing_fields.append('price')
    if not isinstance(images, list) or len(images) == 0:
        missing_fields.append('images')

    for field in required_bike_fields:
        value = bike_data.get(field)
        if value is None or str(value).strip() == '':
            missing_fields.append(f'bike_details.{field}')

    if missing_fields:
        return jsonify({
            'success': False,
            'message': 'Missing required fields for listing upload',
            'missing_fields': missing_fields
        }), 400

    # Clean price string like "12,000,000" -> "12000000"
    cleaned = re.sub(r"[^0-9.]+", "", str(price_raw))
    if cleaned == "":
        cleaned = "0"
    try:
        price = Decimal(cleaned)
    except Exception:
        return jsonify({
            'success': False,
            'message': 'Price must be a valid number'
        }), 400

    try:
        seller_id = int(seller.get('user_id'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    db = SessionLocal()
    try:
        listing = Listing(
            seller_id=seller_id,
            title=title,
            description=description,
            price=price,
            status=data.get('status', 'PENDING')
        )
        db.add(listing)
        # flush to get a listing_id for FK relations
        db.flush()

        bicycle = Bicycle(
            listing_id=listing.listing_id,
            brand=str(bike_data.get('brand', '')).strip() or None,
            model=str(bike_data.get('model', '')).strip() or None,
            type=str(bike_data.get('type', '')).strip() or None,
            frame_size=str(bike_data.get('frame_size', '')).strip() or None,
            frame_material=str(bike_data.get('frame_material', '')).strip() or None,
            wheel_size=str(bike_data.get('wheel_size', '')).strip() or None,
            brake_type=str(bike_data.get('brake_type', '')).strip() or None,
            color=str(bike_data.get('color', '')).strip() or None,
            manufacture_year=int(bike_data.get('manufacture_year')) if bike_data.get('manufacture_year') else None,
            groupset=str(bike_data.get('groupset', '')).strip() or None,
            condition_percent=int(bike_data.get('condition_percent')) if bike_data.get('condition_percent') else None,
            mileage_km=int(bike_data.get('mileage_km')) if bike_data.get('mileage_km') else None,
            serial_number=str(bike_data.get('serial_number', '')).strip() or None,
            primary_image_url=str(images[0]).strip() if isinstance(images, list) and images else None,
        )
        db.add(bicycle)

        # Persist any provided image URLs
        if isinstance(images, list) and images:
            for img_url in images:
                try:
                    li = Media(
                        listing_id=listing.listing_id,
                        url=str(img_url),
                        media_type='IMAGE',
                        is_primary=False
                    )
                    db.add(li)
                except Exception:
                    # skip invalid entries
                    continue

        db.commit()
        db.refresh(listing)

        # return created object including images
        image_urls = [img.url for img in db.query(Media).filter(Media.listing_id == listing.listing_id).all()]

        return jsonify({
            "listing_id": listing.listing_id,
            "title": listing.title,
            "description": listing.description,
            "price": str(listing.price),
            "status": listing.status,
            "seller_id": listing.seller_id,
            "created_at": listing.created_at.isoformat() if listing.created_at else None,
            "images": image_urls,
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>/request-promotion', methods=['POST'])
@require_auth
def request_promotion(listing_id):
    seller = g.get('user')
    if not seller:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    try:
        seller_id = int(seller.get('user_id'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id, Listing.seller_id == seller_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found or unauthorized"}), 404

        if listing.status == 'PENDING_PROMOTION':
            return jsonify({
                "success": False,
                "message": "Yêu cầu đẩy tin đã được gửi và đang chờ duyệt"
            }), 400

        if listing.status == 'SOLD':
            return jsonify({"success": False, "message": "Không thể đẩy tin cho tin đã bán"}), 400

        listing.status = 'PENDING_PROMOTION'
        db.commit()

        return jsonify({
            "success": True,
            "message": "Yêu cầu đẩy tin đã được gửi. Vui lòng chờ admin duyệt."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>', methods=['DELETE'])
@require_auth
def delete_listing(listing_id):
    seller = g.get('user')
    if not seller:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    try:
        seller_id = int(seller.get('user_id'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id, Listing.seller_id == seller_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found or unauthorized"}), 404

        db.delete(listing)
        db.commit()
        return jsonify({"success": True, "message": "Listing deleted"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>', methods=['PUT'])
@require_auth
def update_listing(listing_id):
    data = request.get_json() or {}
    seller = g.get('user')
    if not seller:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    try:
        seller_id = int(seller.get('user_id'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    title = data.get('title') or ''
    description = data.get('description', '')
    price_raw = data.get('price', None)
    images = data.get('images') or []
    bike_data = data.get('bike_details') or data

    required_bike_fields = [
        'brand',
        'model',
        'type',
        'frame_size',
        'frame_material',
        'wheel_size',
        'brake_type',
        'color',
        'manufacture_year',
        'condition_percent',
        'mileage_km',
    ]

    missing_fields = []
    if not title or str(title).strip() == '':
        missing_fields.append('title')
    if price_raw is None or str(price_raw).strip() == '':
        missing_fields.append('price')
    if not isinstance(images, list) or len(images) == 0:
        missing_fields.append('images')

    for field in required_bike_fields:
        value = bike_data.get(field)
        if value is None or str(value).strip() == '':
            missing_fields.append(f'bike_details.{field}')

    if missing_fields:
        return jsonify({
            'success': False,
            'message': 'Missing required fields for listing update',
            'missing_fields': missing_fields
        }), 400

    cleaned = re.sub(r"[^0-9.]+", "", str(price_raw))
    if cleaned == "":
        cleaned = "0"
    try:
        price = Decimal(cleaned)
    except Exception:
        return jsonify({
            'success': False,
            'message': 'Price must be a valid number'
        }), 400

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id, Listing.seller_id == seller_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found or unauthorized"}), 404

        listing.title = title
        listing.description = description
        listing.price = price
        listing.status = data.get('status', listing.status)

        bicycle = db.query(Bicycle).filter(Bicycle.listing_id == listing_id).first()
        if not bicycle:
            bicycle = Bicycle(listing_id=listing_id)
            db.add(bicycle)

        bicycle.brand = str(bike_data.get('brand', '')).strip() or None
        bicycle.model = str(bike_data.get('model', '')).strip() or None
        bicycle.type = str(bike_data.get('type', '')).strip() or None
        bicycle.frame_size = str(bike_data.get('frame_size', '')).strip() or None
        bicycle.frame_material = str(bike_data.get('frame_material', '')).strip() or None
        bicycle.wheel_size = str(bike_data.get('wheel_size', '')).strip() or None
        bicycle.brake_type = str(bike_data.get('brake_type', '')).strip() or None
        bicycle.color = str(bike_data.get('color', '')).strip() or None
        bicycle.manufacture_year = int(bike_data.get('manufacture_year')) if bike_data.get('manufacture_year') else None
        bicycle.groupset = str(bike_data.get('groupset', '')).strip() or None
        bicycle.condition_percent = int(bike_data.get('condition_percent')) if bike_data.get('condition_percent') else None
        bicycle.mileage_km = int(bike_data.get('mileage_km')) if bike_data.get('mileage_km') else None
        bicycle.serial_number = str(bike_data.get('serial_number', '')).strip() or None
        bicycle.primary_image_url = str(images[0]).strip() if isinstance(images, list) and images else None

        db.query(Media).filter(Media.listing_id == listing_id).delete(synchronize_session=False)
        if isinstance(images, list) and images:
            for img_url in images:
                try:
                    db.add(Media(
                        listing_id=listing_id,
                        url=str(img_url),
                        media_type='IMAGE',
                        is_primary=False
                    ))
                except Exception:
                    continue

        db.commit()
        db.refresh(listing)
        image_urls = [img.url for img in db.query(Media).filter(Media.listing_id == listing_id).all()]

        return jsonify({
            "listing_id": listing.listing_id,
            "title": listing.title,
            "description": listing.description,
            "price": str(listing.price),
            "status": listing.status,
            "seller_id": listing.seller_id,
            "created_at": listing.created_at.isoformat() if listing.created_at else None,
            "images": image_urls,
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()
