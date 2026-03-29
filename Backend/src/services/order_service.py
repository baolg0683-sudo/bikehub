from infrastructure.databases import SessionLocal
from infrastructure.models.orders.models import Order, DepositEscrow
from infrastructure.models.auth.models import User  # Assuming User model exists
from infrastructure.models.sell.models import Listing  # Assuming Listing model exists
from infrastructure.models.pay.models import WalletTransaction  # Assuming WalletTransaction model exists
from sqlalchemy.exc import IntegrityError
from decimal import Decimal

class OrderService:
    @staticmethod
    def get_all_orders():
        """Get all orders"""
        db = SessionLocal()
        try:
            orders = db.query(Order).all()
            return orders
        finally:
            db.close()

    @staticmethod
    def create_order(listing_id, buyer_id, seller_id, final_price):
        """Create a new order"""
        db = SessionLocal()
        try:
            order = Order(
                listing_id=listing_id,
                buyer_id=buyer_id,
                seller_id=seller_id,
                final_price=final_price
            )
            db.add(order)
            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def deposit_process(order_id, buyer_id):
        """Handle deposit process: check balance, deduct, create escrow, update listing"""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.buyer_id != buyer_id or order.status != 'WAITING_FOR_DEPOSIT':
                raise ValueError("Invalid order or status")

            buyer = db.query(User).filter(User.user_id == buyer_id).first()
            if buyer.balance < order.final_price:
                raise ValueError("Insufficient balance")

            # Deduct balance
            buyer.balance -= order.final_price

            # Create wallet transaction (ESCROW_HOLD)
            tx = WalletTransaction(
                user_id=buyer_id,
                amount=-order.final_price,
                type='ESCROW_HOLD',
                status='SUCCESS'
            )
            db.add(tx)
            db.flush()  # Get tx id

            # Create escrow
            escrow = DepositEscrow(
                order_id=order_id,
                wallet_tx_id=tx.transaction_id,
                amount=order.final_price
            )
            db.add(escrow)

            # Update order status
            order.status = 'PAID_DEPOSIT'

            # Update listing status
            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            listing.status = 'RESERVED'

            db.commit()
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def payout_process(order_id, buyer_id):
        """Handle payout: release escrow, credit seller, create payout tx"""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.buyer_id != buyer_id or order.status != 'PAID_DEPOSIT':
                raise ValueError("Invalid order or status")

            escrow = db.query(DepositEscrow).filter(DepositEscrow.order_id == order_id).first()
            if not escrow or escrow.status != 'HELD_BY_SYSTEM':
                raise ValueError("Escrow not held")

            seller = db.query(User).filter(User.user_id == order.seller_id).first()
            seller.balance += escrow.amount

            # Create payout tx
            tx = WalletTransaction(
                user_id=order.seller_id,
                amount=escrow.amount,
                type='PAYOUT',
                status='SUCCESS'
            )
            db.add(tx)

            # Update escrow
            escrow.status = 'RELEASED'

            # Update order
            order.status = 'COMPLETED'

            # Update listing
            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            listing.status = 'SOLD'

            db.commit()
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def refund_process(order_id, admin_id):
        """Handle refund: credit buyer, update statuses"""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.status not in ['PAID_DEPOSIT', 'WAITING_FOR_DEPOSIT']:
                raise ValueError("Invalid order status")

            escrow = db.query(DepositEscrow).filter(DepositEscrow.order_id == order_id).first()
            if escrow:
                buyer = db.query(User).filter(User.user_id == order.buyer_id).first()
                buyer.balance += escrow.amount

                # Create refund tx
                tx = WalletTransaction(
                    user_id=order.buyer_id,
                    amount=escrow.amount,
                    type='REFUND',
                    status='SUCCESS'
                )
                db.add(tx)

                escrow.status = 'REFUNDED'

            # Update order
            order.status = 'CANCELLED'

            # Update listing
            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            listing.status = 'AVAILABLE'

            db.commit()
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()