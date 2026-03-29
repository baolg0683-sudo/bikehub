@dataclass
class Review:
    order_id:    int
    reviewer_id: int
    target_id:   int
    rating:      int    
    comment:     str = ""
    review_id:   int = None