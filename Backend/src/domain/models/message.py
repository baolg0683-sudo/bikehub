from dataclasses import dataclass

@dataclass
class Message:
    sender_id: int
    receiver_id: int
    listing_id: int
    content: str
    message_id: int = None
