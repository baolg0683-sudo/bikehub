import React from "react";
import styles from "./ProductGrid.module.css";

interface ProductCardProps {
  image: string;
  title: string;
  condition: string;
  price: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ image, title, condition, price }) => {
  return (
    <article className={styles.productCard}>
      <div className={styles.productImageContainer}>
        <img src={image} alt={title} className={styles.productImage} />
        <div className={styles.productBadge}>Hot</div>
      </div>
      <div className={styles.productContent}>
        <h4 className={styles.productTitle}>{title}</h4>
        <p className={styles.productCondition}>Tình trạng: <span className={styles.conditionText}>{condition}</span></p>
        <div className={styles.productFooter}>
          <p className={styles.productPrice}>{price}</p>
          <button className={styles.productBtn}>Xem chi tiết</button>
        </div>
      </div>
    </article>
  );
};

interface ProductGridProps {}

const ProductGrid: React.FC<ProductGridProps> = () => {
  const products = [
    { image: "/assets/bike.png", title: "Trek Marlin 7 2023", condition: "Excellent", price: "12.500.000 đ" },
    { image: "/assets/bike.png", title: "Giant TCR Advanced 2022", condition: "Good", price: "15.200.000 đ" },
    { image: "/assets/bike.png", title: "Specialized Roubaix 2021", condition: "Very Good", price: "18.900.000 đ" },
    { image: "/assets/bike.png", title: "Cannondale Synapse 2023", condition: "Excellent", price: "14.800.000 đ" },
    { image: "/assets/bike.png", title: "Bianchi Oltre XR4 2022", condition: "Good", price: "22.500.000 đ" },
    { image: "/assets/bike.png", title: "Pinarello Dogma F12 2021", condition: "Very Good", price: "28.000.000 đ" },
  ];

  return (
    <section className={styles.productsSection}>
      <div className={styles.productsContainer}>
        <div className={styles.productsHeader}>
          <h3 className={styles.productsTitle}>Sản phẩm nổi bật</h3>
          <p className={styles.productsSubtitle}>Khám phá những chiếc xe đạp chất lượng cao với giá cả phải chăng</p>
        </div>
        <div className={styles.productsGrid}>
          {products.map((product, index) => (
            <ProductCard
              key={index}
              image={product.image}
              title={product.title}
              condition={product.condition}
              price={product.price}
            />
          ))}
        </div>
        <div className={styles.productsFooter}>
          <button className={styles.productsViewAll}>Xem tất cả sản phẩm</button>
        </div>
      </div>
    </section>
  );
};

export default ProductGrid;