import React from "react";

interface ProductCardProps {
  image: string;
  title: string;
  condition: string;
  price: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ image, title, condition, price }) => {
  return (
    <article className="product-card">
      <div className="product-image-container">
        <img src={image} alt={title} className="product-image" />
        <div className="product-badge">Hot</div>
      </div>
      <div className="product-content">
        <h4 className="product-title">{title}</h4>
        <p className="product-condition">Tình trạng: <span className="condition-text">{condition}</span></p>
        <div className="product-footer">
          <p className="product-price">{price}</p>
          <button className="product-btn">Xem chi tiết</button>
        </div>
      </div>
    </article>
  );
};

interface ProductGridProps {}

const ProductGrid: React.FC<ProductGridProps> = () => {
  const products = [
    { image: "/assets/next.svg", title: "Trek Marlin 7 2023", condition: "Excellent", price: "12.500.000 đ" },
    { image: "/assets/next.svg", title: "Giant TCR Advanced 2022", condition: "Good", price: "15.200.000 đ" },
    { image: "/assets/next.svg", title: "Specialized Roubaix 2021", condition: "Very Good", price: "18.900.000 đ" },
    { image: "/assets/next.svg", title: "Cannondale Synapse 2023", condition: "Excellent", price: "14.800.000 đ" },
    { image: "/assets/next.svg", title: "Bianchi Oltre XR4 2022", condition: "Good", price: "22.500.000 đ" },
    { image: "/assets/next.svg", title: "Pinarello Dogma F12 2021", condition: "Very Good", price: "28.000.000 đ" },
  ];

  return (
    <section className="products-section">
      <div className="products-container">
        <div className="products-header">
          <h3 className="products-title">Sản phẩm nổi bật</h3>
          <p className="products-subtitle">Khám phá những chiếc xe đạp chất lượng cao với giá cả phải chăng</p>
        </div>
        <div className="products-grid">
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
        <div className="products-footer">
          <button className="products-view-all">Xem tất cả sản phẩm</button>
        </div>
      </div>
    </section>
  );
};

export default ProductGrid;