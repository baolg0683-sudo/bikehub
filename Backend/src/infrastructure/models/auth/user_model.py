from sqlalchemy import Column, Integer, String, DateTime, Numeric, func
from infrastructure.databases import db

class UserModel(db.Model):
    __tablename__ = 'users'

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    phone = Column(String(20))
    role = Column(String(20), nullable=False)
    balance = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default='ACTIVE')
    created_at = Column(DateTime, default=func.now())
