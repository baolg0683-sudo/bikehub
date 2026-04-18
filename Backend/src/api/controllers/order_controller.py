from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from flask import Blueprint, request, jsonify, g
from api.middleware.auth import require_auth, require_role
from infrastructure.databases import SessionLocal
from infrastructure.models.orders.dispute_model import OrderDispute
from infrastructure.models.orders.models import Order
from infrastructure.models.sell.models import Listing
from infrastructure.models.auth.user_model import UserModel
from services.order_service import OrderService

order_bp = Blueprint('order', __name__)

_CONTACT_STATUSES = frozenset(
    {'DEPOSIT_HELD', 'SELLER_CONFIRMED_HANDOVER', 'DISPUTE_OPEN'}
)

_PENALTY_TARGETS = {'BUYER', 'SELLER', 'BOTH'}
_PENALTY_ACTIONS = {'LOCK_ACCOUNT', 'BAN_ACCOUNT', 'DEDUCT_REPUTATION'}


def _normalize_lock_action(actions: List[str]) -> List[str]:
    """Map legacy BAN_ACCOUNT into LOCK_ACCOUNT for a single lock semantic."""
    normalized = ['LOCK_ACCOUNT' if a == 'BAN_ACCOUNT' else a for a in actions]
    # unique keep order
    out: List[str] = []
    for a in normalized:
        if a not in out:
            out.append(a)
    return out


def _serialize_order(order, db, viewer_id: int, *, for_admin: bool = False):
    listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
    title = listing.title if listing else None

    out = {
        'order_id': order.order_id,
        'listing_id': order.listing_id,
        'listing_title': title,
        'buyer_id': order.buyer_id,
        'seller_id': order.seller_id,
        'status': order.status,
        'final_price': str(order.final_price or 0),
        'deposit_percent': str(order.deposit_percent) if order.deposit_percent is not None else None,
        'deposit_amount': str(order.deposit_amount or 0),
        'remaining_amount': str(order.remaining_amount or 0),
        'buyer_reject_reason': order.buyer_reject_reason,
        'listing_was_verified': bool(order.listing_was_verified),
        'meeting_confirmed_at': order.meeting_confirmed_at.isoformat() if getattr(order, 'meeting_confirmed_at', None) else None,
        'created_at': order.created_at.isoformat() if order.created_at else None,
        'updated_at': order.updated_at.isoformat() if order.updated_at else None,
    }

    if for_admin:
        seller = db.query(UserModel).filter(UserModel.user_id == order.seller_id).first()
        buyer = db.query(UserModel).filter(UserModel.user_id == order.buyer_id).first()
        if seller:
            out['seller_contact'] = {
                'name': seller.full_name or seller.email,
                'phone': seller.phone,
                'email': seller.email,
            }
        if buyer:
            out['buyer_contact'] = {
                'name': buyer.full_name or buyer.email,
                'phone': buyer.phone,
                'email': buyer.email,
            }
    elif order.status in _CONTACT_STATUSES:
        if viewer_id == order.buyer_id:
            seller = db.query(UserModel).filter(UserModel.user_id == order.seller_id).first()
            if seller:
                out['seller_contact'] = {
                    'name': seller.full_name or seller.email,
                    'phone': seller.phone,
                    'email': seller.email,
                }
        elif viewer_id == order.seller_id:
            buyer = db.query(UserModel).filter(UserModel.user_id == order.buyer_id).first()
            if buyer:
                out['buyer_contact'] = {
                    'name': buyer.full_name or buyer.email,
                    'phone': buyer.phone,
                    'email': buyer.email,
                }

    return out


@order_bp.route('/orders', methods=['GET'])
@require_role('ADMIN')
def admin_list_orders():
    db = SessionLocal()
    try:
        orders = OrderService.get_all_orders()
        viewer_id = int(g.user['user_id'])
        return jsonify([_serialize_order(o, db, viewer_id, for_admin=True) for o in orders]), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/me', methods=['GET'])
@require_auth
def my_orders():
    user_id = int(g.user['user_id'])
    db = SessionLocal()
    try:
        orders = OrderService.get_orders_for_user(user_id)
        return jsonify([_serialize_order(o, db, user_id) for o in orders]), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/<int:order_id>', methods=['GET'])
@require_auth
def get_order(order_id):
    user_id = int(g.user['user_id'])
    db = SessionLocal()
    try:
        order = OrderService.get_order_for_user(order_id, user_id)
        if not order:
            return jsonify({'success': False, 'message': 'Không tìm thấy đơn'}), 404
        return jsonify(_serialize_order(order, db, user_id)), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders', methods=['POST'])
