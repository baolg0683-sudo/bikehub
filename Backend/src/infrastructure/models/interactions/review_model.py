from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class ReviewModel(Base):
    __tablename__ = "reviews"
    __table_args__ = {"schema": "interactions"}
    
    review_id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.orders.order_id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("auth.users.user_id"), nullable=False)
    target_id = Column(Integer, ForeignKey("auth.users.user_id"), nullable=False)
    rating = Column(Integer)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
