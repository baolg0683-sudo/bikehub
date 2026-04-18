from decimal import Decimal, InvalidOperation
from datetime import datetime
from infrastructure.databases import SessionLocal
from infrastructure.models.pay.models import WalletTransaction
from infrastructure.models.auth.user_model import UserModel
from infrastructure.models.auth.user_bank_model import UserBankInfo

class WalletService:
    @staticmethod
    def create_topup_request(user_id, fiat_amount, transfer_note, bank_info=None):
        db = SessionLocal()
        try:
            # Check if user has verified bank info
            bank_verification = db.query(UserBankInfo).filter(
                UserBankInfo.user_id == user_id,
                UserBankInfo.status == 'VERIFIED'
            ).first()
            
            if not bank_verification:
                raise ValueError('Bank account must be verified before creating top-up requests')
            
            amount = Decimal('0.00')
            tx = WalletTransaction(
                user_id=user_id,
                amount=amount,
                fiat_amount=fiat_amount,
                currency='B',
                type='TOPUP_REQUEST',
                status='PENDING',
                bank_info=bank_info or {},
                transfer_note=transfer_note
            )
            db.add(tx)
            db.commit()
            db.refresh(tx)
            return tx
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def list_pending_topup_requests():
        db = SessionLocal()
        try:
            return (
                db.query(WalletTransaction, UserModel.full_name)
                .join(UserModel, WalletTransaction.user_id == UserModel.user_id)
                .filter(
                    WalletTransaction.type == 'TOPUP_REQUEST',
                    WalletTransaction.status == 'PENDING',
                )
                .order_by(WalletTransaction.created_at.desc())
                .all()
            )
        finally:
            db.close()

    @staticmethod
    def get_user_transactions(user_id):
        db = SessionLocal()
        try:
            return db.query(WalletTransaction).filter(WalletTransaction.user_id == user_id).order_by(WalletTransaction.created_at.desc()).all()
        finally:
            db.close()

    @staticmethod
    def approve_topup_request(transaction_id, admin_id, bikecoin_amount=None, admin_note=''):
        db = SessionLocal()
        try:
            tx = db.query(WalletTransaction).filter(WalletTransaction.transaction_id == transaction_id).first()
            if not tx or tx.type != 'TOPUP_REQUEST' or tx.status != 'PENDING':
                raise ValueError('Top-up request not found or already handled')

            fiat_amount = tx.fiat_amount or Decimal('0.00')
            bikecoin_amount = fiat_amount / Decimal('1')  # 1 VND = 1 BikeCoin

            user = db.query(UserModel).filter(UserModel.user_id == tx.user_id).first()
            if not user:
                raise ValueError('User not found')

            user.balance = (user.balance or Decimal('0.00')) + bikecoin_amount
            tx.amount = bikecoin_amount
            tx.type = 'TOPUP'
            tx.status = 'SUCCESS'
            tx.processed_by = admin_id
            tx.processed_at = datetime.utcnow()
            tx.admin_note = admin_note

            db.commit()
            db.refresh(tx)
            return tx
        except InvalidOperation:
            db.rollback()
            raise ValueError('Invalid bikecoin amount')
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def reject_topup_request(transaction_id, admin_id, admin_note=''):
        db = SessionLocal()
        try:
            tx = db.query(WalletTransaction).filter(WalletTransaction.transaction_id == transaction_id).first()
            if not tx or tx.type != 'TOPUP_REQUEST' or tx.status != 'PENDING':
                raise ValueError('Top-up request not found or already handled')

            tx.status = 'REJECTED'
            tx.processed_by = admin_id
            tx.processed_at = datetime.utcnow()
            tx.admin_note = admin_note

            db.commit()
            db.refresh(tx)
            return tx
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def create_withdrawal_request(user_id, amount):
        db = SessionLocal()
        try:
            user = db.query(UserModel).filter(UserModel.user_id == user_id).first()
            if not user:
                raise ValueError('User not found')
            
            # Check if user has verified bank info
            bank_verification = db.query(UserBankInfo).filter(
                UserBankInfo.user_id == user_id,
                UserBankInfo.status == 'VERIFIED'
            ).first()
            
            if not bank_verification:
                raise ValueError('Bank account must be verified before creating withdrawal requests')
            
            amt = Decimal(str(amount))
            bal = user.balance or Decimal('0.00')
            if bal < amt:
                raise ValueError('Insufficient balance')

            # Tạm giữ: trừ số dư ngay khi tạo lệnh (chờ admin duyệt / từ chối hoàn lại)
            user.balance = bal - amt
            tx = WalletTransaction(
                user_id=user_id,
                amount=amt,
                fiat_amount=amt,
                currency='B',
                type='WITHDRAWAL_REQUEST',
                status='PENDING',
                bank_info={'hold_applied': True},
            )
            db.add(tx)
            db.commit()
            db.refresh(tx)
            return tx
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def list_pending_withdrawal_requests():
        """Return list of (WalletTransaction, full_name|None). No SQL JOIN — avoids ORM/schema issues."""
        db = SessionLocal()
        try:
            txs = (
                db.query(WalletTransaction)
                .filter(
                    WalletTransaction.type == 'WITHDRAWAL_REQUEST',
                    WalletTransaction.status == 'PENDING',
                )
                .order_by(WalletTransaction.created_at.desc())
                .all()
            )
            if not txs:
                return []
            user_ids = list({int(tx.user_id) for tx in txs})
            rows = (
                db.query(UserModel.user_id, UserModel.full_name)
                .filter(UserModel.user_id.in_(user_ids))
                .all()
            )
            names = {int(uid): fn for uid, fn in rows}
            return [(tx, names.get(int(tx.user_id))) for tx in txs]
        finally:
            db.close()

    @staticmethod
    def approve_withdrawal_request(transaction_id, admin_id, admin_note=''):
        db = SessionLocal()
        try:
            tx = db.query(WalletTransaction).filter(WalletTransaction.transaction_id == transaction_id).first()
            if not tx or tx.type != 'WITHDRAWAL_REQUEST' or tx.status != 'PENDING':
                raise ValueError('Withdrawal request not found or already handled')

            user = db.query(UserModel).filter(UserModel.user_id == tx.user_id).first()
            if not user:
                raise ValueError('User not found')

            hold_applied = isinstance(tx.bank_info, dict) and tx.bank_info.get('hold_applied') is True
            if not hold_applied:
                # Lệnh cũ chưa tạm giữ — vẫn trừ số dư khi duyệt
                user.balance = (user.balance or Decimal('0.00')) - tx.amount

            tx.type = 'WITHDRAWAL'
            tx.status = 'SUCCESS'
            tx.processed_by = admin_id
            tx.processed_at = datetime.utcnow()
            tx.admin_note = admin_note

            db.commit()
            db.refresh(tx)
            return tx
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def reject_withdrawal_request(transaction_id, admin_id, admin_note=''):
        db = SessionLocal()
        try:
            tx = db.query(WalletTransaction).filter(WalletTransaction.transaction_id == transaction_id).first()
            if not tx or tx.type != 'WITHDRAWAL_REQUEST' or tx.status != 'PENDING':
                raise ValueError('Withdrawal request not found or already handled')

            user = db.query(UserModel).filter(UserModel.user_id == tx.user_id).first()
            if not user:
                raise ValueError('User not found')

            hold_applied = isinstance(tx.bank_info, dict) and tx.bank_info.get('hold_applied') is True
            if hold_applied:
                user.balance = (user.balance or Decimal('0.00')) + tx.amount

            tx.status = 'REJECTED'
            tx.processed_by = admin_id
            tx.processed_at = datetime.utcnow()
            tx.admin_note = admin_note

            db.commit()
            db.refresh(tx)
            return tx
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
