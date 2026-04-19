from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from infrastructure.databases import Base


class UserReport(Base):
    """Báo cáo từ người dùng — dùng chung cho cả listing và conversation"""
    __tablename__ = 'user_reports'
    __table_args__ = (
        # Mỗi user chỉ báo cáo 1 lần cho mỗi target
        UniqueConstraint('reporter_id', 'target_type', 'target_id', name='uq_user_report'),
        {'schema': 'auth'},
    )

    report_id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(Integer, ForeignKey('auth.users.user_id'), nullable=False)
    # target_type: 'listing' | 'conversation'
    target_type = Column(String(20), nullable=False)
    # target_id: listing_id hoặc peer_id (conversation dùng composite key nên lưu dạng string)
    target_id = Column(String(100), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default='PENDING')  # PENDING | REVIEWED | DISMISSED
    created_at = Column(DateTime, default=datetime.utcnow)
