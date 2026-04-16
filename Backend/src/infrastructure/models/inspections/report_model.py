from datetime import datetime
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, JSON, Numeric, Boolean
from infrastructure.databases import Base

class InspectionReport(Base):
    __tablename__ = 'reports'
    __table_args__ = {'schema': 'inspections'}

    report_id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey('listings.listings.listing_id'), nullable=False)
    inspector_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    technical_details = Column(JSON)
    overall_verdict = Column(Text)
    scheduled_at = Column(DateTime)
    fee_amount = Column(Numeric(10, 2), default=50000)
    is_passed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
