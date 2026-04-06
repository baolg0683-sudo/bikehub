import Hero from "../components/Common/Hero";
import ProductGrid from "../components/Common/ProductGrid";
import styles from "./page.module.css";

export default function AppHome() {
  return (
    <div className={styles.pageHome}>
      <Hero />
      <ProductGrid />
    </div>
  );
}
