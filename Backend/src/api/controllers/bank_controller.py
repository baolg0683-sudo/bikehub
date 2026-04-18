from flask import Blueprint, request, jsonify, g
from api.middleware.auth import require_auth, require_role
from infrastructure.models.auth.user_bank_model import UserBankInfo
from infrastructure.models.auth.user_model import UserModel
from infrastructure.databases import SessionLocal
from datetime import datetime

bank_bp = Blueprint('bank', __name__)

@bank_bp.route('/bank/info', methods=['GET'])
@require_auth
def get_bank_info():
    """Get user's linked bank account info"""
    user = g.get('user')
    if not user or user.get('user_id') is None:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    db = SessionLocal()
    try:
        bank_info = db.query(UserBankInfo).filter(
            UserBankInfo.user_id == int(user.get('user_id'))
        ).first()

        if not bank_info:
            return jsonify({'success': False, 'message': 'No bank info linked'}), 404

        return jsonify({
            'bank_info_id': bank_info.bank_info_id,
            'user_id': bank_info.user_id,
            'bank_name': bank_info.bank_name,
            'account_number': bank_info.account_number,
            'account_holder': bank_info.account_holder,
            'status': bank_info.status,
            'admin_note': bank_info.admin_note,
            'created_at': bank_info.created_at.isoformat() if bank_info.created_at else None,
            'verified_at': bank_info.verified_at.isoformat() if bank_info.verified_at else None,
        }), 200
    finally:
        db.close()

@bank_bp.route('/bank/info', methods=['POST'])
@require_auth
def link_bank_info():
    """Link bank account for withdrawal"""
    user = g.get('user')
    if not user or user.get('user_id') is None:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json() or {}
    bank_name = data.get('bank_name', '').strip()
    account_number = data.get('account_number', '').strip()
    account_holder = data.get('account_holder', '').strip()

    if not bank_name or not account_number or not account_holder:
        return jsonify({'success': False, 'message': 'All fields are required'}), 400

    if len(account_number) < 8 or len(account_number) > 20:
        return jsonify({'success': False, 'message': 'Account number must be 8-20 digits'}), 400

    db = SessionLocal()
    try:
        # Check if user already has bank info
        existing = db.query(UserBankInfo).filter(
            UserBankInfo.user_id == int(user.get('user_id'))
        ).first()

        if existing:
            # Update existing
            existing.bank_name = bank_name
            existing.account_number = account_number
            existing.account_holder = account_holder
            existing.status = 'PENDING'
            existing.admin_note = None
            existing.verified_at = None
            db.commit()
            db.refresh(existing)
            return jsonify({
                'success': True,
                'message': 'Bank info updated. Waiting for admin verification.',
                'status': existing.status
            }), 200
        else:
            # Create new
            bank_info = UserBankInfo(
                user_id=int(user.get('user_id')),
                bank_name=bank_name,
                account_number=account_number,
                account_holder=account_holder,
                status='PENDING'
            )
            db.add(bank_info)
            db.commit()
            db.refresh(bank_info)
            return jsonify({
                'success': True,
                'message': 'Bank info linked successfully. Waiting for admin verification.',
                'status': bank_info.status
            }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()

@bank_bp.route('/bank/pending-verifications', methods=['GET'])
@require_auth
@require_role('ADMIN')
def get_pending_bank_verifications():
    """Admin: Get pending bank verifications"""
    db = SessionLocal()
    try:
        rows = (
            db.query(UserBankInfo, UserModel.full_name)
            .join(UserModel, UserBankInfo.user_id == UserModel.user_id)
            .filter(UserBankInfo.status == 'PENDING')
            .order_by(UserBankInfo.created_at.desc())
            .all()
        )

        result = []
        for bank_info, full_name in rows:
            result.append({
                'bank_info_id': bank_info.bank_info_id,
                'user_id': bank_info.user_id,
                'user_full_name': (full_name or '').strip(),
                'bank_name': bank_info.bank_name,
                'account_number': bank_info.account_number,
                'account_holder': bank_info.account_holder,
                'status': bank_info.status,
                'created_at': bank_info.created_at.isoformat() if bank_info.created_at else None,
            })

        return jsonify(result), 200
    finally:
        db.close()

@bank_bp.route('/bank/verifications/<int:bank_info_id>/approve', methods=['POST'])
@require_auth
@require_role('ADMIN')
def approve_bank_verification(bank_info_id):
    """Admin: Approve bank verification"""
    admin = g.get('user')
    data = request.get_json() or {}
    admin_note = data.get('admin_note', '').strip()

    db = SessionLocal()
    try:
        bank_info = db.query(UserBankInfo).filter(
            UserBankInfo.bank_info_id == bank_info_id
        ).first()

        if not bank_info:
            return jsonify({'success': False, 'message': 'Bank info not found'}), 404

        if bank_info.status != 'PENDING':
            return jsonify({'success': False, 'message': 'Only pending verifications can be approved'}), 400

        bank_info.status = 'VERIFIED'
        bank_info.verified_by = int(admin.get('user_id'))
        bank_info.verified_at = datetime.utcnow()
        bank_info.admin_note = admin_note

        db.commit()
        db.refresh(bank_info)

        return jsonify({
            'success': True,
            'message': 'Bank info verified successfully.',
            'status': bank_info.status
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()

@bank_bp.route('/bank/verifications/<int:bank_info_id>/reject', methods=['POST'])
@require_auth
@require_role('ADMIN')
def reject_bank_verification(bank_info_id):
    """Admin: Reject bank verification"""
    admin = g.get('user')
    data = request.get_json() or {}
    admin_note = data.get('admin_note', '').strip()

    if not admin_note:
        return jsonify({'success': False, 'message': 'Admin note is required for rejection'}), 400

    db = SessionLocal()
    try:
        bank_info = db.query(UserBankInfo).filter(
            UserBankInfo.bank_info_id == bank_info_id
        ).first()

        if not bank_info:
            return jsonify({'success': False, 'message': 'Bank info not found'}), 404

        if bank_info.status != 'PENDING':
            return jsonify({'success': False, 'message': 'Only pending verifications can be rejected'}), 400

        bank_info.status = 'REJECTED'
        bank_info.verified_by = int(admin.get('user_id'))
        bank_info.verified_at = datetime.utcnow()
        bank_info.admin_note = admin_note

        db.commit()
        db.refresh(bank_info)

        return jsonify({
            'success': True,
            'message': 'Bank info rejected.',
            'status': bank_info.status
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    finally:
        db.close()
