from marshmallow import Schema, fields, validate

class MessageSchema(Schema):
    receiver_id = fields.Int(required=True)
    listing_id  = fields.Int(required=True)
    content     = fields.Str(required=True)

class ReviewSchema(Schema):
    order_id    = fields.Int(required=True)
    target_id   = fields.Int(required=True)
    rating      = fields.Int(required=True, validate=validate.Range(min=1, max=5))
    comment     = fields.Str(allow_none=True)
