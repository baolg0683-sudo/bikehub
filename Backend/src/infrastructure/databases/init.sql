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
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'USER', 'INSPECTOR')),
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
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INT REFERENCES auth.users(user_id),
    verified_at TIMESTAMP,
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
    overall_verdict TEXT,
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

CREATE TABLE interactions.wishlists (
    wishlist_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES auth.users(user_id) ON DELETE CASCADE,
    listing_id INT REFERENCES listings.listings(listing_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, listing_id)
);

-----------------------------------------------------------
-- SEED DATA FOR ADMIN, INSPECTOR, VERIFIED LISTING, AND WISHLIST
-----------------------------------------------------------
INSERT INTO auth.users (email, password, full_name, phone, date_of_birth, role, reputation_score, certificate_id, status)
VALUES
    ('admin@bikehub.local', '$2b$12$g0EwgQ9AND/K1Yp9rHleAecBImAmcpA9Xjc.88kyh2AFii6pnQ7Fu', 'Quản trị viên', '+84000000001', '1990-01-01', 'ADMIN', 5.0, 'ADMIN-0001', 'ACTIVE'),
    ('inspector@bikehub.local', '$2b$12$Ipfv0OQrUvK/OFoHLsQnYuwMrNccOuJZJDFV/SkYaHN2E30CCzbvu', 'Người kiểm định', '+84000000002', '1991-01-01', 'INSPECTOR', 5.0, 'INSPECT-0001', 'ACTIVE'),
    ('user@bikehub.local', '$2b$12$YSiap6KDF6jWLW3YxTF7g.UPy./gZPx5qSjFwpJBp2jbU5y1ciwli', 'Người dùng thử', '+84000000003', '1995-05-05', 'USER', 5.0, NULL, 'ACTIVE');

-- Create one verified listing with inspection metadata and wishlist entry
INSERT INTO listings.listings (seller_id, title, description, price, status, is_verified, verified_by, verified_at)
VALUES
    (3, 'Xe đạp đua kiểm định', 'Xe đạp đua đã qua kiểm định chất lượng, phù hợp đua trường.', 12500000.00, 'AVAILABLE', TRUE, 2, CURRENT_TIMESTAMP);

INSERT INTO listings.bicycles (listing_id, brand, model, type, frame_size, frame_material, wheel_size, brake_type, color, manufacture_year, groupset, condition_percent, mileage_km, serial_number, primary_image_url)
VALUES
    (1, 'Giant', 'TCR Advanced', 'Road', '54cm', 'Carbon', '700C', 'Disc', 'Đen', 2020, 'Shimano Ultegra', 92, 1200, 'GT-2020-001', '/assets/bike.png');

INSERT INTO inspections.reports (listing_id, inspector_id, technical_details, overall_verdict, is_passed)
VALUES
    (1, 2, '{"frame": "Carbon nguyên khối", "brakes": "Đĩa thủy lực", "wheels": "700C alloy", "condition_percent": 92}', 'Kiểm định xong: xe đạt yêu cầu vận hành tốt và an toàn.', TRUE);

INSERT INTO interactions.wishlists (user_id, listing_id)
VALUES
    (3, 1);
