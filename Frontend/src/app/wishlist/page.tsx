"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiHeart, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { readWishlist, saveWishlist, WishlistItem } from "../../utils/wishlist";
import styles from "./page.module.css";

export default function WishlistPage() {
  const { loggedIn, user } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loggedIn || !user) {
      setWishlist([]);
      setReady(true);
      return;
    }

    setWishlist(readWishlist(user.user_id ?? null));
    setReady(true);
    const handler = () => setWishlist(readWishlist(user.user_id ?? null));
    window.addEventListener("wishlistUpdated", handler);
    return () => window.removeEventListener("wishlistUpdated", handler);
  }, [loggedIn, user]);

  const removeItem = (listingId: number) => {
    try {
      if (!user) {
        setError("Vui lòng đăng nhập để xóa sản phẩm khỏi wishlist.");
        return;
      }
      const items = readWishlist(user.user_id ?? null);
      const nextItems = items.filter((item) => item.listing_id !== listingId);
      saveWishlist(user.user_id ?? null, nextItems);
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

      {!ready ? (
        <div className={styles.emptyState}>
          <p>Đang tải wishlist...</p>
        </div>
      ) : !loggedIn ? (
        <div className={styles.emptyState}>
          <p>Bạn cần đăng nhập để xem wishlist của mình.</p>
          <Link href="/login" className={styles.primaryButton}>
            Đăng nhập
          </Link>
        </div>
      ) : wishlist.length === 0 ? (
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