@require_auth
def create_purchase_order():
    data = request.get_json() or {}
    user_id = int(g.user['user_id'])
    listing_id = data.get('listing_id')
    pct = data.get('deposit_percent', data.get('depositPercent'))
    if listing_id is None:
        return jsonify({'success': False, 'message': 'Thiếu listing_id'}), 400
    try:
        order = OrderService.create_purchase_order(
            buyer_id=user_id,
            listing_id=int(listing_id),
            deposit_percent=Decimal(str(pct)),
        )
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 201
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/pay-deposit', methods=['POST'])
@require_auth
def pay_deposit(order_id):
    user_id = int(g.user['user_id'])
    try:
        order = OrderService.pay_deposit(order_id, user_id)
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 200
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/cancel', methods=['POST'])
@require_auth
def cancel_order(order_id):
    user_id = int(g.user['user_id'])
    try:
        order = OrderService.cancel_by_buyer(order_id, user_id)
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 200
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/confirm-meeting-schedule', methods=['POST'])
@require_auth
def seller_confirm_meeting_schedule(order_id):
    user_id = int(g.user['user_id'])
    try:
        order = OrderService.seller_confirm_meeting_schedule(order_id, user_id)
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 200
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/buyer-confirm-received', methods=['POST'])
@require_auth
def buyer_confirm_received(order_id):
    user_id = int(g.user['user_id'])
    try:
        order = OrderService.buyer_confirm_received(order_id, user_id)
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 200
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/reject', methods=['POST'])
@require_auth
def reject_vehicle(order_id):
    user_id = int(g.user['user_id'])
    data = request.get_json() or {}
    reason = data.get('reason', '')
    try:
        order = OrderService.buyer_reject_vehicle(order_id, user_id, reason)
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 200
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/dispute', methods=['POST'])
@require_auth
def open_dispute(order_id):
    user_id = int(g.user['user_id'])
    data = request.get_json() or {}
    description = data.get('description', '')
    area = data.get('area')
    address = data.get('address')
    try:
        d = OrderService.open_dispute(order_id, user_id, description, area=area, address=address)
        return jsonify(
            {
                'dispute_id': d.dispute_id,
                'order_id': d.order_id,
                'status': d.status,
            }
        ), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/orders/<int:order_id>/dispute/cancel', methods=['POST'])
@require_auth
def cancel_dispute(order_id):
    user_id = int(g.user['user_id'])
    try:
        order = OrderService.cancel_dispute(order_id, user_id)
        db = SessionLocal()
        try:
            return jsonify(_serialize_order(order, db, user_id)), 200
        finally:
            db.close()
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400


def _serialize_dispute(dispute: OrderDispute, db):
    order = db.query(Order).filter(Order.order_id == dispute.order_id).first()
    listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first() if order else None
    opened_by = db.query(UserModel).filter(UserModel.user_id == dispute.opened_by_user_id).first()
    inspector = db.query(UserModel).filter(UserModel.user_id == dispute.inspector_id).first() if dispute.inspector_id else None
    buyer = db.query(UserModel).filter(UserModel.user_id == order.buyer_id).first() if order else None
    seller = db.query(UserModel).filter(UserModel.user_id == order.seller_id).first() if order else None

    penalty_actions = []
    if dispute.penalty_actions:
        penalty_actions = [x.strip() for x in str(dispute.penalty_actions).split(',') if x.strip()]

    def _serialize_user_short(u: Optional[UserModel]):
        if not u:
            return None
        return {
            'user_id': u.user_id,
            'name': u.full_name or u.email,
            'email': u.email,
            'phone': u.phone,
            'status': u.status,
            'reputation_score': float(u.reputation_score or 0),
            'banned_until': u.banned_until.isoformat() if getattr(u, 'banned_until', None) else None,
            'banned_permanent': bool(getattr(u, 'banned_permanent', False)),
            'locked_at': u.locked_at.isoformat() if getattr(u, 'locked_at', None) else None,
            'service_area': getattr(u, 'service_area', None),
        }

    return {
        'dispute_id': dispute.dispute_id,
        'order_id': dispute.order_id,
        'order_status': order.status if order else None,
        'listing_id': order.listing_id if order else None,
        'listing_title': listing.title if listing else None,
        'description': dispute.description,
        'dispute_area': getattr(dispute, 'dispute_area', None),
        'dispute_address': getattr(dispute, 'dispute_address', None),
        'status': dispute.status,
        'created_at': dispute.created_at.isoformat() if dispute.created_at else None,
        'resolved_at': dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        'resolution_note': dispute.resolution_note,
        'opened_by': {
            'user_id': dispute.opened_by_user_id,
            'name': (opened_by.full_name or opened_by.email) if opened_by else None,
        },
        'inspector': (
            {
                'user_id': inspector.user_id,
                'name': inspector.full_name or inspector.email,
                'phone': inspector.phone,
                'certificate_id': inspector.certificate_id,
            }
            if inspector
            else None
        ),
        'buyer': _serialize_user_short(buyer),
        'seller': _serialize_user_short(seller),
        'penalty_proposal': {
            'target_scope': dispute.penalty_target,
            'actions': penalty_actions,
            'ban_duration_days': dispute.penalty_ban_days,
            'ban_permanent': bool(dispute.penalty_ban_permanent) if dispute.penalty_ban_permanent is not None else None,
            'reputation_deduction': float(dispute.penalty_reputation_deduction) if dispute.penalty_reputation_deduction is not None else None,
            'proposal_note': dispute.penalty_note,
        },
        'admin_penalty_applied_at': dispute.admin_penalty_applied_at.isoformat() if dispute.admin_penalty_applied_at else None,
        'admin_penalty_applied_by': dispute.admin_penalty_applied_by,
        'admin_penalty_note': dispute.admin_penalty_note,
        'cancelled_at': dispute.cancelled_at.isoformat() if getattr(dispute, 'cancelled_at', None) else None,
        'cancelled_by_user_id': getattr(dispute, 'cancelled_by_user_id', None),
    }


