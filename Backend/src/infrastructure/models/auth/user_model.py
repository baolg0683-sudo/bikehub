from sqlalchemy import Column, Integer, String, DateTime, Numeric, func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class UserModel(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'auth'}

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    phone = Column(String(20))
    role = Column(String(20), nullable=False)
    balance = Column(Numeric(15, 2), default=0.00)
    status = Column(String(20), default='ACTIVE')
    created_at = Column(DateTime, default=func.now())