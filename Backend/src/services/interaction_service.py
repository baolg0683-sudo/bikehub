class InteractionService:
    def send_message(self, sender, data):
        msg = Message(sender_id=sender["user_id"], **data)
        return self.msg_repo.create(msg)

    def create_review(self, reviewer, data):
        review = Review(reviewer_id=reviewer["user_id"], **data)
        saved  = self.review_repo.create(review)
        avg    = self.review_repo.avg_score(data["target_id"])
        self.user_repo.update_reputation(data["target_id"], avg)
        return saved