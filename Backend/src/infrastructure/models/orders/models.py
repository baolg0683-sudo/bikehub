from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from datetime import datetime

class Order(Base):
    __tablename__ = 'orders'
    __table_args__ = {'schema': 'orders'}

    order_id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey('listings.listings.listing_id'), nullable=False)
    buyer_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    seller_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    status = Column(String(20), default='WAITING_FOR_DEPOSIT')
    final_price = Column(Numeric(15, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DepositEscrow(Base):
    __tablename__ = 'deposit_escrow'
    __table_args__ = {'schema': 'orders'}

    escrow_id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey('orders.orders.order_id'), nullable=False)
    wallet_tx_id = Column(Integer, ForeignKey('wallet.transactions.transaction_id'), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    status = Column(String(20), default='HELD_BY_SYSTEM')
    updated_at = Column(DateTime, default=datetime.utcnow)