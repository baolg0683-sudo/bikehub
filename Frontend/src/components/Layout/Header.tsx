import React from "react";

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <div className="logo-icon">🚲</div>
          <h1 className="logo-text">BikeMarket</h1>
        </div>
        <nav className="header-nav">
          <a href="#" className="nav-link">
            Trang chủ
            <span className="nav-underline"></span>
          </a>
          <a href="#" className="nav-link">
            Sản phẩm
            <span className="nav-underline"></span>
          </a>
          <a href="#" className="nav-link">
            Dịch vụ
            <span className="nav-underline"></span>
          </a>
          <a href="#" className="nav-link">
            Khuyến mãi
            <span className="nav-underline"></span>
          </a>
          <a href="#" className="nav-link">
            Liên hệ
            <span className="nav-underline"></span>
          </a>
        </nav>
        <div className="header-actions">
          <button className="btn-login">Đăng nhập</button>
          <button className="btn-post">Đăng tin</button>
        </div>
      </div>
    </header>
  );
};

export default Header;