@order_bp.route('/orders/disputes', methods=['GET'])
@require_role('ADMIN')
def admin_list_disputes():
    status_filter = (request.args.get('status') or '').strip().upper()
    db = SessionLocal()
    try:
        q = db.query(OrderDispute).order_by(OrderDispute.created_at.desc())
        if status_filter:
            q = q.filter(OrderDispute.status == status_filter)
        disputes = q.all()
        return jsonify([_serialize_dispute(d, db) for d in disputes]), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/disputes/inspectors', methods=['GET'])
@require_role('ADMIN')
def get_inspectors_for_assignment():
    area = (request.args.get('area') or '').strip().lower()
    db = SessionLocal()
    try:
        inspectors = db.query(UserModel).filter(UserModel.role == 'INSPECTOR').order_by(UserModel.user_id.desc()).all()
        result = []
        for i in inspectors:
            area_blob = f"{i.service_area or ''} {i.full_name or ''} {i.certificate_id or ''}".lower()
            if area and area not in area_blob:
                continue
            result.append(
                {
                    'user_id': i.user_id,
                    'name': i.full_name or i.email,
                    'phone': i.phone,
                    'certificate_id': i.certificate_id,
                    'service_area': i.service_area,
                }
            )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/disputes/<int:dispute_id>/assign-inspector', methods=['POST'])
@require_role('ADMIN')
def assign_dispute_inspector(dispute_id):
    data = request.get_json() or {}
    inspector_id = data.get('inspector_id')
    if inspector_id is None:
        return jsonify({'success': False, 'message': 'Thiếu inspector_id'}), 400

    db = SessionLocal()
    try:
        dispute = db.query(OrderDispute).filter(OrderDispute.dispute_id == dispute_id).first()
        if not dispute:
            return jsonify({'success': False, 'message': 'Không tìm thấy tranh chấp'}), 404
        if dispute.status not in ('OPEN', 'ASSIGNED'):
            return jsonify({'success': False, 'message': 'Tranh chấp đã đóng'}), 400

        inspector = (
            db.query(UserModel)
            .filter(UserModel.user_id == int(inspector_id), UserModel.role == 'INSPECTOR')
            .first()
        )
        if not inspector:
            return jsonify({'success': False, 'message': 'Không tìm thấy kiểm định viên'}), 404

        # Bắt buộc cùng khu vực hoạt động
        dispute_area = (getattr(dispute, 'dispute_area', None) or '').strip().lower()
        inspector_area = (getattr(inspector, 'service_area', None) or '').strip().lower()
        if dispute_area and inspector_area and dispute_area != inspector_area:
            return jsonify({'success': False, 'message': 'Không thể gán: kiểm định viên không thuộc cùng khu vực tranh chấp'}), 400
        if dispute_area and not inspector_area:
            return jsonify({'success': False, 'message': 'Không thể gán: kiểm định viên chưa cập nhật khu vực hoạt động'}), 400

        dispute.inspector_id = inspector.user_id
        dispute.status = 'ASSIGNED'
        db.commit()
        db.refresh(dispute)
        return jsonify(_serialize_dispute(dispute, db)), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/disputes/assigned', methods=['GET'])
