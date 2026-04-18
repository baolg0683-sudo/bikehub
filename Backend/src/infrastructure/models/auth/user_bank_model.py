from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from datetime import datetime

class UserBankInfo(Base):
    __tablename__ = 'user_bank_info'
    __table_args__ = {'schema': 'auth'}

    bank_info_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False, unique=True)
    bank_name = Column(String(100), nullable=False)
    account_number = Column(String(20), nullable=False)
    account_holder = Column(String(100), nullable=False)
    status = Column(String(20), default='PENDING')  # PENDING, VERIFIED, REJECTED
    admin_note = Column(String(500))
    verified_by = Column(Integer, ForeignKey('auth.users.user_id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime)
