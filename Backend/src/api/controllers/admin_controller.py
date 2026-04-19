"""Admin dashboard controller"""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func

from api.middleware.auth import require_role
from infrastructure.databases import db
from infrastructure.models.auth.user_model import UserModel
from infrastructure.models.auth.user_bank_model import UserBankInfo
from infrastructure.models.pay.models import WalletTransaction
from infrastructure.models.orders.models import Order
from infrastructure.models.orders.dispute_model import OrderDispute
from infrastructure.models.sell.models import Listing
import bcrypt

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# DB facts (from wallet_service.py):
# Topup pending:       type='TOPUP_REQUEST'  status='PENDING'
# Topup approved:      type='TOPUP'          status='SUCCESS'
# Topup rejected:      type='TOPUP_REQUEST'  status='REJECTED'
# Withdrawal pending:  type='WITHDRAWAL_REQUEST' status='PENDING'
# Withdrawal approved: type='WITHDRAWAL'     status='SUCCESS'
# Withdrawal rejected: type='WITHDRAWAL_REQUEST' status='REJECTED'
# Inspection fee:      type='INSPECTION_FEE' status='SUCCESS' amount=BikeCoin
# Listing active:      status='AVAILABLE'    is_hidden=False
# Dispute resolved:    status='RESOLVED' or 'CANCELLED'
# Bank verified:       status='VERIFIED' or 'REJECTED'


def _date_buckets(range_type: str):
    now = datetime.utcnow()
    buckets = []
    if range_type == 'day':
        for i in range(23, -1, -1):
            start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=i)
            end = start + timedelta(hours=1)
            buckets.append((start.strftime('%H:%M'), start, end))
    elif range_type == 'week':
        for i in range(6, -1, -1):
            start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
            buckets.append((start.strftime('%d/%m'), start, end))
    elif range_type == 'month':
        for i in range(29, -1, -1):
            start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
            buckets.append((start.strftime('%d/%m'), start, end))
    else:  # year
        for i in range(11, -1, -1):
            month = now.month - i
            year = now.year
            while month <= 0:
                month += 12
                year -= 1
            start = datetime(year, month, 1)
            end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
            buckets.append((start.strftime('%m/%Y'), start, end))
    return buckets


@admin_bp.route('/summary', methods=['GET'])
@require_role('ADMIN')
def get_summary():
    """All-time snapshot for fixed summary cards"""
    s = db.session
    try:
        users_total = s.query(func.count(UserModel.user_id)).filter(
            UserModel.role == 'USER'
        ).scalar() or 0

        inspectors_total = s.query(func.count(UserModel.user_id)).filter(
            UserModel.role == 'INSPECTOR'
        ).scalar() or 0

        pending_topup = s.query(func.count(WalletTransaction.transaction_id)).filter(
            WalletTransaction.type == 'TOPUP_REQUEST',
            WalletTransaction.status == 'PENDING'
        ).scalar() or 0

        pending_withdrawal = s.query(func.count(WalletTransaction.transaction_id)).filter(
            WalletTransaction.type == 'WITHDRAWAL_REQUEST',
            WalletTransaction.status == 'PENDING'
        ).scalar() or 0

        pending_bank = s.query(func.count(UserBankInfo.bank_info_id)).filter(
            UserBankInfo.status == 'PENDING'
        ).scalar() or 0

        pending_disputes = s.query(func.count(OrderDispute.dispute_id)).filter(
            OrderDispute.status.in_(['OPEN', 'ASSIGNED'])
        ).scalar() or 0

        revenue_row = s.query(
            func.coalesce(func.sum(WalletTransaction.amount), 0)
        ).filter(
            WalletTransaction.type == 'INSPECTION_FEE',
            WalletTransaction.status == 'SUCCESS'
        ).scalar()
        total_revenue = float(revenue_row or 0)

        return jsonify({
            'users_total': users_total,
            'inspectors_total': inspectors_total,
            'pending_topup': pending_topup,
            'pending_withdrawal': pending_withdrawal,
            'pending_bank': pending_bank,
            'pending_disputes': pending_disputes,
            'total_revenue': str(total_revenue),
        }), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/dashboard', methods=['GET'])
