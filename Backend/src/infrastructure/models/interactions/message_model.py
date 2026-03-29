from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class MessageModel(Base):
    __tablename__ = "messages"
    __table_args__ = {"schema": "interactions"}
    
    message_id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("auth.users.user_id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("auth.users.user_id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.listings.listing_id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
