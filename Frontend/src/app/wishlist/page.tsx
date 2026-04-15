"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiHeart, FiTrash2 } from "react-icons/fi";
import styles from "./page.module.css";

interface WishlistItem {
  listing_id: number;
  title: string;
  image: string;
  price: string;
}

const WISHLIST_STORAGE_KEY = "bikehub_wishlist";

const parseWishlist = (): WishlistItem[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as WishlistItem[];
  } catch (error) {
    console.error("[WishlistPage] Failed to parse wishlist", error);
    return [];
  }
};

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setWishlist(parseWishlist());
    const handler = () => setWishlist(parseWishlist());
    window.addEventListener("wishlistUpdated", handler);
    return () => window.removeEventListener("wishlistUpdated", handler);
  }, []);

  const removeItem = (listingId: number) => {
    try {
      const items = parseWishlist();
      const nextItems = items.filter((item) => item.listing_id !== listingId);
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(nextItems));
      window.dispatchEvent(new Event("wishlistUpdated"));
      setWishlist(nextItems);
    } catch (err) {
      setError("Không thể xóa sản phẩm khỏi wishlist.");
    }
  };

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1>Wishlist của tôi</h1>
          <p>Danh sách sản phẩm bạn đã lưu để xem lại sau.</p>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {wishlist.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Hiện tại bạn chưa lưu sản phẩm nào.</p>
          <Link href="/" className={styles.primaryButton}>
            Quay về trang chủ
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {wishlist.map((item) => (
            <article key={item.listing_id} className={styles.card}>
              <img src={item.image} alt={item.title} className={styles.cardImage} />
              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <h2>{item.title}</h2>
                  <span className={styles.price}>{item.price}</span>
                </div>
                <div className={styles.cardActions}>
                  <Link href={`/listing/${item.listing_id}`} className={styles.primaryButton}>
                    Xem sản phẩm
                  </Link>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => removeItem(item.listing_id)}
                  >
                    <FiTrash2 />
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
