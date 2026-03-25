-- Khởi tạo các không gian riêng cho từng service
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS listings;
CREATE SCHEMA IF NOT EXISTS inspections;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS interactions;

-----------------------------------------------------------
-- 1. AUTH SERVICE (Quản lý User, Role, Profile)
-----------------------------------------------------------
CREATE TABLE auth.users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL, -- 'ADMIN', 'SELLER', 'BUYER', 'INSPECTOR'
    reputation_score FLOAT DEFAULT 5.0, 
    certificate_id VARCHAR(50),        
    status VARCHAR(20) DEFAULT 'ACTIVE', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-----------------------------------------------------------
-- 2. LISTING SERVICE (Quản lý Tin đăng & Xe)
-----------------------------------------------------------
CREATE TABLE listings.listings (
    listing_id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL, 
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, AVAILABLE, RESERVED, SOLD 
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings.bicycles (
    bicycle_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings.listings(listing_id) ON DELETE CASCADE,
    brand VARCHAR(50),
    type VARCHAR(50),
    frame_size VARCHAR(20),
    groupset VARCHAR(100),
    condition_percent INT,
    serial_number VARCHAR(100)
);

-- lưu media (Ảnh/Video) 
CREATE TABLE listings.media (
    media_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings.listings(listing_id),
    url TEXT NOT NULL,
    type VARCHAR(10) -- 'IMAGE', 'VIDEO'
);

-----------------------------------------------------------
-- 3. INSPECTION SERVICE (Quản lý Kiểm định)
-----------------------------------------------------------
CREATE TABLE inspections.reports (
    report_id SERIAL PRIMARY KEY,
    listing_id INT NOT NULL,    
    inspector_id INT NOT NULL,  
    frame_status TEXT,          
    drivetrain_status TEXT,
    brake_status TEXT,
    overall_verdict TEXT,
    report_url TEXT,            
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-----------------------------------------------------------
-- 4. ORDER SERVICE (Quản lý Đơn hàng & Tiền cọc)
-----------------------------------------------------------
CREATE TABLE orders.orders (
    order_id SERIAL PRIMARY KEY,
    listing_id INT NOT NULL,
    buyer_id INT NOT NULL,
    seller_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING_PAYMENT', -- PENDING_PAYMENT, COMPLETED, CANCELLED
    final_price DECIMAL(15, 2)
);

CREATE TABLE orders.deposit_escrow (
    escrow_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders.orders(order_id),
    amount DECIMAL(15, 2) NOT NULL,
    payment_status VARCHAR(20), -- 'HELD_BY_SYSTEM', 'RELEASED', 'REFUNDED'  
    transaction_ref VARCHAR(100), -- Mã giao dịch thanh toán thực tế
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-----------------------------------------------------------
-- 5. INTERACTION SERVICE (Chat & Review)
-----------------------------------------------------------
CREATE TABLE interactions.messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    listing_id INT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE interactions.reviews (
    review_id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    target_id INT NOT NULL, 
    rating_score INT CHECK (rating_score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);