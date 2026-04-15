from dataclasses import asdict
from domain.models.message import Message
from domain.models.review import Review
from infrastructure.models.auth.user_model import UserModel
from infrastructure.models.sell.models import Listing

class InteractionService:
    def __init__(self, msg_repo, review_repo):
        self.msg_repo = msg_repo
        self.review_repo = review_repo
    
    def send_message(self, sender, data):
        """Create and save a message"""
        session = self.msg_repo.session
        if not session.query(UserModel).filter(UserModel.user_id == data['receiver_id']).first():
            raise ValueError("Người nhận không tồn tại.")
        if not session.query(Listing).filter(Listing.listing_id == data['listing_id']).first():
            raise ValueError("Tin đăng không tồn tại.")

        msg = Message(
            sender_id=sender['user_id'],
            receiver_id=data['receiver_id'],
            listing_id=data['listing_id'],
            content=data['content'],
            attachments=data.get('attachments') or []
        )
        return self.msg_repo.create(msg)
    
    def create_review(self, reviewer, data):
        """Create and save a review"""
        review = Review(
            order_id=data['order_id'],
            reviewer_id=reviewer['user_id'],
            target_id=data['target_id'],
            rating=data['rating'],
            comment=data.get('comment', '')
        )
        return self.review_repo.create(review)

    def get_conversation(self, user, listing_id, peer_id=None):
        """Get conversation messages for a listing involving the current user"""
        return self.msg_repo.get_conversation(user['user_id'], listing_id, peer_id)

    def get_conversation_list(self, user):
        """Get conversation summaries for the current user"""
        return self.msg_repo.get_conversation_list(user['user_id'])

    def delete_message(self, user, message_id):
        return self.msg_repo.delete_message(user['user_id'], message_id)

    def delete_conversation(self, user, listing_id, peer_id):
        return self.msg_repo.delete_conversation(user['user_id'], listing_id, peer_id)

    def report_conversation(self, user, payload):
        return self.msg_repo.report_conversation(user['user_id'], payload)
    
    def get_user_rating(self, user_id):
        """Get average rating of a user"""
        return self.review_repo.avg_score(user_id)
