from dataclasses import asdict
from datetime import datetime
from message import Message
from review import Review

class InteractionService:
    def __init__(self, msg_repo, review_repo):
        self.msg_repo = msg_repo
        self.review_repo = review_repo
    
    def send_message(self, sender, data):
        """Create and save a message"""
        msg = Message(
            sender_id=sender.user_id,
            receiver_id=data['receiver_id'],
            listing_id=data['listing_id'],
            content=data['content']
        )
        return self.msg_repo.create(msg)
    
    def create_review(self, reviewer, data):
        """Create and save a review"""
        review = Review(
            order_id=data['order_id'],
            reviewer_id=reviewer.user_id,
            target_id=data['target_id'],
            rating=data['rating'],
            comment=data.get('comment', '')
        )
        return self.review_repo.create(review)
    
    def get_user_rating(self, user_id):
        """Get average rating of a user"""
        return self.review_repo.avg_score(user_id)

interaction_service = InteractionService(None, None)