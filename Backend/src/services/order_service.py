from decimal import Decimal, ROUND_DOWN
from datetime import datetime
from sqlalchemy import or_

from infrastructure.databases import SessionLocal
from infrastructure.models.orders.models import Order, DepositEscrow
from infrastructure.models.orders.dispute_model import OrderDispute
from infrastructure.models.auth.user_model import UserModel
from infrastructure.models.sell.models import Listing
from infrastructure.models.pay.models import WalletTransaction

ALLOWED_DEPOSIT_PERCENTS = (Decimal('25'), Decimal('50'), Decimal('100'))

# Trạng thái đơn (đang xử lý — không cho tạo đơn mới cùng listing)
ORDER_ACTIVE_STATUSES = (
    'AWAITING_DEPOSIT',
    'DEPOSIT_HELD',
    'SELLER_CONFIRMED_HANDOVER',
    'DISPUTE_OPEN',
)

ORDER_TERMINAL = (
    'COMPLETED',
    'CANCELLED_BY_BUYER',
    'REJECTED_BY_BUYER',
)


class OrderService:
    @staticmethod
    def get_all_orders():
        db = SessionLocal()
        try:
            return db.query(Order).order_by(Order.created_at.desc()).all()
        finally:
            db.close()

    @staticmethod
    def get_orders_for_user(user_id: int):
        db = SessionLocal()
        try:
            return (
                db.query(Order)
                .filter(or_(Order.buyer_id == user_id, Order.seller_id == user_id))
                .order_by(Order.created_at.desc())
                .all()
            )
        finally:
            db.close()

    @staticmethod
    def get_order_for_user(order_id: int, user_id: int):
        db = SessionLocal()
        try:
            o = db.query(Order).filter(Order.order_id == order_id).first()
            if not o or user_id not in (o.buyer_id, o.seller_id):
                return None
            return o
        finally:
            db.close()

    @staticmethod
    def _quantize_money(v: Decimal) -> Decimal:
        return v.quantize(Decimal('0.01'), rounding=ROUND_DOWN)

    @staticmethod
    def create_purchase_order(buyer_id: int, listing_id: int, deposit_percent: Decimal):
        """Tạo đơn: chọn % cọc 25 / 50 / 100. Chưa trừ tiền."""
        db = SessionLocal()
        try:
            pct = OrderService._quantize_money(Decimal(str(deposit_percent)))
            if pct not in ALLOWED_DEPOSIT_PERCENTS:
                raise ValueError('deposit_percent phải là 25, 50 hoặc 100')

            listing = db.query(Listing).filter(Listing.listing_id == listing_id).first()
            if not listing:
                raise ValueError('Không tìm thấy tin đăng')
            if listing.seller_id == buyer_id:
                raise ValueError('Không thể đặt mua tin của chính bạn')
            if listing.status not in ('AVAILABLE', 'PENDING', 'PENDING_PROMOTION'):
                raise ValueError('Xe không còn mở bán hoặc đang giao dịch')

            dup = (
                db.query(Order)
                .filter(
                    Order.listing_id == listing_id,
                    Order.status.in_(ORDER_ACTIVE_STATUSES),
                )
                .first()
            )
            if dup:
                raise ValueError('Tin này đang có đơn đặt cọc / chờ giao dịch')

            price = OrderService._quantize_money(Decimal(str(listing.price)))
            deposit_amount = OrderService._quantize_money(price * pct / Decimal('100'))
            remaining_amount = OrderService._quantize_money(price - deposit_amount)

            order = Order(
                listing_id=listing_id,
                buyer_id=buyer_id,
                seller_id=listing.seller_id,
                status='AWAITING_DEPOSIT',
                final_price=price,
                deposit_percent=pct,
                deposit_amount=deposit_amount,
                remaining_amount=remaining_amount,
                listing_was_verified=bool(getattr(listing, 'is_verified', False)),
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
    def pay_deposit(order_id: int, buyer_id: int):
        """Trừ ví người mua = cọc, tạm giữ escrow, tin chuyển RESERVED."""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.buyer_id != buyer_id:
                raise ValueError('Đơn không hợp lệ')
            if order.status != 'AWAITING_DEPOSIT':
                raise ValueError('Đơn không ở trạng thái chờ đặt cọc')

            deposit = OrderService._quantize_money(order.deposit_amount or Decimal('0'))
            if deposit <= 0:
                raise ValueError('Số cọc không hợp lệ')

            buyer = db.query(UserModel).filter(UserModel.user_id == buyer_id).first()
            if not buyer:
                raise ValueError('Không tìm thấy người mua')
            bal = buyer.balance or Decimal('0.00')
            if bal < deposit:
                raise ValueError('Số dư BikeCoin không đủ để đặt cọc')

            buyer.balance = bal - deposit
            tx = WalletTransaction(
                user_id=buyer_id,
                amount=-deposit,
                fiat_amount=deposit,
                currency='B',
                type='ORDER_DEPOSIT_HOLD',
                status='SUCCESS',
            )
            db.add(tx)
            db.flush()

            escrow = DepositEscrow(
                order_id=order_id,
                wallet_tx_id=tx.transaction_id,
                amount=deposit,
                status='HELD_BY_SYSTEM',
            )
            db.add(escrow)

            order.status = 'DEPOSIT_HELD'
            order.updated_at = datetime.utcnow()

            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            if listing:
                listing.status = 'RESERVED'

            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def cancel_by_buyer(order_id: int, buyer_id: int):
        """Hủy trước khi người bán xác nhận giao — hoàn cọc, tin AVAILABLE."""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.buyer_id != buyer_id:
                raise ValueError('Đơn không hợp lệ')
            if order.status != 'DEPOSIT_HELD':
                raise ValueError('Chỉ hủy được khi đã đặt cọc và chưa xác nhận giao xe')

            escrow = db.query(DepositEscrow).filter(DepositEscrow.order_id == order_id).first()
            if not escrow or escrow.status != 'HELD_BY_SYSTEM':
                raise ValueError('Không tìm thấy ký quỹ')

            buyer = db.query(UserModel).filter(UserModel.user_id == buyer_id).first()
            buyer.balance = (buyer.balance or Decimal('0.00')) + escrow.amount
            db.add(
                WalletTransaction(
                    user_id=buyer_id,
                    amount=escrow.amount,
                    fiat_amount=escrow.amount,
                    currency='B',
                    type='ORDER_DEPOSIT_REFUND',
                    status='SUCCESS',
                )
            )
            escrow.status = 'REFUNDED'
            order.status = 'CANCELLED_BY_BUYER'
            order.updated_at = datetime.utcnow()

            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            if listing:
                listing.status = 'AVAILABLE'

            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def seller_confirm_meeting_schedule(order_id: int, seller_id: int):
        """Người bán xác nhận đã hẹn lịch giao xe / gặp mặt với người mua."""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.seller_id != seller_id:
                raise ValueError('Đơn không hợp lệ')
            if order.status != 'DEPOSIT_HELD':
                raise ValueError('Chỉ xác nhận lịch khi đã giữ cọc và đang chờ giao dịch')
            if order.meeting_confirmed_at is not None:
                raise ValueError('Đã xác nhận lịch trước đó')

            order.meeting_confirmed_at = datetime.utcnow()
            order.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def buyer_confirm_received(order_id: int, buyer_id: int):
        """Người mua xác nhận đã nhận xe — chốt đơn thành công luôn (thanh toán phần còn lại ngoài hệ thống)."""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.buyer_id != buyer_id:
                raise ValueError('Đơn không hợp lệ')
            if order.status != 'DEPOSIT_HELD':
                raise ValueError('Trạng thái đơn không cho phép xác nhận')
            if order.meeting_confirmed_at is None:
                raise ValueError('Cần người bán xác nhận đã hẹn lịch giao dịch trước')

            escrow = db.query(DepositEscrow).filter(DepositEscrow.order_id == order_id).first()
            if not escrow or escrow.status != 'HELD_BY_SYSTEM':
                raise ValueError('Ký quỹ không hợp lệ')

            seller = db.query(UserModel).filter(UserModel.user_id == order.seller_id).first()
            if not seller:
                raise ValueError('Không tìm thấy người bán')

            # Chỉ giải phóng phần cọc cho người bán; phần còn lại hai bên giao dịch trực tiếp.
            seller.balance = (seller.balance or Decimal('0.00')) + escrow.amount
            db.add(
                WalletTransaction(
                    user_id=order.seller_id,
                    amount=escrow.amount,
                    fiat_amount=escrow.amount,
                    currency='B',
                    type='ORDER_DEPOSIT_RELEASE_TO_SELLER',
                    status='SUCCESS',
                )
            )

            escrow.status = 'RELEASED'
            order.status = 'COMPLETED'
            order.updated_at = datetime.utcnow()

            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            if listing:
                listing.status = 'SOLD'
                listing.is_hidden = True

            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def buyer_reject_vehicle(order_id: int, buyer_id: int, reason: str):
        """Người mua từ chối nhận xe — hoàn cọc, gắn lý do, tin chờ kiểm định lại."""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or order.buyer_id != buyer_id:
                raise ValueError('Đơn không hợp lệ')
            if order.status not in ('DEPOSIT_HELD', 'SELLER_CONFIRMED_HANDOVER'):
                raise ValueError('Chỉ từ chối khi đã đặt cọc và chưa hoàn tất thanh toán')
            if order.status == 'DEPOSIT_HELD' and order.meeting_confirmed_at is None:
                raise ValueError('Cần người bán xác nhận đã hẹn lịch giao dịch trước khi từ chối nhận xe')

            reason = (reason or '').strip()
            if len(reason) < 5:
                raise ValueError('Vui lòng mô tả lý do từ chối (ít nhất 5 ký tự)')

            escrow = db.query(DepositEscrow).filter(DepositEscrow.order_id == order_id).first()
            if not escrow or escrow.status != 'HELD_BY_SYSTEM':
                raise ValueError('Ký quỹ không hợp lệ')

            buyer = db.query(UserModel).filter(UserModel.user_id == buyer_id).first()
            buyer.balance = (buyer.balance or Decimal('0.00')) + escrow.amount
            db.add(
                WalletTransaction(
                    user_id=buyer_id,
                    amount=escrow.amount,
                    fiat_amount=escrow.amount,
                    currency='B',
                    type='ORDER_DEPOSIT_REFUND',
                    status='SUCCESS',
                )
            )
            escrow.status = 'REFUNDED'
            order.buyer_reject_reason = reason
            order.status = 'REJECTED_BY_BUYER'
            order.updated_at = datetime.utcnow()

            listing = db.query(Listing).filter(Listing.listing_id == order.listing_id).first()
            if listing:
                listing.status = 'AVAILABLE'
                listing.inspection_status = 'DISPUTE_REVIEW_PENDING'

            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def open_dispute(order_id: int, user_id: int, description: str, *, area=None, address=None):
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or user_id not in (order.buyer_id, order.seller_id):
                raise ValueError('Không có quyền báo cáo đơn này')
            if order.status not in ('DEPOSIT_HELD', 'SELLER_CONFIRMED_HANDOVER'):
                raise ValueError('Trạng thái đơn không áp dụng báo cáo')
            if order.status == 'DEPOSIT_HELD' and order.meeting_confirmed_at is None:
                raise ValueError('Cần người bán xác nhận đã hẹn lịch giao dịch trước khi mở tranh chấp')
            if order.status == 'DISPUTE_OPEN':
                raise ValueError('Đơn đang tranh chấp — vui lòng đợi xử lý')

            if not order.listing_was_verified:
                raise ValueError(
                    'Xe không qua kiểm định sàn — không hỗ trợ giải quyết tranh chấp qua hệ thống. '
                    'Bạn vẫn có thể liên hệ trực tiếp hoặc dùng kênh khác.'
                )

            desc = (description or '').strip()
            if len(desc) < 10:
                raise ValueError('Mô tả tranh chấp ít nhất 10 ký tự')

            d = OrderDispute(
                order_id=order_id,
                opened_by_user_id=user_id,
                description=desc,
                status='OPEN',
                dispute_area=area,
                dispute_address=address,
            )
            db.add(d)
            order.status = 'DISPUTE_OPEN'
            db.commit()
            db.refresh(d)
            return d
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def cancel_dispute(order_id: int, user_id: int):
        """Hủy phiếu tranh chấp bởi người đã tạo phiếu; trả đơn về chờ giao dịch."""
        db = SessionLocal()
        try:
            order = db.query(Order).filter(Order.order_id == order_id).first()
            if not order or user_id not in (order.buyer_id, order.seller_id):
                raise ValueError('Đơn không hợp lệ')
            dispute = db.query(OrderDispute).filter(OrderDispute.order_id == order_id).order_by(OrderDispute.dispute_id.desc()).first()
            if not dispute or dispute.status not in ('OPEN', 'ASSIGNED'):
                raise ValueError('Không có phiếu tranh chấp đang mở')
            if dispute.opened_by_user_id != user_id:
                raise ValueError('Chỉ người tạo phiếu mới có quyền hủy')

            dispute.status = 'CANCELLED'
            dispute.cancelled_at = datetime.utcnow()
            dispute.cancelled_by_user_id = user_id
            # Trả về trạng thái chờ giao dịch (sau đặt cọc).
            if order.status == 'DISPUTE_OPEN':
                order.status = 'DEPOSIT_HELD'
            db.commit()
            db.refresh(order)
            return order
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    # --- Legacy stubs (không dùng trong luồng mới) ---
    @staticmethod
    def create_order(listing_id, buyer_id, seller_id, final_price):
        raise NotImplementedError('Dùng create_purchase_order + pay_deposit')

    @staticmethod
    def deposit_process(order_id, buyer_id):
        return OrderService.pay_deposit(order_id, buyer_id)

    @staticmethod
    def payout_process(order_id, buyer_id):
        raise NotImplementedError('Luồng thanh toán nốt đã được bỏ: dùng buyer_confirm_received để chốt đơn')

    @staticmethod
    def refund_process(order_id, admin_id):
        raise NotImplementedError('Dùng cancel_by_buyer / buyer_reject_vehicle')
