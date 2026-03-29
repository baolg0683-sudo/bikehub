from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, JSON, ForeignKey
from datetime import datetime

class WalletTransaction(Base):
    __tablename__ = 'transactions'
    __table_args__ = {'schema': 'wallet'}

    transaction_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    type = Column(String(20), nullable=False)
    status = Column(String(20), default='PENDING')
    bank_info = Column(JSON)
    evidence_url = Column(Text)
    admin_note = Column(Text)
    processed_by = Column(Integer, ForeignKey('auth.users.user_id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)