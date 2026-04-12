"use client";

import React, { FormEvent } from "react";
import styles from "./Hero.module.css";

interface HeroProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  onToggleFilters: () => void;
  filtersOpen: boolean;
}

const Hero: React.FC<HeroProps> = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  onToggleFilters,
  filtersOpen,
}) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroOverlay}></div>
      <div className={styles.heroContainer}>
        <h2 className={styles.heroTitle}>Old but gold - High cadence riding.</h2>
        <p className={styles.heroSubtitle}>Khám phá bộ sưu tập xe đạp đã qua sử dụng chất lượng cao với giá tốt nhất!</p>
        <form className={styles.heroSearch} onSubmit={handleSubmit}>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Tìm kiếm xe đạp theo hãng, model..."
            className={styles.searchInput}
          />
          <div className={styles.heroActions}>
            <button type="submit" className={styles.searchBtn}>
              Tìm kiếm
            </button>
            <button type="button" className={styles.filterBtn} onClick={onToggleFilters}>
              {filtersOpen ? "Đóng lọc" : "Lọc"}
            </button>
          </div>
        </form>
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
