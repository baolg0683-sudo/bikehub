from dataclasses import asdict
from sqlalchemy import func
from domain.models.message import Message
from domain.models.review import Review
from infrastructure.models.interactions.message_model import MessageModel
from infrastructure.models.interactions.review_model import ReviewModel

class MessageRepository:
    def __init__(self, session):
        self.session = session
    
    def create(self, msg: Message):
        model = MessageModel(**asdict(msg))
        self.session.add(model)
        self.session.commit()
        msg.message_id = model.message_id
        return msg

class ReviewRepository:
    def __init__(self, session):
        self.session = session
    
    def create(self, review: Review):
        model = ReviewModel(**asdict(review))
        self.session.add(model)
        self.session.commit()
        review.review_id = model.review_id
        return review
    
    def avg_score(self, target_id):
        """Get average rating - FIX: use 'rating' not 'rating_score'"""
        return self.session.query(
            func.avg(ReviewModel.rating)
        ).filter_by(target_id=target_id).scalar() or 0