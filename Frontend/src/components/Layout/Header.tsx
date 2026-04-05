import React from "react";
import Link from "next/link";

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="header">
      <div className="header-container">
        {/* Cửa hàng Logo */}
        <div className="header-logo">
          <div className="logo-icon">
            <img src="/assets/favicon.ico" width={24} height={24} alt="logo" />
            <span>BikeMarket</span>
          </div>
        </div> {/* Thêm thẻ đóng cho header-logo */}

        {/* Menu điều hướng */}
        <nav className="header-nav">
          <Link href="/" className="nav-link">
            Trang chủ
            <span className="nav-underline"></span>
          </Link>
          <Link href="/profile" className="nav-link">
            Hồ sơ
            <span className="nav-underline"></span>
          </Link>
          <a href="#" className="nav-link">
            Sản phẩm
            <span className="nav-underline"></span>
          </a>
          <a href="#" className="nav-link">
            Dịch vụ
            <span className="nav-underline"></span>
          </a>
          <a href="#" className="nav-link">
            Liên hệ
            <span className="nav-underline"></span>
          </a>
        </nav>

        {/* Nút hành động */}
        <div className="header-actions">
          <button className="btn-login">Đăng nhập</button>
          <button className="btn-post">Đăng tin</button>
        </div>
      </div> {/* Thẻ đóng cho header-container */}
    </header>
  );
};

export default Header;