@require_role('INSPECTOR')
def inspector_assigned_disputes():
    inspector_id = int(g.user['user_id'])
    db = SessionLocal()
    try:
        disputes = (
            db.query(OrderDispute)
            .filter(OrderDispute.inspector_id == inspector_id)
            .order_by(OrderDispute.created_at.desc())
            .all()
        )
        return jsonify([_serialize_dispute(d, db) for d in disputes]), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/disputes/<int:dispute_id>/resolve', methods=['POST'])
@require_role('INSPECTOR')
def inspector_resolve_dispute(dispute_id):
    inspector_id = int(g.user['user_id'])
    data = request.get_json() or {}
    resolution_note = (data.get('resolution_note') or '').strip()
    if len(resolution_note) < 10:
        return jsonify({'success': False, 'message': 'Nội dung kết luận tối thiểu 10 ký tự'}), 400

    proposal = data.get('penalty_proposal') or {}
    target_scope = (proposal.get('target_scope') or '').strip().upper()
    actions: List[str] = [str(x).strip().upper() for x in (proposal.get('actions') or []) if str(x).strip()]
    actions = _normalize_lock_action([a for a in actions if a in _PENALTY_ACTIONS])
    ban_duration_days = proposal.get('ban_duration_days')
    ban_permanent = proposal.get('ban_permanent')
    reputation_deduction = proposal.get('reputation_deduction')
    proposal_note = (proposal.get('proposal_note') or '').strip() or None

    if target_scope and target_scope not in _PENALTY_TARGETS:
        return jsonify({'success': False, 'message': 'Đối tượng áp dụng đề xuất không hợp lệ'}), 400
    if not actions:
        # Không bắt buộc nhập phương án phạt.
        target_scope = None
    if 'LOCK_ACCOUNT' in actions:
        has_permanent = bool(ban_permanent)
        has_days = ban_duration_days is not None and str(ban_duration_days).strip() != ''
        if has_permanent == has_days:
            return jsonify({'success': False, 'message': 'Chọn một trong hai: khóa vĩnh viễn hoặc khóa theo số ngày'}), 400
        if has_days:
            try:
                ban_duration_days = int(ban_duration_days)
                if ban_duration_days <= 0:
                    raise ValueError
            except Exception:
                return jsonify({'success': False, 'message': 'Số ngày khóa phải > 0'}), 400
        else:
            ban_duration_days = None
    else:
        ban_duration_days = None
    if 'DEDUCT_REPUTATION' in actions:
        try:
            reputation_deduction = float(reputation_deduction)
            if reputation_deduction <= 0:
                raise ValueError
        except Exception:
            return jsonify({'success': False, 'message': 'Mức trừ điểm sao phải > 0'}), 400
    else:
        reputation_deduction = None

    db = SessionLocal()
    try:
        dispute = db.query(OrderDispute).filter(OrderDispute.dispute_id == dispute_id).first()
        if not dispute:
            return jsonify({'success': False, 'message': 'Không tìm thấy tranh chấp'}), 404
        if dispute.inspector_id != inspector_id:
            return jsonify({'success': False, 'message': 'Bạn không được phân công tranh chấp này'}), 403
        if dispute.status not in ('ASSIGNED', 'OPEN'):
            return jsonify({'success': False, 'message': 'Tranh chấp đã đóng'}), 400

        dispute.status = 'RESOLVED'
        dispute.resolution_note = resolution_note
        dispute.resolved_at = datetime.utcnow()
        dispute.penalty_target = target_scope
        dispute.penalty_actions = ','.join(actions) if actions else None
        dispute.penalty_ban_days = ban_duration_days
        dispute.penalty_ban_permanent = bool(ban_permanent) if 'LOCK_ACCOUNT' in actions else None
        dispute.penalty_reputation_deduction = reputation_deduction
        dispute.penalty_note = proposal_note

        order = db.query(Order).filter(Order.order_id == dispute.order_id).first()
        if order and order.status == 'DISPUTE_OPEN':
            order.status = 'DEPOSIT_HELD'

        db.commit()
        db.refresh(dispute)
        return jsonify(_serialize_dispute(dispute, db)), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()


