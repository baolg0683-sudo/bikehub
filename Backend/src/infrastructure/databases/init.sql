-----------------------------------------------------------
-- KHỞI TẠO CÁC KHÔNG GIAN DỊCH VỤ
-----------------------------------------------------------
CREATE SCHEMA auth;        -- Người dùng & Số dư ví
CREATE SCHEMA listings;    -- Tin đăng & Chi tiết xe
CREATE SCHEMA inspections; -- Báo cáo kiểm định
CREATE SCHEMA wallet;      -- Lịch sử Nạp/Rút/Dòng tiền
CREATE SCHEMA orders;      -- Đơn hàng & Ký quỹ (Escrow)
CREATE SCHEMA interactions;-- Chat & Đánh giá

-----------------------------------------------------------
-- 1. AUTH SERVICE
-----------------------------------------------------------
CREATE TABLE auth.users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20) UNIQUE NOT NULL,
    date_of_birth DATE,
    avatar_url TEXT,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'INSPECTOR', 'USER')),
    balance DECIMAL(15, 2) DEFAULT 0.00,
    reputation_score FLOAT DEFAULT 5.0,
    certificate_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-----------------------------------------------------------
-- 2. LISTING SERVICE
-----------------------------------------------------------
CREATE TABLE listings.listings (
    listing_id SERIAL PRIMARY KEY,
    seller_id INT REFERENCES auth.users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, AVAILABLE, RESERVED, SOLD, HIDDEN
    inspection_status VARCHAR(20) DEFAULT 'NONE', -- NONE, REQUESTED, SCHEDULED, PASSED, FAILED
    inspection_fee DECIMAL(10, 2) DEFAULT 50000,
    inspection_schedule TIMESTAMP,
    inspection_notes TEXT,
    assigned_inspector_id INT REFERENCES auth.users(user_id),
    is_hidden BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings.bicycles (
    bicycle_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings.listings(listing_id) ON DELETE CASCADE,
    brand VARCHAR(50),
    model VARCHAR(100),
    type VARCHAR(50), -- Road, MTB, Touring...
    frame_size VARCHAR(20),
    frame_material VARCHAR(50),
    wheel_size VARCHAR(50),
    brake_type VARCHAR(50),
    color VARCHAR(50),
    manufacture_year INT,
    groupset VARCHAR(100),
    condition_percent INT CHECK (condition_percent BETWEEN 0 AND 100),
    mileage_km INT,
    serial_number VARCHAR(100),
    primary_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE listings.media (
    media_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings.listings(listing_id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    media_type VARCHAR(10) DEFAULT 'IMAGE', -- 'IMAGE', 'VIDEO'
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-----------------------------------------------------------
-- 3. WALLET SERVICE (Nạp/Rút & Biến động số dư)
-----------------------------------------------------------
CREATE TABLE wallet.transactions (
    transaction_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES auth.users(user_id),
    amount DECIMAL(15, 2) NOT NULL,
    fiat_amount DECIMAL(15, 2) DEFAULT 0.00,
    currency VARCHAR(5) DEFAULT 'B',
    -- TOPUP: Nạp, WITHDRAW: Rút, HOLD: Giam cọc, RELEASE: Trả tiền cho người bán, REFUND: Hoàn cọc
    type VARCHAR(20) NOT NULL, 
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, SUCCESS
    
    -- Dữ liệu cho Admin đối soát chuyển khoản
    bank_info JSONB, -- {bank_name, account_number, account_holder}
    evidence_url TEXT, -- Link ảnh bill chuyển khoản
    admin_note TEXT,
    processed_by INT REFERENCES auth.users(user_id), -- Admin xử lý lệnh
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-----------------------------------------------------------
-- 4. ORDER & ESCROW SERVICE (Giao dịch trung gian)
-----------------------------------------------------------
CREATE TABLE orders.orders (
    order_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings.listings(listing_id),
    buyer_id INT REFERENCES auth.users(user_id),
    seller_id INT REFERENCES auth.users(user_id),
    status VARCHAR(20) DEFAULT 'WAITING_FOR_DEPOSIT', -- WAITING, PAID_DEPOSIT, COMPLETED, CANCELLED
    final_price DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng ký quỹ: Nơi tiền "tạm trú" khi chưa hoàn tất đơn hàng
CREATE TABLE orders.deposit_escrow (
    escrow_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders.orders(order_id) ON DELETE CASCADE,
    wallet_tx_id INT REFERENCES wallet.transactions(transaction_id), -- Link tới lệnh 'HOLD' trong ví
    amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'HELD_BY_SYSTEM', -- HELD_BY_SYSTEM, RELEASED, REFUNDED
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-----------------------------------------------------------
-- 5. INSPECTION & INTERACTION
-----------------------------------------------------------
CREATE TABLE inspections.reports (
    report_id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings.listings(listing_id),
    inspector_id INT REFERENCES auth.users(user_id),
    technical_details JSONB, -- Lưu chi tiết kỹ thuật khung, phanh...
    condition_percent INT CHECK (condition_percent BETWEEN 0 AND 100),
    overall_verdict TEXT,
    scheduled_at TIMESTAMP,
    fee_amount DECIMAL(10, 2) DEFAULT 50000,
    is_passed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interactions.messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES auth.users(user_id),
    receiver_id INT REFERENCES auth.users(user_id),
    listing_id INT REFERENCES listings.listings(listing_id),
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interactions.reviews (
    review_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders.orders(order_id),
    reviewer_id INT REFERENCES auth.users(user_id),
    target_id INT REFERENCES auth.users(user_id),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);