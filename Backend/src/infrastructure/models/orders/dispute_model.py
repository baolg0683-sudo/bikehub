from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Float
from datetime import datetime


class OrderDispute(Base):
    __tablename__ = 'order_disputes'
    __table_args__ = {'schema': 'orders'}

    dispute_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey('orders.orders.order_id'), nullable=False)
    opened_by_user_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(24), default='OPEN')
    inspector_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=True)
    resolution_note = Column(Text, nullable=True)
    dispute_area = Column(String(120), nullable=True)
    dispute_address = Column(Text, nullable=True)
    penalty_target = Column(String(16), nullable=True)  # BUYER | SELLER | BOTH
    penalty_actions = Column(String(128), nullable=True)  # CSV: LOCK_ACCOUNT,BAN_ACCOUNT,DEDUCT_REPUTATION
    penalty_ban_days = Column(Integer, nullable=True)
    penalty_ban_permanent = Column(Boolean, nullable=True)
    penalty_reputation_deduction = Column(Float, nullable=True)
    penalty_note = Column(Text, nullable=True)
    admin_penalty_applied_at = Column(DateTime, nullable=True)
    admin_penalty_applied_by = Column(Integer, ForeignKey('auth.users.user_id'), nullable=True)
    admin_penalty_note = Column(Text, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by_user_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
