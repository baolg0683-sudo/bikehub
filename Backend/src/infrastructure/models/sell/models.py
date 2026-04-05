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


class ListingImage(Base):
    __tablename__ = 'listing_images'
    __table_args__ = {'schema': 'listings'}

    image_id = Column(Integer, primary_key=True)
    # Use a plain integer FK reference here to avoid DDL ordering/schema issues
    # with different database backends (SQLite vs Postgres). Referential
    # integrity is maintained at the application level when necessary.
    listing_id = Column(Integer, nullable=False)
    url = Column(Text, nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)