from decimal import Decimal
from flask import Blueprint, request, jsonify, g
from api.middleware.auth import require_auth, require_role
from services.wallet_service import WalletService
from infrastructure.models.auth.user_model import UserModel
from infrastructure.databases import SessionLocal

wallet_bp = Blueprint('wallet', __name__)

@wallet_bp.route('/wallet/me', methods=['GET'])
@require_auth
def get_wallet_info():
    user = g.get('user')
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    db = SessionLocal()
    try:
        account = db.query(UserModel).filter(UserModel.user_id == int(user.get('user_id'))).first()
        if not account:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        return jsonify({
            'user_id': account.user_id,
            'role': account.role,
            'balance': str(account.balance or 0),
            'currency': 'B'
        }), 200
    finally:
        db.close()

@wallet_bp.route('/wallet/transactions', methods=['GET'])
@require_auth
def user_transactions():
    user = g.get('user')
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    try:
        transactions = WalletService.get_user_transactions(int(user.get('user_id')))
        return jsonify([
            {
                'transaction_id': tx.transaction_id,
                'user_id': tx.user_id,
                'amount': str(tx.amount),
                'fiat_amount': str(tx.fiat_amount or 0),
                'currency': tx.currency,
                'type': tx.type,
                'status': tx.status,
                'transfer_note': tx.transfer_note,
                'evidence_url': tx.evidence_url,
                'admin_note': tx.admin_note,
                'processed_by': tx.processed_by,
                'created_at': tx.created_at.isoformat() if tx.created_at else None,
                'processed_at': tx.processed_at.isoformat() if tx.processed_at else None,
            }
            for tx in transactions
        ]), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@wallet_bp.route('/wallet/topup-requests', methods=['POST'])
@require_auth
def create_topup_request():
    user = g.get('user')
    if not user:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json() or {}
    fiat_amount = data.get('fiat_amount')
    transfer_note = data.get('transfer_note', '').strip()
    evidence_url = data.get('evidence_url', '').strip()
    bank_info = data.get('bank_info', {})

    if fiat_amount is None:
        return jsonify({'success': False, 'message': 'fiat_amount is required'}), 400

    try:
        fiat_amount = Decimal(str(fiat_amount))
    except Exception:
        return jsonify({'success': False, 'message': 'fiat_amount must be a valid number'}), 400

    if fiat_amount <= 0:
        return jsonify({'success': False, 'message': 'fiat_amount must be greater than 0'}), 400
    if (fiat_amount % Decimal('100000')) != 0:
        return jsonify({
            'success': False,
            'message': 'Số tiền nạp phải chia hết cho 100000. Yêu cầu sẽ bị hủy nếu số tiền hoặc nội dung lệnh không đúng, thời gian hoàn tiền dự kiến 3-5 ngày làm việc.'
        }), 400
    if not transfer_note:
        return jsonify({'success': False, 'message': 'transfer_note is required'}), 400

    try:
        tx = WalletService.create_topup_request(
            user_id=int(user.get('user_id')),
            fiat_amount=fiat_amount,
            transfer_note=transfer_note,
            evidence_url=evidence_url,
            bank_info=bank_info
        )
        return jsonify({
            'success': True,
            'transaction_id': tx.transaction_id,
            'status': tx.status,
            'message': 'Top-up request created. Admin sẽ kiểm tra nội dung lệnh và duyệt thủ công.'
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@wallet_bp.route('/wallet/topup-requests', methods=['GET'])
@require_auth
@require_role('ADMIN')
def pending_topup_requests():
    try:
        transactions = WalletService.list_pending_topup_requests()
        return jsonify([
            {
                'transaction_id': tx.transaction_id,
                'user_id': tx.user_id,
                'fiat_amount': str(tx.fiat_amount or 0),
                'currency': tx.currency,
                'type': tx.type,
                'status': tx.status,
                'transfer_note': tx.transfer_note,
                'bank_info': tx.bank_info,
                'evidence_url': tx.evidence_url,
                'created_at': tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx in transactions
        ]), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@wallet_bp.route('/wallet/topup-requests/<int:transaction_id>/approve', methods=['POST'])
@require_auth
@require_role('ADMIN')
def approve_topup_request(transaction_id):
    data = request.get_json() or {}
    admin_note = data.get('admin_note', '').strip()
    bikecoin_amount = data.get('bikecoin_amount')

    try:
        tx = WalletService.approve_topup_request(
            transaction_id=transaction_id,
            admin_id=int(g.user.get('user_id')),
            bikecoin_amount=bikecoin_amount,
            admin_note=admin_note
        )
        return jsonify({
            'success': True,
            'transaction_id': tx.transaction_id,
            'status': tx.status,
            'amount': str(tx.amount),
            'message': 'Top-up approved and BikeCoin balance credited.'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

@wallet_bp.route('/wallet/topup-requests/<int:transaction_id>/reject', methods=['POST'])
@require_auth
@require_role('ADMIN')
def reject_topup_request(transaction_id):
    data = request.get_json() or {}
    admin_note = data.get('admin_note', '').strip()

    try:
        tx = WalletService.reject_topup_request(
            transaction_id=transaction_id,
            admin_id=int(g.user.get('user_id')),
            admin_note=admin_note
        )
        return jsonify({
            'success': True,
            'transaction_id': tx.transaction_id,
            'status': tx.status,
            'message': 'Top-up request rejected.'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400
