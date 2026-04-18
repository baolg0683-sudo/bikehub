from flask import Blueprint, request, jsonify, g
from api.middleware.auth import require_auth, optional_auth
from infrastructure.databases import SessionLocal, db
from infrastructure.models.sell.models import Listing, Media, Bicycle
from infrastructure.models.orders.models import Order
from infrastructure.models.auth.user_model import UserModel
from services.order_service import ORDER_ACTIVE_STATUSES
from infrastructure.models.inspections.report_model import InspectionReport
from infrastructure.models.pay.models import WalletTransaction
from sqlalchemy import or_
from decimal import Decimal
from datetime import datetime
import re

listing_bp = Blueprint("listing", __name__)


def serialize_listing(
    row,
    db_session,
    sellers=None,
    media_by_listing=None,
    bike_by_listing=None,
    *,
    public_seller_only: bool = False,
    active_deposit_order=None,
):
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

    assigned_inspector = None
    if getattr(row, 'assigned_inspector_id', None):
        assigned_user = db_session.query(UserModel).filter(UserModel.user_id == row.assigned_inspector_id).first()
        if assigned_user:
            assigned_inspector = {
                "user_id": assigned_user.user_id,
                "name": assigned_user.full_name or assigned_user.email,
                "phone": assigned_user.phone,
            }

    return {
        "listing_id": row.listing_id,
        "title": row.title,
        "description": row.description,
        "price": str(row.price),
        "status": row.status,
        "inspection_status": getattr(row, 'inspection_status', None),
        "inspection_fee": str(getattr(row, 'inspection_fee', 50000)),
        "inspection_schedule": row.inspection_schedule.isoformat() if getattr(row, 'inspection_schedule', None) else None,
        "inspection_notes": getattr(row, 'inspection_notes', None),
        "assigned_inspector_id": getattr(row, 'assigned_inspector_id', None),
        "assigned_inspector": assigned_inspector,
        "is_hidden": bool(getattr(row, 'is_hidden', False)),
        "is_verified": bool(row.is_verified),
        "seller_id": row.seller_id,
        "seller": (
            {
                "seller_id": seller.user_id if seller else row.seller_id,
                "name": seller.full_name if seller and seller.full_name else (seller.email if seller else None),
                "reputation_score": float(seller.reputation_score) if seller and seller.reputation_score is not None else 5.0,
            }
            if public_seller_only
            else {
                "seller_id": seller.user_id if seller else row.seller_id,
                "name": seller.full_name if seller and seller.full_name else (seller.email if seller else None),
                "phone": seller.phone if seller else None,
                "reputation_score": float(seller.reputation_score) if seller and seller.reputation_score is not None else 5.0,
            }
        ),
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
        },
        "active_deposit_order": active_deposit_order,
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
        else:
            query = query.filter(Listing.status != 'RESERVED')

        query = query.filter(Listing.is_hidden == False)

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

        viewer_id = None
        u = g.get('user')
        if u and u.get('user_id') is not None:
            try:
                viewer_id = int(u.get('user_id'))
            except (TypeError, ValueError):
                viewer_id = None

        result = [
            serialize_listing(
                r,
                db_session,
                sellers=sellers,
                media_by_listing=media_by_listing,
                bike_by_listing=bike_by_listing,
                public_seller_only=not (viewer_id and viewer_id == r.seller_id),
            )
            for r in rows
        ]
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
        viewer_id = None
        u = g.get('user')
        if u and u.get('user_id') is not None:
            try:
                viewer_id = int(u.get('user_id'))
            except (TypeError, ValueError):
                viewer_id = None
        is_owner = viewer_id is not None and viewer_id == row.seller_id

        if row.status == 'RESERVED':
            allowed = is_owner
            if not allowed and viewer_id is not None:
                buyer_order = (
                    db.query(Order)
                    .filter(Order.listing_id == listing_id, Order.status.in_(ORDER_ACTIVE_STATUSES))
                    .first()
                )
                if buyer_order and buyer_order.buyer_id == viewer_id:
                    allowed = True
            if not allowed:
                return jsonify({"success": False, "message": "Listing not found"}), 404

        result = serialize_listing(row, db, public_seller_only=not is_owner)
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

        active_orders = (
            db_session.query(Order)
            .filter(Order.listing_id.in_(listing_ids), Order.status.in_(ORDER_ACTIVE_STATUSES))
            .all()
        ) if listing_ids else []
        order_by_listing = {o.listing_id: o for o in active_orders}
        buyer_ids = list({o.buyer_id for o in active_orders})
        buyers = (
            {u.user_id: u for u in db_session.query(UserModel).filter(UserModel.user_id.in_(buyer_ids)).all()}
            if buyer_ids
            else {}
        )

        def deposit_payload(lid):
            o = order_by_listing.get(lid)
            if not o:
                return None
            b = buyers.get(o.buyer_id)
            return {
                "order_id": o.order_id,
                "buyer_id": o.buyer_id,
                "buyer_name": (b.full_name or b.email) if b else None,
                "order_status": o.status,
            }

        result = [
            serialize_listing(
                r,
                db_session,
                media_by_listing=media_by_listing,
                bike_by_listing=bike_by_listing,
                active_deposit_order=deposit_payload(r.listing_id),
            )
            for r in rows
        ]
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

        if listing.inspection_status != 'PASSED':
            return jsonify({"success": False, "message": "Chưa kiểm định đạt, không thể đẩy tin"}), 400

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


