from flask import Blueprint, request, jsonify
from services.order_service import OrderService
from infrastructure.databases import db

order_bp = Blueprint('order', __name__)

@order_bp.route('/orders', methods=['GET'])
def get_orders():
    try:
        orders = OrderService.get_all_orders()
        return jsonify([{
            'order_id': order.order_id,
            'listing_id': order.listing_id,
            'buyer_id': order.buyer_id,
            'seller_id': order.seller_id,
            'final_price': str(order.final_price),
            'status': order.status,
            'created_at': order.created_at.isoformat()
        } for order in orders]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    try:
        order = OrderService.create_order(
            listing_id=data['listing_id'],
            buyer_id=data['buyer_id'],
            seller_id=data['seller_id'],
            final_price=data['final_price']
        )
        return jsonify({'order_id': order.order_id, 'status': order.status}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@order_bp.route('/orders/<int:order_id>/deposit', methods=['POST'])
def deposit(order_id):
    data = request.get_json()
    buyer_id = data.get('buyer_id')
    try:
        order = OrderService.deposit_process(order_id, buyer_id)
        return jsonify({'order_id': order.order_id, 'status': order.status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@order_bp.route('/orders/<int:order_id>/payout', methods=['POST'])
def payout(order_id):
    data = request.get_json()
    buyer_id = data.get('buyer_id')
    try:
        order = OrderService.payout_process(order_id, buyer_id)
        return jsonify({'order_id': order.order_id, 'status': order.status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@order_bp.route('/orders/<int:order_id>/refund', methods=['POST'])
def refund(order_id):
    data = request.get_json()
    admin_id = data.get('admin_id')
    try:
        order = OrderService.refund_process(order_id, admin_id)
        return jsonify({'order_id': order.order_id, 'status': order.status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400