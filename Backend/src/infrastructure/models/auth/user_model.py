from sqlalchemy import Column, Integer, String, DateTime, Float, Date, Text, Numeric, func
from infrastructure.databases import db

class UserModel(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'auth'}

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column('password', String(255), nullable=False)
    full_name = Column(String(100))
    phone = Column(String(20), unique=True, nullable=False)
    date_of_birth = Column(Date)
    avatar_url = Column(Text)
    role = Column(String(20), nullable=False)
    balance = Column(Numeric(15, 2), default=0.00)
    reputation_score = Column(Float, default=5.0)
    certificate_id = Column(String(50))
    status = Column(String(20), default='ACTIVE')
    created_at = Column(DateTime, default=func.now())