@listing_bp.route('/listings/<int:listing_id>/request-inspection', methods=['POST'])
@require_auth
def request_inspection(listing_id):
    seller = g.get('user')
    if not seller:
        return jsonify({"success": False, "message": "Authentication required"}), 401

    try:
        seller_id = int(seller.get('user_id'))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    db = SessionLocal()
    data = request.get_json() or {}
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id, Listing.seller_id == seller_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found or unauthorized"}), 404

        if listing.inspection_status in ('REQUESTED', 'SCHEDULED', 'PASSED'):
            return jsonify({"success": False, "message": "Inspection already requested or completed."}), 400

        seller_user = db.query(UserModel).filter(UserModel.user_id == seller_id).first()
        if not seller_user:
            return jsonify({"success": False, "message": "Seller user not found."}), 404

        inspection_fee = listing.inspection_fee if listing.inspection_fee is not None else Decimal('50000.00')
        try:
            inspection_fee = Decimal(str(inspection_fee))
        except Exception:
            inspection_fee = Decimal('50000.00')

        if inspection_fee <= 0:
            inspection_fee = Decimal('50000.00')

        if seller_user.balance is None or seller_user.balance < inspection_fee:
            return jsonify({
                "success": False,
                "message": "Không đủ số dư để thanh toán phí kiểm định.",
                "current_balance": str(seller_user.balance or Decimal('0.00')),
                "required_amount": str(inspection_fee)
            }), 400

        inspection_location = data.get('inspection_location') or data.get('location')
        if inspection_location:
            listing.inspection_notes = f"Khu vực kiểm định: {inspection_location}"

        seller_user.balance = seller_user.balance - inspection_fee
        listing.inspection_fee = inspection_fee
        listing.inspection_status = 'REQUESTED'
        listing.status = 'PENDING'
        listing.is_hidden = False

        db.add(WalletTransaction(
            user_id=seller_id,
            amount=inspection_fee,
            fiat_amount=Decimal('0.00'),
            currency='B',
            type='INSPECTION_FEE',
            status='SUCCESS',
            transfer_note=f'Thanh toán phí kiểm định cho tin đăng {listing_id}',
            created_at=datetime.utcnow(),
            processed_at=datetime.utcnow()
        ))

        db.commit()

        return jsonify({
            "success": True,
            "message": "Yêu cầu kiểm định đã được gửi và phí đã được thanh toán.",
            "inspection_fee": str(listing.inspection_fee)
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/pending-inspection', methods=['GET'])
@require_auth
def get_pending_listings():
    """Return all pending listings for inspector."""
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    db = SessionLocal()
    try:
        mine = str(request.args.get('mine', '')).lower() in ('1', 'true', 'yes')
        if mine:
            rows = db.query(Listing).filter(
                Listing.assigned_inspector_id == int(user.get('user_id'))
            ).order_by(Listing.created_at.desc()).all()
        else:
            rows = db.query(Listing).filter(
                Listing.inspection_status == 'REQUESTED',
                Listing.assigned_inspector_id == None,
                Listing.is_hidden == False
            ).order_by(Listing.created_at.desc()).all()

        result = [serialize_listing(r, db) for r in rows]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/pending-approval', methods=['GET'])
@require_auth
def get_pending_approval_listings():
    """Return all listings waiting approval without inspection request."""
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    db = SessionLocal()
    try:
        rows = db.query(Listing).filter(
            Listing.status == 'PENDING',
            Listing.inspection_status.in_((None, 'NONE')),
            Listing.is_hidden == False
        ).order_by(Listing.created_at.desc()).all()

        result = [serialize_listing(r, db) for r in rows]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>/assign-inspector', methods=['POST'])
@require_auth
def assign_inspector(listing_id):
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found"}), 404

        if listing.inspection_status != 'REQUESTED' or listing.assigned_inspector_id is not None:
            return jsonify({"success": False, "message": "Listing is not available for assignment."}), 400

        listing.assigned_inspector_id = int(user.get('user_id'))
        listing.inspection_status = 'SCHEDULED'
        db.commit()

        return jsonify(serialize_listing(listing, db)), 200
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>/unassign-inspector', methods=['POST'])
@require_auth
def unassign_inspector(listing_id):
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found"}), 404

        if listing.assigned_inspector_id != int(user.get('user_id')) or listing.inspection_status != 'SCHEDULED':
            return jsonify({"success": False, "message": "Không thể hủy lấy kiểm định."}), 400

        listing.assigned_inspector_id = None
        listing.inspection_status = 'REQUESTED'
        db.commit()

        return jsonify(serialize_listing(listing, db)), 200
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>/schedule-inspection', methods=['POST'])
@require_auth
def schedule_inspection(listing_id):
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    data = request.get_json() or {}
    schedule_at = data.get('scheduled_at')
    notes = data.get('notes', '')

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found"}), 404

        if listing.inspection_status not in ('REQUESTED', 'SCHEDULED'):
            return jsonify({"success": False, "message": "Listing is not ready to be scheduled for inspection."}), 400

        listing.inspection_status = 'SCHEDULED'
        listing.inspection_schedule = datetime.fromisoformat(schedule_at) if schedule_at else datetime.utcnow()
        listing.inspection_notes = notes
        db.commit()

        return jsonify({
            "success": True,
            "message": "Inspection scheduled successfully",
            "inspection_schedule": listing.inspection_schedule.isoformat()
        }), 200
    except ValueError:
        return jsonify({"success": False, "message": "Scheduled date is invalid. Use ISO format."}), 400
    except Exception as e:
        db.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()


@listing_bp.route('/listings/<int:listing_id>/inspect', methods=['POST'])
@require_auth
def inspect_listing(listing_id):
    """Approve or reject a listing."""
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    data = request.get_json() or {}
    action = str(data.get('action', '')).upper()  # PASS or FAIL
    technical_details = data.get('technical_details') or {}
    overall_verdict = data.get('overall_verdict', '')

    if action not in ('PASS', 'FAIL'):
        return jsonify({"success": False, "message": "Invalid action. Use PASS or FAIL."}), 400

    db = SessionLocal()
    try:
        listing = db.query(Listing).filter(Listing.listing_id == listing_id).first()
        if not listing:
            return jsonify({"success": False, "message": "Listing not found"}), 404

        if action == 'PASS':
            if listing.status == 'PENDING' and (listing.inspection_status is None or listing.inspection_status == 'NONE'):
                listing.is_verified = False
                listing.status = 'AVAILABLE'
                listing.inspection_status = 'REVIEWED'
                listing.is_hidden = False
            else:
                listing.is_verified = True
                listing.status = 'AVAILABLE'
                listing.inspection_status = 'PASSED'
                listing.is_hidden = False
        else:
            listing.is_verified = False
            listing.status = 'PENDING'
            listing.inspection_status = 'FAILED'
            listing.is_hidden = False
            listing.inspection_notes = overall_verdict or 'Từ chối duyệt tin. Vui lòng chỉnh sửa và đăng ký kiểm định lại.'

        # Update stored bicycle condition from inspection result so listing UI shows the inspector-entered value
        condition_value_int = None
        condition_value = technical_details.get('condition_percent')
        if condition_value is not None:
            try:
                condition_value_int = int(condition_value)
            except (ValueError, TypeError):
                condition_value_int = None
            if condition_value_int is not None:
                bicycle = db.query(Bicycle).filter(Bicycle.listing_id == listing_id).first()
                if not bicycle:
                    bicycle = Bicycle(listing_id=listing_id)
                    db.add(bicycle)
                bicycle.condition_percent = condition_value_int

        report = InspectionReport(
            listing_id=listing_id,
            inspector_id=int(user.get('user_id')),
            technical_details=technical_details,
            condition_percent=condition_value_int,
            overall_verdict=overall_verdict,
            scheduled_at=listing.inspection_schedule,
            fee_amount=listing.inspection_fee,
            is_passed=(action == 'PASS')
        )
        db.add(report)
        db.commit()

        return jsonify({"success": True, "message": f"Listing {action}ED", "inspection_status": listing.inspection_status}), 200
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

        if listing.inspection_status in ('REQUESTED', 'SCHEDULED', 'PASSED'):
            return jsonify({"success": False, "message": "Không thể xóa tin đã gửi kiểm định hoặc đã kiểm định."}), 400

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
        user_id = int(seller.get('user_id'))
        user_role = seller.get('role')
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
        if user_role == 'INSPECTOR':
            listing = db.query(Listing).filter(
                Listing.listing_id == listing_id,
                Listing.assigned_inspector_id == user_id,
                Listing.inspection_status.in_(['SCHEDULED', 'PASSED'])
            ).first()
        else:
            listing = db.query(Listing).filter(Listing.listing_id == listing_id, Listing.seller_id == user_id).first()

        if not listing:
            return jsonify({"success": False, "message": "Listing not found or unauthorized"}), 404

        if listing.status == 'SOLD':
            return jsonify({"success": False, "message": "Cannot modify a sold listing."}), 400

        listing.title = title
        listing.description = description
        listing.price = price
        listing.status = data.get('status', listing.status)
        if 'is_hidden' in data:
            listing.is_hidden = bool(data.get('is_hidden'))
        elif listing.status == 'HIDDEN':
            listing.is_hidden = True
        elif listing.status == 'SOLD':
            listing.is_hidden = True
        elif listing.status in ('AVAILABLE', 'PENDING', 'PENDING_PROMOTION'):
            listing.is_hidden = False

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


@listing_bp.route('/listings/inspector-history', methods=['GET'])
@require_auth
def get_inspector_history():
    """Return listings processed by the inspector."""
    user = g.get('user')
    if not user or user.get('role') != 'INSPECTOR':
        return jsonify({"success": False, "message": "Unauthorized"}), 403

    inspector_id = int(user.get('user_id'))
    history_type = request.args.get('type', 'all')  # 'inspection', 'approval', or 'all'

    db = SessionLocal()
    try:
        query = db.query(Listing).filter(
            Listing.assigned_inspector_id == inspector_id
        )

        if history_type == 'inspection':
            # Listings that have been inspected (PASSED or FAILED)
            query = query.filter(Listing.inspection_status.in_(['PASSED', 'FAILED']))
        elif history_type == 'approval':
            # Listings that have been approved/rejected (REVIEWED status)
            query = query.filter(Listing.inspection_status == 'REVIEWED')
        else:
            # All processed listings
            query = query.filter(Listing.inspection_status.in_(['PASSED', 'FAILED', 'REVIEWED']))

        listings = query.all()

        result = []
        for listing in listings:
            serialized = serialize_listing(listing, db)
            # Add history type for frontend filtering
            if listing.inspection_status == 'REVIEWED':
                serialized['historyType'] = 'approval'
            else:
                serialized['historyType'] = 'inspection'
            result.append(serialized)

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        db.close()