@require_role('ADMIN')
def get_dashboard():
    range_type = request.args.get('range', 'month')
    if range_type not in ('day', 'week', 'month', 'year'):
        range_type = 'month'

    s = db.session
    buckets = _date_buckets(range_type)

    try:
        # ── Totals within the selected range ─────────────────────────────────
        def _count_in_range(col, date_col, filters=None):
            q = s.query(func.count(col)).filter(
                date_col >= buckets[0][1], date_col < buckets[-1][2]
            )
            if filters:
                for f in filters:
                    q = q.filter(f)
            return q.scalar() or 0

        def _sum_in_range(sum_col, date_col, filters=None):
            q = s.query(func.coalesce(func.sum(sum_col), 0)).filter(
                date_col >= buckets[0][1], date_col < buckets[-1][2]
            )
            if filters:
                for f in filters:
                    q = q.filter(f)
            return float(q.scalar() or 0)

        users_total = _count_in_range(
            UserModel.user_id, UserModel.created_at, [UserModel.role == 'USER'])
        inspectors_total = _count_in_range(
            UserModel.user_id, UserModel.created_at, [UserModel.role == 'INSPECTOR'])
        topup_requests = _count_in_range(
            WalletTransaction.transaction_id, WalletTransaction.created_at,
            [WalletTransaction.type.in_(['TOPUP', 'TOPUP_REQUEST']),
             WalletTransaction.status.in_(['SUCCESS', 'REJECTED'])])
        withdrawal_requests = _count_in_range(
            WalletTransaction.transaction_id, WalletTransaction.created_at,
            [WalletTransaction.type.in_(['WITHDRAWAL', 'WITHDRAWAL_REQUEST']),
             WalletTransaction.status.in_(['SUCCESS', 'REJECTED'])])
        active_disputes = _count_in_range(
            OrderDispute.dispute_id, OrderDispute.created_at,
            [OrderDispute.status.in_(['RESOLVED', 'CANCELLED'])])
        bank_verifications = _count_in_range(
            UserBankInfo.bank_info_id, UserBankInfo.created_at,
            [UserBankInfo.status.in_(['VERIFIED', 'REJECTED'])])
        total_revenue = _sum_in_range(
            WalletTransaction.amount, WalletTransaction.created_at,
            [WalletTransaction.type == 'INSPECTION_FEE',
             WalletTransaction.status == 'SUCCESS'])
        listings_active = _count_in_range(
            Listing.listing_id, Listing.created_at,
            [Listing.status == 'AVAILABLE', Listing.is_hidden == False])  # noqa: E712
        orders_completed = _count_in_range(
            Order.order_id, Order.updated_at, [Order.status == 'COMPLETED'])

        # ── Trend per bucket ──────────────────────────────────────────────────
        def _count_trend(col, date_col, filters=None):
            data = []
            for label, start, end in buckets:
                q = s.query(func.count(col)).filter(date_col >= start, date_col < end)
                if filters:
                    for f in filters:
                        q = q.filter(f)
                data.append({'date': label, 'value': q.scalar() or 0})
            return data

        def _sum_trend(sum_col, date_col, filters=None):
            data = []
            for label, start, end in buckets:
                q = s.query(func.coalesce(func.sum(sum_col), 0)).filter(
                    date_col >= start, date_col < end)
                if filters:
                    for f in filters:
                        q = q.filter(f)
                data.append({'date': label, 'value': float(q.scalar() or 0)})
            return data

        return jsonify({
            'users_total': users_total,
            'inspectors_total': inspectors_total,
            'topup_requests': topup_requests,
            'withdrawal_requests': withdrawal_requests,
            'active_disputes': active_disputes,
            'bank_verifications': bank_verifications,
            'total_revenue': str(total_revenue),
            'listings_active': listings_active,
            'orders_completed': orders_completed,
            'trends': {
                'users': _count_trend(UserModel.user_id, UserModel.created_at,
                    [UserModel.role == 'USER']),
                'inspectors': _count_trend(UserModel.user_id, UserModel.created_at,
                    [UserModel.role == 'INSPECTOR']),
                'topup_requests': _count_trend(
                    WalletTransaction.transaction_id, WalletTransaction.created_at,
                    [WalletTransaction.type.in_(['TOPUP', 'TOPUP_REQUEST']),
                     WalletTransaction.status.in_(['SUCCESS', 'REJECTED'])]),
                'withdrawal_requests': _count_trend(
                    WalletTransaction.transaction_id, WalletTransaction.created_at,
                    [WalletTransaction.type.in_(['WITHDRAWAL', 'WITHDRAWAL_REQUEST']),
                     WalletTransaction.status.in_(['SUCCESS', 'REJECTED'])]),
                'active_disputes': _count_trend(
                    OrderDispute.dispute_id, OrderDispute.created_at,
                    [OrderDispute.status.in_(['RESOLVED', 'CANCELLED'])]),
                'bank_verifications': _count_trend(
                    UserBankInfo.bank_info_id, UserBankInfo.created_at,
                    [UserBankInfo.status.in_(['VERIFIED', 'REJECTED'])]),
                'total_revenue': _sum_trend(
                    WalletTransaction.amount, WalletTransaction.created_at,
                    [WalletTransaction.type == 'INSPECTION_FEE',
                     WalletTransaction.status == 'SUCCESS']),
                'listings_active': _count_trend(
                    Listing.listing_id, Listing.created_at,
                    [Listing.status == 'AVAILABLE',
                     Listing.is_hidden == False]),  # noqa: E712
                'orders_completed': _count_trend(
                    Order.order_id, Order.updated_at,
                    [Order.status == 'COMPLETED']),
            }
        }), 200

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/users', methods=['GET'])
@require_role('ADMIN')
def list_users():
    s = db.session
    try:
        users = s.query(UserModel).filter(
            UserModel.role.in_(['USER', 'INSPECTOR'])
        ).order_by(UserModel.created_at.desc()).all()
        result = []
        for u in users:
            bikes_sold = s.query(func.count(Order.order_id)).filter(
                Order.seller_id == u.user_id, Order.status == 'COMPLETED'
            ).scalar() or 0
            bikes_bought = s.query(func.count(Order.order_id)).filter(
                Order.buyer_id == u.user_id, Order.status == 'COMPLETED'
            ).scalar() or 0
            result.append({
                'user_id': u.user_id,
                'full_name': u.full_name or '',
                'email': u.email,
                'phone': u.phone,
                'avatar_url': u.avatar_url,
                'role': u.role,
                'service_area': u.service_area,
                'status': u.status,
                'banned_permanent': bool(u.banned_permanent),
                'banned_until': u.banned_until.isoformat() if u.banned_until else None,
                'rating': float(u.reputation_score or 5.0),
                'bikes_sold': bikes_sold,
                'bikes_bought': bikes_bought,
            })
        return jsonify(result), 200
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/lock', methods=['POST'])
@require_role('ADMIN')
def lock_user(user_id: int):
    """Lock a user: permanent or for N days"""
    s = db.session
    data = request.get_json() or {}
    permanent = bool(data.get('permanent', False))
    days = int(data.get('days', 0))

    if not permanent and days <= 0:
        return jsonify({'success': False, 'message': 'Cần nhập số ngày hoặc chọn vĩnh viễn'}), 400
    try:
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not u:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        u.status = 'BANNED'
        u.banned_permanent = permanent
        u.banned_until = None if permanent else (datetime.utcnow() + timedelta(days=days))
        u.locked_at = datetime.utcnow()
        s.commit()
        return jsonify({
            'success': True,
            'message': 'Đã khóa tài khoản vĩnh viễn' if permanent else f'Đã khóa tài khoản {days} ngày',
            'status': u.status,
            'banned_permanent': u.banned_permanent,
            'banned_until': u.banned_until.isoformat() if u.banned_until else None,
        }), 200
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/unlock', methods=['POST'])
@require_role('ADMIN')
def unlock_user(user_id: int):
    """Unlock a user"""
    s = db.session
    try:
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not u:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        u.status = 'ACTIVE'
        u.banned_permanent = False
        u.banned_until = None
        u.locked_at = None
        s.commit()
        return jsonify({'success': True, 'message': 'Đã mở khóa tài khoản', 'status': 'ACTIVE'}), 200
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@require_role('ADMIN')
def reset_user_password(user_id: int):
    s = db.session
    try:
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not u:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        default_pw = 'Bikehub@123'
        u.password_hash = bcrypt.hashpw(default_pw.encode(), bcrypt.gensalt()).decode()
        s.commit()
        return jsonify({'success': True, 'message': f'Mật khẩu đã được đặt lại thành: {default_pw}'}), 200
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/profile', methods=['GET'])
@require_role('ADMIN')
def get_admin_profile():
    user_id = g.user.get('user_id')
    s = db.session
    try:
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not u:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        return jsonify({
            'user_id': u.user_id,
            'full_name': u.full_name or '',
            'email': u.email,
            'phone': u.phone or '',
            'avatar_url': u.avatar_url or '',
            'role': u.role,
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/profile', methods=['PUT'])
@require_role('ADMIN')
def update_admin_profile():
    user_id = g.user.get('user_id')
    s = db.session
    data = request.get_json() or {}
    try:
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not u:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        if data.get('full_name', '').strip():
            u.full_name = data['full_name'].strip()
        if data.get('phone', '').strip():
            u.phone = data['phone'].strip()
        if data.get('email', '').strip():
            u.email = data['email'].strip().lower()
        s.commit()
        return jsonify({
            'success': True, 'message': 'Cập nhật thành công',
            'user': {
                'user_id': u.user_id, 'full_name': u.full_name or '',
                'email': u.email, 'phone': u.phone or '',
                'avatar_url': u.avatar_url or '', 'role': u.role,
            }
        }), 200
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/upload-avatar', methods=['POST'])
@require_role('ADMIN')
def upload_admin_avatar():
    import os, uuid, io
    from flask import current_app
    from werkzeug.utils import secure_filename
    from PIL import Image

    user_id = g.user.get('user_id')
    s = db.session
    if 'avatar' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'}), 400
    file = request.files['avatar']
    if not file or not file.filename:
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ('png', 'jpg', 'jpeg', 'webp', 'gif'):
        return jsonify({'success': False, 'message': 'Invalid file type'}), 400
    data = file.read()
    if len(data) > 5 * 1024 * 1024:
        return jsonify({'success': False, 'message': 'File too large (max 5MB)'}), 400
    try:
        img = Image.open(io.BytesIO(data))
        img.thumbnail((512, 512), Image.LANCZOS)
        if img.mode in ('RGBA', 'LA'):
            img = img.convert('RGB')
        upload_dir = os.path.join(current_app.root_path, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}_avatar.jpg"
        img.save(os.path.join(upload_dir, unique_name), format='JPEG', quality=85)
        avatar_url = f"/api/uploads/{unique_name}"
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if u:
            u.avatar_url = avatar_url
            s.commit()
        return jsonify({'success': True, 'avatar_url': avatar_url}), 200
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@admin_bp.route('/change-password', methods=['POST'])
@require_role('ADMIN')
def change_admin_password():
    user_id = g.user.get('user_id')
    s = db.session
    data = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    if not current_password or not new_password:
        return jsonify({'success': False, 'message': 'Vui lòng nhập đầy đủ mật khẩu'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'Mật khẩu mới phải có ít nhất 6 ký tự'}), 400
    try:
        u = s.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not u:
            return jsonify({'success': False, 'message': 'Not found'}), 404
        if not bcrypt.checkpw(current_password.encode(), u.password_hash.encode()):
            return jsonify({'success': False, 'message': 'Mật khẩu hiện tại không đúng'}), 401
        u.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        s.commit()
        return jsonify({'success': True, 'message': 'Đổi mật khẩu thành công'}), 200
    except Exception as e:
        s.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
