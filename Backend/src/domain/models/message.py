from dataclasses import dataclass
from typing import List, Optional

@dataclass
class Message:
    sender_id: int
    receiver_id: int
    listing_id: int
    content: str
    attachments: Optional[List[str]] = None
    message_id: int = None
