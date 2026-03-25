import React from "react";

interface HeroProps {}

const Hero: React.FC<HeroProps> = () => {
  return (
    <section className="hero">
      <div className="hero-overlay"></div>
      <div className="hero-container">
        <h2 className="hero-title">Những chiếc xe đạp tuyệt vời đang chờ bạn</h2>
        <p className="hero-subtitle">Khám phá bộ sưu tập xe đạp chất lượng cao với giá tốt nhất. Đặt hàng ngay hôm nay!</p>
        <div className="hero-search">
          <input type="search" placeholder="Tìm kiếm xe đạp theo hãng, model..." className="search-input" />
          <select className="search-select">
            <option>Tất cả loại</option>
            <option>Đạp địa hình</option>
            <option>Đạp đường phố</option>
            <option>Đạp thể thao</option>
          </select>
          <button className="search-btn">Tìm kiếm</button>
        </div>
        <div className="hero-features">
          <span className="feature-item">
            <span className="feature-check">✓</span> Giao hàng tận nơi
          </span>
          <span className="feature-item">
            <span className="feature-check">✓</span> Bảo hành 1 năm
          </span>
          <span className="feature-item">
            <span className="feature-check">✓</span> Đổi trả miễn phí
          </span>
        </div>
      </div>
    </section>
  );
};

export default Hero;