from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from contextlib import asynccontextmanager
from infrastructure.databases import init_db
from config import Config
from dotenv import load_dotenv
from services.order_service import OrderService
from sqlalchemy import text

load_dotenv(dotenv_path='../.env')

# Pydantic models for request/response
class OrderCreate(BaseModel):
    listing_id: int
    buyer_id: int
    seller_id: int
    final_price: float

class OrderResponse(BaseModel):
    order_id: int
    listing_id: int
    buyer_id: int
    seller_id: int
    final_price: str
    status: str
    created_at: str

class DepositRequest(BaseModel):
    buyer_id: int

class RefundRequest(BaseModel):
    admin_id: int

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown (if needed)

# Create FastAPI app
app = FastAPI(
    title="BikeHub Backend API",
    description="Order & Escrow Management API",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/", response_class=HTMLResponse)
async def home():
    return """
<!DOCTYPE html>
<html>
<head>
    <title>BikeHub Backend API - FastAPI</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; text-align: center; }
        .api-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .endpoint { background: #ecf0f1; padding: 10px; margin: 5px 0; border-radius: 3px; font-family: monospace; }
        .status { color: #27ae60; font-weight: bold; }
        .fastapi-badge { background: #009688; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
        .test-btn { background: #3498db; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin: 5px; }
        .test-btn:hover { background: #2980b9; }
        .result { margin-top: 15px; padding: 10px; background: #ecf0f1; border-radius: 3px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 BikeHub Backend API <span class="fastapi-badge">FastAPI</span></h1>
        <p class="status">✅ Server is running on port 5003</p>

        <div class="api-section">
            <h3>API Test Section</h3>
            <button class="test-btn" onclick="testDB()">Test Database</button>
            <button class="test-btn" onclick="testOrdersAPI()">Test Orders API</button>
            <div id="db-result" class="result" style="display:none;"></div>
            <div id="api-result" class="result" style="display:none;"></div>
        </div>

        <div class="api-section">
            <h3>Available API Endpoints:</h3>
            <div class="endpoint">GET /api/orders - Get all orders</div>
            <div class="endpoint">POST /api/orders - Create new order</div>
            <div class="endpoint">POST /api/orders/{id}/deposit - Deposit for order</div>
            <div class="endpoint">POST /api/orders/{id}/payout - Payout for order</div>
            <div class="endpoint">POST /api/orders/{id}/refund - Refund for order</div>
        </div>

        <div class="api-section">
            <h3>Interactive API Documentation:</h3>
            <div class="endpoint"><a href="/docs">📖 Swagger UI - /docs</a></div>
            <div class="endpoint"><a href="/redoc">📋 ReDoc - /redoc</a></div>
        </div>
    </div>

    <script>
        async function testDB() {
            const resultDiv = document.getElementById('db-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = 'Testing database connection...';

            try {
                const response = await fetch('/db_test');
                const data = await response.json();
                resultDiv.innerHTML = `✅ Database Connected\\n📊 Result: ${JSON.stringify(data, null, 2)}`;
            } catch (error) {
                resultDiv.innerHTML = `❌ Error: ${error.message}`;
            }
        }

        async function testOrdersAPI() {
            const resultDiv = document.getElementById('api-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = 'Running Orders API tests...';

            let output = 'Orders API Test Results:\\n\\n';

            try {
                // Test GET orders
                const getResponse = await fetch('/api/orders');
                const orders = await getResponse.json();
                output += `✅ GET /api/orders: ${getResponse.status} - ${orders.length} orders found\\n`;

                // Test POST create order
                const orderData = {
                    listing_id: 1,
                    buyer_id: 1,
                    seller_id: 2,
                    final_price: 3500.00
                };

                const postResponse = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(orderData)
                });

                if (postResponse.status === 200) {
                    const result = await postResponse.json();
                    const orderId = result.order_id;
                    output += `✅ POST /api/orders: Created order ID ${orderId}\\n`;

                    // Test deposit
                    const depositResponse = await fetch(`/api/orders/${orderId}/deposit`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({buyer_id: 1})
                    });
                    output += `✅ Deposit Order ${orderId}: ${depositResponse.status}\\n`;

                    // Test payout
                    const payoutResponse = await fetch(`/api/orders/${orderId}/payout`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({buyer_id: 1})
                    });
                    output += `✅ Payout Order ${orderId}: ${payoutResponse.status}\\n`;

                } else {
                    output += `❌ POST /api/orders: ${postResponse.status}\\n`;
                }

            } catch (error) {
                output += `❌ Error: ${error.message}\\n`;
            }

            resultDiv.innerHTML = output;
        }
    </script>
</body>
</html>
    """

@app.get("/db_test")
async def db_test():
    try:
        # Test database connection
        from infrastructure.databases import SessionLocal
        db = SessionLocal()
        result = db.execute(text("SELECT 1 as test"))
        db.close()
        return {"status": "success", "message": "Database connection successful", "test_result": result.fetchone()[0]}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/orders", response_model=List[OrderResponse])
async def get_orders():
    try:
        orders = OrderService.get_all_orders()
        return [{
            'order_id': order.order_id,
            'listing_id': order.listing_id,
            'buyer_id': order.buyer_id,
            'seller_id': order.seller_id,
            'final_price': str(order.final_price),
            'status': order.status,
            'created_at': order.created_at.isoformat()
        } for order in orders]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate):
    try:
        new_order = OrderService.create_order(
            listing_id=order.listing_id,
            buyer_id=order.buyer_id,
            seller_id=order.seller_id,
            final_price=order.final_price
        )
        return {
            'order_id': new_order.order_id,
            'listing_id': new_order.listing_id,
            'buyer_id': new_order.buyer_id,
            'seller_id': new_order.seller_id,
            'final_price': str(new_order.final_price),
            'status': new_order.status,
            'created_at': new_order.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/orders/{order_id}/deposit")
async def deposit(order_id: int, request: DepositRequest):
    try:
        order = OrderService.deposit_process(order_id, request.buyer_id)
        return {
            'order_id': order.order_id,
            'status': order.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/orders/{order_id}/payout")
async def payout(order_id: int, request: DepositRequest):
    try:
        order = OrderService.payout_process(order_id, request.buyer_id)
        return {
            'order_id': order.order_id,
            'status': order.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/orders/{order_id}/refund")
async def refund(order_id: int, request: RefundRequest):
    try:
        order = OrderService.refund_process(order_id, request.admin_id)
        return {
            'order_id': order.order_id,
            'status': order.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5003)
    app.run(host='0.0.0.0', port=5000, debug=True)