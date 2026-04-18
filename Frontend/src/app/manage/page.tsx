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
  inspection_status?: string;
  inspection_fee?: string;
  is_verified?: boolean;
  is_hidden?: boolean;
  seller_id: number;
  assigned_inspector?: {
    user_id: number;
    name?: string;
    phone?: string;
  };
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
  const [inspectionLoading, setInspectionLoading] = useState<number | null>(null);
  const [openInspectionRequest, setOpenInspectionRequest] = useState<number | null>(null);
  const [inspectionLocation, setInspectionLocation] = useState<Record<number, string>>({});
  const [showHiddenListings, setShowHiddenListings] = useState(false);
  const inspectionLocationOptions = ["TP. HCM", "Đà Nẵng", "Hà Nội", "Khác"];

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
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
    if (token) {
      fetchMyListings(token);
    }
  }, [auth.accessToken]);

  const handleReload = () => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để xem quản lý tin đăng.");
      return;
    }
    fetchMyListings(token);
  };

  const handleDelete = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
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

  const handleHideListing = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để ẩn tin đăng.");
      return;
    }

    setError("");
    setDeleteLoading(listingId);

    try {
      const listing = listings.find((item) => item.listing_id === listingId);
      if (!listing) {
        throw new Error("Không tìm thấy tin đăng để ẩn.");
      }
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: listing.title,
          description: listing.description || '',
          price: listing.price,
          images: listing.images || [],
          bike_details: listing.bike_details || {},
          status: "HIDDEN",
          is_hidden: true,
        }),
      });
      const result = await parseResponse(response);
      if (!response.ok) {
        throw new Error(result.message || "Không thể ẩn tin đăng");
      }
      handleReload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleUnhideListing = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để hiển thị lại tin đăng.");
      return;
    }

    setError("");
    setDeleteLoading(listingId);

    try {
      const listing = listings.find((item) => item.listing_id === listingId);
      if (!listing) {
        throw new Error("Không tìm thấy tin đăng để hiển thị lại.");
      }
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: listing.title,
          description: listing.description || '',
          price: listing.price,
          images: listing.images || [],
          bike_details: listing.bike_details || {},
          status: "AVAILABLE",
          is_hidden: false,
        }),
      });
      const result = await parseResponse(response);
      if (!response.ok) {
        throw new Error(result.message || "Không thể hiển thị lại tin đăng");
      }
      handleReload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleRequestPromotion = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
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

  const handleToggleInspectionRequest = (listingId: number) => {
    setOpenInspectionRequest((prev) => (prev === listingId ? null : listingId));
    setInspectionLocation((prev) => ({
      ...prev,
      [listingId]: prev[listingId] || inspectionLocationOptions[0],
    }));
  };

  const handleRequestInspection = async (listingId: number) => {
    const token = auth.accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null) ?? "";
    if (!token) {
      setError("Vui lòng đăng nhập để gửi yêu cầu kiểm định.");
      return;
    }

    const selectedLocation = inspectionLocation[listingId] || inspectionLocationOptions[0];

    setError("");
    setInspectionLoading(listingId);

    try {
      const response = await fetch(`/api/listings/${listingId}/request-inspection`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inspection_location: selectedLocation }),
      });
      const result = await parseResponse(response);
      if (!response.ok) {
        throw new Error(result.message || "Không thể gửi yêu cầu kiểm định");
      }
      handleReload();
      setOpenInspectionRequest(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInspectionLoading(null);
    }
  };

  const renderListingCard = (listing: any) => {
    const isHiddenListing = Boolean(listing.is_hidden || listing.status === 'HIDDEN');
    const isSoldListing = listing.status === 'SOLD';
    const isReviewedListing = listing.inspection_status === 'REVIEWED';
    const isPassedListing = listing.inspection_status === 'PASSED';
    const isFailedListing = listing.inspection_status === 'FAILED';
    const isInspectionPending = ['REQUESTED', 'SCHEDULED'].includes(listing.inspection_status);
    const isVerifiedListing = Boolean(listing.is_verified || isPassedListing);
    const canDelete = !['REQUESTED', 'SCHEDULED', 'PASSED'].includes(listing.inspection_status);
    const showPromotionPending = listing.status === 'PENDING_PROMOTION' && isPassedListing;
    const showInspectionRequest = !isSoldListing && !isVerifiedListing && !isInspectionPending && !isReviewedListing;
    const showHideButton = isPassedListing && !isSoldListing && !isHiddenListing;
    const showUnhideButton = isHiddenListing && !isSoldListing && !isFailedListing;

    return (
      <article key={listing.listing_id} className={styles.card}>
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className={styles.cardImage} />
        ) : (
          <div className={styles.cardImagePlaceholder}>Không có ảnh</div>
        )}
        <div className={styles.cardBody}>
          <div className={styles.cardHeader}>
            <h2>{listing.title}</h2>
            <div className={styles.statusGroup}>
              <span className={styles.status}>
                {listing.status === 'AVAILABLE' ? 'Đang hoạt động' :
                 listing.status === 'PENDING' ? 'Chờ duyệt' :
                 listing.status === 'PENDING_PROMOTION' ? 'Chờ duyệt đẩy tin' :
                 listing.status === 'HIDDEN' ? 'Chờ chỉnh sửa' :
                 listing.status === 'SOLD' ? 'Đã bán' :
                 listing.status}
              </span>
              {isSoldListing ? (
                <span className={styles.hiddenStatusBadge}>Đã bán</span>
              ) : isHiddenListing ? (
                <span className={styles.hiddenStatusBadge}>Đã ẩn</span>
              ) : null}
            </div>
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
          {listing.inspection_status && (
            <div className={styles.inspectionStatusBar}>
              {listing.inspection_status === 'REQUESTED' && 'Đã gửi yêu cầu kiểm định — chờ xử lý'}
              {listing.inspection_status === 'SCHEDULED' && 'Đã gửi yêu cầu kiểm định — chờ xử lý'}
              {listing.inspection_status === 'PASSED' && 'Đã kiểm định'}
              {listing.inspection_status === 'REVIEWED' && 'Đã duyệt tin — không cần kiểm định'}
              {listing.inspection_status === 'FAILED' && 'Từ chối duyệt tin'}
            </div>
          )}
          {listing.assigned_inspector && (
            <div className={styles.inspectorInfo}>
              <strong>Nhân viên kiểm định:</strong> {listing.assigned_inspector.name || `#${listing.assigned_inspector.user_id}`}
              {listing.assigned_inspector.phone ? ` — ${listing.assigned_inspector.phone}` : ''}
            </div>
          )}
          <p className={styles.description}>{listing.description || "Chưa có mô tả."}</p>
          <div className={styles.cardActions}>
            {listing.status !== 'SOLD' ? (
              <>
                <Link href={`/post?listingId=${listing.listing_id}`} className={styles.editButton}>
                  Chỉnh sửa
                </Link>
                {canDelete && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDelete(listing.listing_id)}
                    disabled={deleteLoading === listing.listing_id}
                  >
                    {deleteLoading === listing.listing_id ? "Đang xóa..." : "Xóa"}
                  </button>
                )}
              </>
            ) : (
              <span className={styles.disabledAction}>Không thể chỉnh sửa</span>
            )}

            {isInspectionPending ? (
              <span className={styles.inspectionStatusBadge}>
                {listing.inspection_status === 'REQUESTED' ? 'Đã gửi yêu cầu kiểm định' : 'Đã lên lịch kiểm định'}
              </span>
            ) : isPassedListing ? (
              showPromotionPending ? (
                <span className={styles.promotionStatus}>
                  Đang chờ duyệt đẩy tin
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.promotionButton}
                  onClick={() => handleRequestPromotion(listing.listing_id)}
                  disabled={promotionLoading === listing.listing_id}
                >
                  {promotionLoading === listing.listing_id ? "Đang gửi..." : "Yêu cầu đẩy tin"}
                </button>
              )
            ) : isReviewedListing ? (
              <span className={styles.inspectionStatusBadge}>
                Đã duyệt tin, không có chức năng đẩy tin
              </span>
            ) : showInspectionRequest ? (
              <>
                <button
                  type="button"
                  className={styles.promotionButton}
                  onClick={() => handleToggleInspectionRequest(listing.listing_id)}
                  disabled={inspectionLoading === listing.listing_id}
                >
                  Đăng ký kiểm định
                </button>
                <span className={styles.disabledAction}>
                  Chưa kiểm định, không thể đẩy tin
                </span>
              </>
            ) : isFailedListing ? (
              <span className={styles.inspectionStatusBadge}>
                Từ chối duyệt tin. Có thể kiểm định lại.
              </span>
            ) : null}

            {showUnhideButton ? (
              <button
                type="button"
                className={styles.unhideButton}
                onClick={() => handleUnhideListing(listing.listing_id)}
                disabled={deleteLoading === listing.listing_id}
              >
                {deleteLoading === listing.listing_id ? "Đang mở..." : "Mở lại"}
              </button>
            ) : isSoldListing ? (
              <span className={styles.disabledAction}>Đã bán, không thể up</span>
            ) : showHideButton ? (
              <button
                type="button"
                className={styles.hideButton}
                onClick={() => handleHideListing(listing.listing_id)}
                disabled={deleteLoading === listing.listing_id}
              >
                {deleteLoading === listing.listing_id ? "Đang ẩn..." : "Ẩn"}
              </button>
            ) : null}
          </div>
          {openInspectionRequest === listing.listing_id && (
            <div className={styles.inspectionPanel}>
              <p className={styles.inspectionNote}>
                Phí kiểm định: 50.000 Bikecoin / chiếc.
              </p>
              <div className={styles.inspectionFormRow}>
                <label htmlFor={`inspection_location_${listing.listing_id}`}>Khu vực kiểm định trực tiếp</label>
                <select
                  id={`inspection_location_${listing.listing_id}`}
                  value={inspectionLocation[listing.listing_id] || inspectionLocationOptions[0]}
                  onChange={(event) => setInspectionLocation((prev) => ({ ...prev, [listing.listing_id]: event.target.value }))}
                  className={styles.inspectionLocationSelect}
                >
                  {inspectionLocationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.inspectionPanelActions}>
                <button
                  type="button"
                  className={styles.inspectionButton}
                  onClick={() => handleRequestInspection(listing.listing_id)}
                  disabled={inspectionLoading === listing.listing_id}
                >
                  {inspectionLoading === listing.listing_id ? "Đang gửi..." : "Xác nhận"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setOpenInspectionRequest(null)}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
    );
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
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setShowHiddenListings((prev) => !prev)}>
            {showHiddenListings ? "Hiển thị xe đang hoạt động" : "Hiển thị xe đã ẩn"}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={handleReload} disabled={loading}>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
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
          {listings
            .filter((listing) => {
              const listingHidden = Boolean(
                (listing.is_hidden || listing.status === 'HIDDEN') && listing.inspection_status !== 'FAILED'
              );
              const isSoldListing = listing.status === 'SOLD';
              return showHiddenListings ? listingHidden || isSoldListing : !listingHidden && !isSoldListing;
            })
            .map((listing) => renderListingCard(listing))}
        </div>
      )}
    </section>
  );
}
