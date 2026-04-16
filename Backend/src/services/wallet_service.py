from decimal import Decimal, InvalidOperation
from datetime import datetime
from infrastructure.databases import SessionLocal
from infrastructure.models.pay.models import WalletTransaction
from infrastructure.models.auth.user_model import UserModel

class WalletService:
    @staticmethod
    def create_topup_request(user_id, fiat_amount, transfer_note, evidence_url, bank_info=None):
        db = SessionLocal()
        try:
            amount = Decimal('0.00')
            tx = WalletTransaction(
                user_id=user_id,
                amount=amount,
                fiat_amount=fiat_amount,
                currency='B',
                type='TOPUP_REQUEST',
                status='PENDING',
                bank_info=bank_info or {},
                transfer_note=transfer_note,
                evidence_url=evidence_url
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
            return db.query(WalletTransaction).filter(
                WalletTransaction.type == 'TOPUP_REQUEST',
                WalletTransaction.status == 'PENDING'
            ).order_by(WalletTransaction.created_at.desc()).all()
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
            if bikecoin_amount is None:
                bikecoin_amount = (fiat_amount / Decimal('1000')).quantize(Decimal('0.01'))
            else:
                bikecoin_amount = Decimal(bikecoin_amount)

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
