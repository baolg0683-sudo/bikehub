from infrastructure.databases import Base
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, Boolean, ForeignKey
from datetime import datetime

class Listing(Base):
    __tablename__ = 'listings'
    __table_args__ = {'schema': 'listings'}

    listing_id = Column(Integer, primary_key=True)
    seller_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Numeric(15, 2), nullable=False)
    status = Column(String(20), default='PENDING')
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Media(Base):
    __tablename__ = 'media'
    __table_args__ = {'schema': 'listings'}

    media_id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, nullable=False)
    url = Column(Text, nullable=False)
    media_type = Column(String(10), default='IMAGE')
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Bicycle(Base):
    __tablename__ = 'bicycles'
    __table_args__ = {'schema': 'listings'}

    bicycle_id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, nullable=False)
    brand = Column(String(50))
    model = Column(String(100))
    type = Column(String(50))
    frame_size = Column(String(20))
    frame_material = Column(String(50))
    wheel_size = Column(String(50))
    brake_type = Column(String(50))
    color = Column(String(50))
    manufacture_year = Column(Integer)
    groupset = Column(String(100))
    condition_percent = Column(Integer)
    mileage_km = Column(Integer)
    serial_number = Column(String(100))
    primary_image_url = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)