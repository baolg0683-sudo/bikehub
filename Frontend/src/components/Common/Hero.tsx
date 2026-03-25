import React from "react";

interface HeroProps {}

const Hero: React.FC<HeroProps> = () => {
  return (
    <section className="hero">
      <div className="hero-overlay"></div>
      <div className="hero-container">
        <h2 className="hero-title">Old but gold - High cadence riding.</h2>
        <p className="hero-subtitle">Khám phá bộ sưu tập xe đạp đã qua sử dụng chất lượng cao với giá tốt nhất!</p>
        <div className="hero-search">
          <input type="search" placeholder="Tìm kiếm xe đạp theo hãng, model..." className="search-input" />
          <select className="search-select">
            <option>Tất cả loại xe</option>
            <option>Xe đạp địa hình</option>
            <option>Xe đạp đường phố</option>
            <option>Xe đạp thể thao</option>
            <option>Xe đạp trợ lực (E-bike)</option>
          </select>
          <button className="search-btn">Tìm kiếm</button>
        </div>
        <div className="hero-features">
          <span className="feature-item">
            <span className="feature-check">✓</span> Trao đổi mua bán trực tiếp
          </span>
          <span className="feature-item">
            <span className="feature-check">✓</span> Đảm bảo chính hãng 100%
          </span>
          <span className="feature-item">
            <span className="feature-check">✓</span> Xử lý đơn hàng nhanh chóng
          </span>
        </div>
      </div>
    </section>
  );
};

export default Hero;