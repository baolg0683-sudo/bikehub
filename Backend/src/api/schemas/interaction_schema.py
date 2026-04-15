from marshmallow import Schema, ValidationError, fields, validate, validates_schema

class MessageSchema(Schema):
    receiver_id = fields.Int(required=True)
    listing_id = fields.Int(required=True)
    content = fields.Str(required=False, allow_none=True)
    attachments = fields.List(fields.Str(), required=False, allow_none=True)

    @validates_schema
    def validate_message_payload(self, data, **kwargs):
        content = data.get("content") or ""
        attachments = data.get("attachments") or []
        if not content.strip() and not attachments:
            raise ValidationError(
                "Tin nhắn hoặc tệp đính kèm phải có ít nhất một mục.",
                field_name="content"
            )

class ReviewSchema(Schema):
    order_id = fields.Int(required=True)
    target_id = fields.Int(required=True)
    rating = fields.Int(required=True, validate=validate.Range(min=1, max=5))
    comment = fields.Str(allow_none=True)
