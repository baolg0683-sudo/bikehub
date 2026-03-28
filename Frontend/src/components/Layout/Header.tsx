import React from "react";
import Link from "next/link";

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <div className="header-logo">
          <Link href="/" className="logo-icon">
            <img src="/assets/favicon.ico" width={24} height={24} alt="logo" />
            <span>BikeMarket</span>
          </Link>
        </div>

        {/* Menu điều hướng */}
        <nav className="header-nav">
          <Link href="/" className="nav-link">
            Trang chủ
            <span className="nav-underline"></span>
          </Link>
          <a href="#products" className="nav-link">
            Sản phẩm
            <span className="nav-underline"></span>
          </a>
          <a href="#services" className="nav-link">
            Dịch vụ
            <span className="nav-underline"></span>
          </a>
          <a href="#promotions" className="nav-link">
            Khuyến mãi
            <span className="nav-underline"></span>
          </a>
          <a href="#contact" className="nav-link">
            Liên hệ
            <span className="nav-underline"></span>
          </a>
        </nav>

        {/* Nút hành động */}
        <div className="header-actions">
          <Link href="/login" className="btn-login">
            Đăng nhập
          </Link>
          <Link href="/register" className="btn-post">
            Đăng ký
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;