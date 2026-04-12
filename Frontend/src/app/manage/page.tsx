"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
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

interface ListingData {
  listing_id: number;
  title: string;
  description?: string;
  price: string;
  status: string;
  seller_id: number;
  created_at?: string;
  images: string[];
  bike_details?: BikeDetails;
}

export default function ManageListingsPage() {
  const auth = useAuth();
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [promotionLoading, setPromotionLoading] = useState<number | null>(null);

  const parseResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: text || "Phản hồi không hợp lệ từ máy chủ" };
    }
  };

  const fetchMyListings = async (token: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/users/me/listings", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const result = await parseResponse(response);
      if (!response.ok) {
        throw new Error(result.message || "Không thể tải danh sách tin đăng");
      }
      setListings(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null) ?? "";
    if (token) {
      fetchMyListings(token);
    }
  }, [auth.accessToken]);

  const handleReload = () => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để xem quản lý tin đăng.");
      return;
    }
    fetchMyListings(token);
  };

  const handleDelete = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để xóa tin đăng.");
      return;
    }

    setError("");
    setDeleteLoading(listingId);

    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const result = await parseResponse(response);
      if (!response.ok) {
        throw new Error(result.message || "Không thể xóa tin đăng");
      }
      handleReload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleRequestPromotion = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để gửi yêu cầu đẩy tin.");
      return;
    }

    setError("");
    setPromotionLoading(listingId);

    try {
      const response = await fetch(`/api/listings/${listingId}/request-promotion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const result = await parseResponse(response);
      if (!response.ok) {
        throw new Error(result.message || "Không thể gửi yêu cầu đẩy tin");
      }
      handleReload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPromotionLoading(null);
    }
  };

  if (!auth.loggedIn) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyState}>
          <h1>Quản lý tin đăng</h1>
          <p>Bạn cần đăng nhập để xem và quản lý tin đăng của mình.</p>
          <Link href="/login" className={styles.primaryButton}>
            Đến trang đăng nhập
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1>Quản lý tin đăng</h1>
          <p>Xem danh sách tin đăng của bạn và trạng thái hiện tại.</p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={handleReload} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {listings.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Hiện tại bạn chưa có tin đăng nào.</p>
          <Link href="/post" className={styles.primaryButton}>
            Tạo tin đăng mới
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {listings.map((listing) => (
            <article key={listing.listing_id} className={styles.card}>
              {listing.images?.[0] ? (
                <img src={listing.images[0]} alt={listing.title} className={styles.cardImage} />
              ) : (
                <div className={styles.cardImagePlaceholder}>Không có ảnh</div>
              )}
              <div className={styles.cardBody}>
                <div className={styles.cardHeader}>
                  <h2>{listing.title}</h2>
                  <span className={styles.status}>{listing.status}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.price}>{listing.price} VND</span>
                  <span>{listing.created_at ? new Date(listing.created_at).toLocaleDateString("vi-VN") : "-"}</span>
                </div>
                <div className={styles.detailsGrid}>
                  <div><strong>Thương hiệu:</strong> {listing.bike_details?.brand || "-"}</div>
                  <div><strong>Model:</strong> {listing.bike_details?.model || "-"}</div>
                  <div><strong>Khung:</strong> {listing.bike_details?.frame_size || "-"}</div>
                  <div><strong>Phanh:</strong> {listing.bike_details?.brake_type || "-"}</div>
                </div>
                <p className={styles.description}>{listing.description || "Chưa có mô tả."}</p>
                <div className={styles.cardActions}>
                  <Link href={`/post?listingId=${listing.listing_id}`} className={styles.editButton}>
                    Chỉnh sửa
                  </Link>
                  {listing.status === "PENDING_PROMOTION" ? (
                    <span className={styles.promotionStatus}>
                      Đang chờ duyệt đẩy tin
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => handleRequestPromotion(listing.listing_id)}
                      disabled={promotionLoading === listing.listing_id}
                    >
                      {promotionLoading === listing.listing_id ? "Đang gửi..." : "Đẩy tin"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDelete(listing.listing_id)}
                    disabled={deleteLoading === listing.listing_id}
                  >
                    {deleteLoading === listing.listing_id ? "Đang xóa..." : "Xóa"}
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
