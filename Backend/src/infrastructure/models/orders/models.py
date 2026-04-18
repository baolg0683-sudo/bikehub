from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Boolean
from datetime import datetime

class Order(Base):
    __tablename__ = 'orders'
    __table_args__ = {'schema': 'orders'}

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    listing_id = Column(Integer, ForeignKey('listings.listings.listing_id'), nullable=False)
    buyer_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    seller_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    status = Column(String(40), default='AWAITING_DEPOSIT')
    final_price = Column(Numeric(15, 2), nullable=True)
    deposit_percent = Column(Numeric(5, 2), nullable=True)
    deposit_amount = Column(Numeric(15, 2), nullable=True)
    remaining_amount = Column(Numeric(15, 2), nullable=True)
    buyer_reject_reason = Column(Text, nullable=True)
    listing_was_verified = Column(Boolean, default=False)
    meeting_confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DepositEscrow(Base):
    __tablename__ = 'deposit_escrow'
    __table_args__ = {'schema': 'orders'}

    escrow_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.orders.order_id'), nullable=False)
    wallet_tx_id = Column(Integer, ForeignKey('wallet.transactions.transaction_id'), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(20), default='HELD_BY_SYSTEM')
    updated_at = Column(DateTime, default=datetime.utcnow)