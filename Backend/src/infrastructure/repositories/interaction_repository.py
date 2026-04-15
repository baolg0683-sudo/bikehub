from dataclasses import asdict
from sqlalchemy import func, or_
from domain.models.message import Message
from domain.models.review import Review
from infrastructure.models.interactions.message_model import MessageModel
from infrastructure.models.interactions.review_model import ReviewModel
from infrastructure.models.sell.models import Listing
from infrastructure.models.auth.user_model import UserModel

class MessageRepository:
    def __init__(self, session):
        self.session = session
    
    def create(self, msg: Message):
        model = MessageModel(**asdict(msg))
        self.session.add(model)
        try:
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise
        msg.message_id = model.message_id
        return msg

    def get_conversation(self, user_id, listing_id, peer_id=None):
        query = self.session.query(MessageModel).filter(
            MessageModel.listing_id == listing_id,
            or_(MessageModel.sender_id == user_id, MessageModel.receiver_id == user_id),
        )
        if peer_id:
            query = query.filter(
                or_(MessageModel.sender_id == peer_id, MessageModel.receiver_id == peer_id)
            )
        records = query.order_by(MessageModel.message_id.asc()).all()
        return [
            {
                'message_id': record.message_id,
                'sender_id': record.sender_id,
                'receiver_id': record.receiver_id,
                'listing_id': record.listing_id,
                'content': record.content,
                'attachments': record.attachments or [],
                'created_at': record.created_at.isoformat() if record.created_at else None,
                'from_me': record.sender_id == user_id,
            }
            for record in records
        ]

    def get_conversation_list(self, user_id):
        messages = self.session.query(MessageModel).filter(
            or_(MessageModel.sender_id == user_id, MessageModel.receiver_id == user_id)
        ).order_by(MessageModel.created_at.desc()).all()

        conversation_map = {}
        for message in messages:
            peer_id = message.receiver_id if message.sender_id == user_id else message.sender_id
            key = (message.listing_id, peer_id)
            if key not in conversation_map:
                conversation_map[key] = {
                    'listing_id': message.listing_id,
                    'peer_id': peer_id,
                    'last_message': message.content,
                    'last_at': message.created_at.isoformat() if message.created_at else None,
                }

        if not conversation_map:
            return []

        listing_ids = [entry['listing_id'] for entry in conversation_map.values()]
        peer_ids = [entry['peer_id'] for entry in conversation_map.values()]

        listings = {
            row.listing_id: row.title
            for row in self.session.query(Listing.listing_id, Listing.title).filter(Listing.listing_id.in_(listing_ids)).all()
        }
        peers = {
            row.user_id: row.full_name or f"Người dùng #{row.user_id}"
            for row in self.session.query(UserModel.user_id, UserModel.full_name).filter(UserModel.user_id.in_(peer_ids)).all()
        }

        results = []
        for entry in conversation_map.values():
            results.append({
                'listing_id': entry['listing_id'],
                'peer_id': entry['peer_id'],
                'peer_name': peers.get(entry['peer_id'], f"Người dùng #{entry['peer_id']}"),
                'listing_title': listings.get(entry['listing_id'], f"Tin đăng #{entry['listing_id']}"),
                'last_message': entry['last_message'],
                'last_at': entry['last_at'],
            })

        return sorted(results, key=lambda item: item['last_at'] or "", reverse=True)

    def delete_message(self, user_id, message_id):
        message = self.session.query(MessageModel).filter(MessageModel.message_id == message_id).first()
        if not message:
            raise Exception("Tin nhắn không tồn tại.")
        if message.sender_id != user_id and message.receiver_id != user_id:
            raise Exception("Bạn không có quyền xóa tin nhắn này.")

        self.session.delete(message)
        self.session.commit()
        return True

    def delete_conversation(self, user_id, listing_id, peer_id):
        deleted = self.session.query(MessageModel).filter(
            MessageModel.listing_id == listing_id,
            or_(MessageModel.sender_id == user_id, MessageModel.receiver_id == user_id),
            or_(MessageModel.sender_id == peer_id, MessageModel.receiver_id == peer_id)
        ).delete(synchronize_session=False)
        self.session.commit()
        return deleted

    def report_conversation(self, user_id, payload):
        return {
            'reported_by': user_id,
            'listing_id': payload.get('listing_id'),
            'peer_id': payload.get('peer_id'),
            'reason': payload.get('reason', 'Báo cáo từ người dùng'),
        }

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