@order_bp.route('/orders/disputes/<int:dispute_id>/apply-penalty', methods=['POST'])
@require_role('ADMIN')
def admin_apply_dispute_penalty(dispute_id):
    admin_id = int(g.user['user_id'])
    data = request.get_json() or {}

    # Admin có thể dùng đề xuất có sẵn hoặc override tại lúc áp dụng.
    target_scope = (data.get('target_scope') or '').strip().upper()
    actions: List[str] = [str(x).strip().upper() for x in (data.get('actions') or []) if str(x).strip()]
    actions = _normalize_lock_action([a for a in actions if a in _PENALTY_ACTIONS])
    ban_duration_days = data.get('ban_duration_days')
    ban_permanent = bool(data.get('ban_permanent'))
    reputation_deduction = data.get('reputation_deduction')
    admin_note = (data.get('admin_note') or '').strip() or None

    db = SessionLocal()
    try:
        dispute = db.query(OrderDispute).filter(OrderDispute.dispute_id == dispute_id).first()
        if not dispute:
            return jsonify({'success': False, 'message': 'Không tìm thấy tranh chấp'}), 404
        if dispute.status != 'RESOLVED':
            return jsonify({'success': False, 'message': 'Chỉ áp dụng phạt khi tranh chấp đã RESOLVED'}), 400

        if not target_scope:
            target_scope = (dispute.penalty_target or '').strip().upper()
        if not actions:
            actions = _normalize_lock_action([x.strip().upper() for x in (dispute.penalty_actions or '').split(',') if x.strip()])
        if target_scope not in _PENALTY_TARGETS or not actions:
            return jsonify({'success': False, 'message': 'Thiếu hoặc sai thông tin phương án phạt'}), 400

        if 'LOCK_ACCOUNT' in actions:
            if ban_duration_days is None:
                ban_duration_days = dispute.penalty_ban_days
            if not bool(data.get('ban_permanent')) and 'ban_permanent' not in data:
                ban_permanent = bool(dispute.penalty_ban_permanent)

            has_permanent = bool(ban_permanent)
            has_days = ban_duration_days is not None and str(ban_duration_days).strip() != ''
            if has_permanent == has_days:
                return jsonify({'success': False, 'message': 'Chọn một trong hai: khóa vĩnh viễn hoặc khóa theo số ngày'}), 400
            if has_days:
                try:
                    ban_duration_days = int(ban_duration_days)
                    if ban_duration_days <= 0:
                        raise ValueError
                except Exception:
                    return jsonify({'success': False, 'message': 'Số ngày khóa phải > 0'}), 400
            else:
                ban_duration_days = None
        else:
            ban_duration_days = None

        if 'DEDUCT_REPUTATION' in actions:
            if reputation_deduction is None:
                reputation_deduction = dispute.penalty_reputation_deduction
            try:
                reputation_deduction = float(reputation_deduction)
                if reputation_deduction <= 0:
                    raise ValueError
            except Exception:
                return jsonify({'success': False, 'message': 'Mức trừ sao phải > 0'}), 400
        else:
            reputation_deduction = None

        order = db.query(Order).filter(Order.order_id == dispute.order_id).first()
        if not order:
            return jsonify({'success': False, 'message': 'Không tìm thấy đơn tranh chấp'}), 404

        targets = []
        if target_scope in ('BUYER', 'BOTH'):
            buyer = db.query(UserModel).filter(UserModel.user_id == order.buyer_id).first()
            if buyer:
                targets.append(buyer)
        if target_scope in ('SELLER', 'BOTH'):
            seller = db.query(UserModel).filter(UserModel.user_id == order.seller_id).first()
            if seller:
                targets.append(seller)
        if not targets:
            return jsonify({'success': False, 'message': 'Không tìm thấy người dùng để áp dụng'}), 404

        now = datetime.utcnow()
        for target in targets:
            if 'LOCK_ACCOUNT' in actions:
                target.status = 'BANNED'
                target.banned_permanent = bool(ban_permanent)
                target.banned_until = None if ban_permanent else (now + timedelta(days=int(ban_duration_days)))
                target.locked_at = now
            if 'DEDUCT_REPUTATION' in actions and reputation_deduction is not None:
                current_score = float(target.reputation_score or 0)
                target.reputation_score = max(0.0, round(current_score - reputation_deduction, 2))
            target.sanction_note = admin_note or dispute.penalty_note

        dispute.admin_penalty_applied_at = now
        dispute.admin_penalty_applied_by = admin_id
        dispute.admin_penalty_note = admin_note

        db.commit()
        db.refresh(dispute)
        return jsonify(_serialize_dispute(dispute, db)), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()

