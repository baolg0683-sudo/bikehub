import React from "react";
import styles from "./Hero.module.css";

interface HeroProps {}

const Hero: React.FC<HeroProps> = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.heroOverlay}></div>
      <div className={styles.heroContainer}>
        <h2 className={styles.heroTitle}>Old but gold - High cadence riding.</h2>
        <p className={styles.heroSubtitle}>Khám phá bộ sưu tập xe đạp đã qua sử dụng chất lượng cao với giá tốt nhất!</p>
        <div className={styles.heroSearch}>
          <input type="search" placeholder="Tìm kiếm xe đạp theo hãng, model..." className={styles.searchInput} />
          <select className={styles.searchSelect} title="Chọn loại xe đạp">
            <option>Tất cả loại xe</option>
            <option>Xe đạp địa hình</option>
            <option>Xe đạp đường phố</option>
            <option>Xe đạp thể thao</option>
            <option>Xe đạp trợ lực (E-bike)</option>
          </select>
          <button className={styles.searchBtn}>Tìm kiếm</button>
        </div>
        <div className={styles.heroFeatures}>
          <span className={styles.featureItem}>
            <span className={styles.featureCheck}>✓</span> Trao đổi mua bán trực tiếp
          </span>
          <span className={styles.featureItem}>
            <span className={styles.featureCheck}>✓</span> Đảm bảo chính hãng 100%
          </span>
          <span className={styles.featureItem}>
            <span className={styles.featureCheck}>✓</span> Xử lý đơn hàng nhanh chóng
          </span>
        </div>
      </div>
    </section>
  );
};

export default Hero;