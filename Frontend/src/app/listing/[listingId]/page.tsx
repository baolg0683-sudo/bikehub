"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useChat } from "../../../context/ChatContext";
import styles from "./page.module.css";

interface BikeDetails {
  brand?: string;
  model?: string;
  type?: string;
  frame_size?: string;
  frame_material?: string;
  wheel_size?: string;
  brake_type?: string;
  color?: string;
  manufacture_year?: number;
  groupset?: string;
  condition_percent?: number;
  mileage_km?: number;
  serial_number?: string;
  primary_image_url?: string;
}

interface SellerInfo {
  seller_id?: number;
  name?: string;
  phone?: string;
}

interface ListingDetail {
  listing_id: number;
  seller_id: number;
  title: string;
  description?: string;
  price: string;
  status: string;
  created_at?: string;
  images?: string[];
  bike_details?: BikeDetails;
  seller?: SellerInfo;
}

export default function ListingDetailPage() {
  const params = useParams();
  const listingId = params?.listingId;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [related, setRelated] = useState<ListingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const { openConversation } = useChat();

  const formatPrice = (value: string) => {
    const number = Number(value);
    if (Number.isNaN(number) || number === 0) {
      return "Liên hệ";
    }
    return number.toLocaleString("vi-VN") + " đ";
  };

  useEffect(() => {
    if (!listingId) {
      return;
    }

    const loadCurrentUser = async () => {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
      if (!token) {
        return;
      }

      try {
        const profileResponse = await fetch("/api/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!profileResponse.ok) {
          return;
        }
        const profileResult = await profileResponse.json();
        if (profileResult?.success && profileResult.data?.user_id) {
          setCurrentUserId(profileResult.data.user_id);
        }
      } catch {
        // ignore profile load failures
      }
    };

    loadCurrentUser();

    const loadListing = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/listings/${listingId}`);
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.message || "Không thể tải chi tiết sản phẩm.");
        }

        const detail: ListingDetail = await response.json();
        setListing(detail);
        setActiveImageIndex(0);

        const brand = detail.bike_details?.brand || "";
        const type = detail.bike_details?.type || "";

        if (brand || type) {
          const searchParams = new URLSearchParams();
          if (brand) searchParams.append("brand", brand);
          if (type) searchParams.append("type", type);
          const relatedResponse = await fetch(`/api/listings?${searchParams.toString()}`);
          if (relatedResponse.ok) {
            const rawRelated: ListingDetail[] = await relatedResponse.json();
            setRelated(rawRelated.filter((item) => item.listing_id !== detail.listing_id).slice(0, 4));
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadListing();
  }, [listingId]);

  if (loading) {
    return <div className={styles.page}><p className={styles.statusMessage}>Đang tải chi tiết sản phẩm...</p></div>;
  }

  if (error) {
    return <div className={styles.page}><p className={styles.errorMessage}>{error}</p></div>;
  }

  if (!listing) {
    return <div className={styles.page}><p className={styles.statusMessage}>Sản phẩm không tồn tại.</p></div>;
  }

  const images = listing.images?.length ? listing.images : listing.bike_details?.primary_image_url ? [listing.bike_details.primary_image_url] : ["/assets/bike.png"];
  const isOwnListing = currentUserId !== null && currentUserId === listing.seller_id;

  return (
    <section className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href="/">Trang chủ</Link>
        <span> / </span>
        <Link href="/">Danh sách sản phẩm</Link>
        <span> / </span>
        <span>{listing.title}</span>
      </div>

      <div className={styles.topSection}>
        <div className={styles.gallery}>
          <div className={styles.mainImageWrapper}>
            <img src={images[activeImageIndex]} alt={listing.title} className={styles.mainImage} />
          </div>
          <div className={styles.thumbnailRow}>
            {images.map((src, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.thumbnailButton} ${index === activeImageIndex ? styles.thumbnailActive : ""}`}
                onClick={() => setActiveImageIndex(index)}
              >
                <img src={src} alt={`${listing.title} ${index + 1}`} className={styles.thumbnailImage} />
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <p className={styles.statusTag}>{listing.status}</p>
              <h1 className={styles.title}>{listing.title}</h1>
            </div>
            <p className={styles.price}>{formatPrice(listing.price)}</p>
          </div>

          {!isOwnListing && (
            <div className={styles.actionRow}>
              <button className={styles.buyButton}>Đặt mua</button>
              <button
                type="button"
                className={styles.chatButton}
                onClick={() => openConversation({
                  sellerId: listing.seller_id,
                  sellerName: listing.seller?.name || `Người bán #${listing.seller_id}`,
                  listingId: listing.listing_id,
                  listingTitle: listing.title,
                })}
              >
                Chat với người bán
              </button>
            </div>
          )}

          <div className={styles.sellerCard}>
            <p className={styles.sectionTitle}>Thông tin người bán</p>
            <p className={styles.sellerName}>{listing.seller?.name || `Người bán #${listing.seller_id}`}</p>
            {listing.seller?.phone ? <p>Điện thoại: {listing.seller.phone}</p> : <p>Chưa có số điện thoại</p>}
          </div>
        </div>
      </div>

      <div className={styles.infoSection}>
        <div className={styles.productDetails}>
          <h2>Thông tin chi tiết sản phẩm</h2>
          <div className={styles.detailGrid}>
            <div>
              <span>Hãng</span>
              <strong>{listing.bike_details?.brand || "-"}</strong>
            </div>
            <div>
              <span>Model</span>
              <strong>{listing.bike_details?.model || "-"}</strong>
            </div>
            <div>
              <span>Loại</span>
              <strong>{listing.bike_details?.type || "-"}</strong>
            </div>
            <div>
              <span>Khung</span>
              <strong>{listing.bike_details?.frame_size || "-"}</strong>
            </div>
            <div>
              <span>Chất liệu</span>
              <strong>{listing.bike_details?.frame_material || "-"}</strong>
            </div>
            <div>
              <span>Phanh</span>
              <strong>{listing.bike_details?.brake_type || "-"}</strong>
            </div>
            <div>
              <span>Năm sản xuất</span>
              <strong>{listing.bike_details?.manufacture_year || "-"}</strong>
            </div>
            <div>
              <span>Độ mới</span>
              <strong>{listing.bike_details?.condition_percent ? `${listing.bike_details.condition_percent}%` : "-"}</strong>
            </div>
            <div>
              <span>Quãng đường</span>
              <strong>{listing.bike_details?.mileage_km ? `${listing.bike_details.mileage_km} km` : "-"}</strong>
            </div>
            <div>
              <span>Màu sắc</span>
              <strong>{listing.bike_details?.color || "-"}</strong>
            </div>
          </div>

          <div className={styles.descriptionBox}>
            <h3>Mô tả</h3>
            <p>{listing.description || "Chưa có mô tả cho sản phẩm này."}</p>
          </div>
        </div>

        <div className={styles.relatedSection}>
          <h2>Sản phẩm liên quan</h2>
          {related.length === 0 ? (
            <p>Không có sản phẩm liên quan phù hợp.</p>
          ) : (
            <div className={styles.relatedGrid}>
              {related.map((item) => (
                <Link key={item.listing_id} href={`/listing/${item.listing_id}`} className={styles.relatedCard}>
                  <img src={item.images?.[0] || "/assets/bike.png"} alt={item.title} className={styles.relatedImage} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{formatPrice(item.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
