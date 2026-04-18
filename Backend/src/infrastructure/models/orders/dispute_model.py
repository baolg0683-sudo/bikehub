from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
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
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
