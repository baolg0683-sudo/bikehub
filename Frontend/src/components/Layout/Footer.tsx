import React from "react";

interface FooterProps {}

const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-section">
            <h3 className="footer-title">
              <span className="footer-icon">🚲</span> BikeMarket
            </h3>
            <p className="footer-text">
              Nền tảng mua bán xe đạp uy tín, chất lượng hàng đầu Việt Nam.
            </p>
          </div>
          <div className="footer-section">
            <h4 className="footer-subtitle">Liên kết</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">Về chúng tôi</a></li>
              <li><a href="#" className="footer-link">Chính sách</a></li>
              <li><a href="#" className="footer-link">Điều khoản</a></li>
              <li><a href="#" className="footer-link">Hỗ trợ</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4 className="footer-subtitle">Dịch vụ</h4>
            <ul className="footer-links">
              <li><a href="#" className="footer-link">Định giá xe</a></li>
              <li><a href="#" className="footer-link">Bảo hành</a></li>
              <li><a href="#" className="footer-link">Vận chuyển</a></li>
              <li><a href="#" className="footer-link">Thanh toán</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4 className="footer-subtitle">Liên hệ</h4>
            <div className="footer-contact">
              <p>📧 info@bikemarket.vn</p>
              <p>📞 1800-xxxx</p>
              <p>📍 TP.HCM, Việt Nam</p>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 BikeMarket. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;