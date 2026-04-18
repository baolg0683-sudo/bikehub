"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FiCheckCircle, FiHeart } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { readWishlist, saveWishlist, WishlistItem } from "../../../utils/wishlist";
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
  reputation_score?: number;
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
  is_verified?: boolean;
}

export default function ListingDetailPage() {
  const params = useParams();
  const listingId = params?.listingId;
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [related, setRelated] = useState<ListingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [depositPercent, setDepositPercent] = useState<25 | 50 | 100>(25);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const { openConversation } = useChat();
  const { loggedIn, user, accessToken } = useAuth();
  const router = useRouter();

  const getAuthHeaders = (): Record<string, string> => {
    const token = accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null);
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  const getAuthHeaderOnly = (): Record<string, string> => {
    const token = accessToken ?? (typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null);
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const formatPrice = (value: string) => {
    const number = Number(value);
    if (Number.isNaN(number) || number === 0) {
      return "Liên hệ";
    }
    return number.toLocaleString("vi-VN") + " BikeCoin";
  };

  useEffect(() => {
    if (!listingId) {
      return;
    }

    const loadCurrentUser = async () => {
      const token = typeof window !== "undefined" ? window.sessionStorage.getItem("access_token") : null;
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
        const response = await fetch(`/api/listings/${listingId}`, { headers: getAuthHeaderOnly() });
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

  useEffect(() => {
    if (!user || !listing) {
      setIsWishlisted(false);
      return;
    }

    const wishlistItems = readWishlist(user.user_id ?? null);
    setIsWishlisted(wishlistItems.some((item) => item.listing_id === listing.listing_id));
  }, [user, listing]);

  const handleToggleWishlist = () => {
    if (!loggedIn || !user) {
      router.push('/login');
      return;
    }

    const currentItems = readWishlist(user.user_id ?? null);
    const alreadySaved = currentItems.some((item) => item.listing_id === listing?.listing_id);

    const nextItems = alreadySaved
      ? currentItems.filter((item) => item.listing_id !== listing?.listing_id)
      : [
          ...currentItems,
          {
            listing_id: listing!.listing_id,
            title: listing!.title,
            image: images[activeImageIndex] || '/assets/bike.png',
            price: formatPrice(listing!.price),
          },
        ];

    saveWishlist(user.user_id ?? null, nextItems);
    setIsWishlisted(!alreadySaved);
  };

  const openZoom = (index: number) => {
    setZoomIndex(index);
    setZoomOpen(true);
  };

  const closeZoom = () => {
    setZoomOpen(false);
  };

  const canPlaceOrder =
    listing &&
    ["AVAILABLE", "PENDING", "PENDING_PROMOTION"].includes(listing.status);

  const openPurchaseModal = () => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setPurchaseError("");
    setPurchaseOpen(true);
  };

  const submitPurchase = async () => {
    if (!listing) {
      return;
    }
    setPurchaseSubmitting(true);
    setPurchaseError("");
    try {
      const priceNum = Number(listing.price);
      const needDeposit = (priceNum * depositPercent) / 100;
      const authH = getAuthHeaders();
      if (!authH.Authorization) {
        throw new Error("Vui lòng đăng nhập.");
      }
      const walletRes = await fetch("/api/wallet/me", {
        headers: { Authorization: authH.Authorization },
      });
      const walletData = await walletRes.json().catch(() => ({}));
      if (!walletRes.ok) {
        throw new Error((walletData as { message?: string }).message || "Không kiểm tra được số dư ví.");
      }
      const bal = Number((walletData as { balance?: string }).balance ?? 0);
      if (Number.isNaN(bal) || bal < needDeposit) {
        throw new Error(
          `Số dư BikeCoin không đủ để đặt cọc. Cần ít nhất ${needDeposit.toLocaleString("vi-VN")} BikeCoin (đang chọn ${depositPercent}%), hiện có ${bal.toLocaleString("vi-VN")} BikeCoin.`
        );
      }

      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          listing_id: listing.listing_id,
          deposit_percent: depositPercent,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error((createData as { message?: string }).message || "Không tạo được đơn.");
      }
      const orderId = (createData as { order_id?: number }).order_id;
      if (!orderId) {
        throw new Error("Phản hồi đơn hàng không hợp lệ.");
      }
      const payRes = await fetch(`/api/orders/${orderId}/pay-deposit`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const payData = await payRes.json().catch(() => ({}));
      if (!payRes.ok) {
        throw new Error((payData as { message?: string }).message || "Không thanh toán cọc được.");
      }
      setPurchaseOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("walletUpdated"));
      }
      router.push("/orders");
    } catch (err) {
      setPurchaseError((err as Error).message);
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  const showPrevZoom = () => {
    setZoomIndex((current) => (current - 1 + images.length) % images.length);
  };

  const showNextZoom = () => {
    setZoomIndex((current) => (current + 1) % images.length);
  };

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
          <div className={styles.mainImageWrapper} onClick={() => openZoom(activeImageIndex)}>
            <img src={images[activeImageIndex]} alt={listing.title} className={styles.mainImage} />
            <button type="button" className={styles.detailZoomButton}>
              🔍
            </button>
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

          {zoomOpen && (
            <div className={styles.detailImageZoomModal} onClick={closeZoom}>
              <div className={styles.detailImageZoomContent} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.detailImageZoomClose} onClick={closeZoom}>
                  ×
                </button>
                <img src={images[zoomIndex]} alt={`Ảnh lớn ${zoomIndex + 1}`} className={styles.detailImageZoomed} />
                {images.length > 1 && (
                  <div className={styles.detailImageZoomControls}>
                    <button type="button" onClick={showPrevZoom} className={styles.detailImageZoomControlButton}>
                      ‹
                    </button>
                    <button type="button" onClick={showNextZoom} className={styles.detailImageZoomControlButton}>
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <p className={styles.statusTag}>{listing.status}</p>
              <h1 className={styles.title}>{listing.title}</h1>
              <div className={styles.listingMeta}>
                {listing.is_verified && (
                  <span className={styles.verifiedBadge}>
                    <FiCheckCircle />
                    Đã kiểm định
                  </span>
                )}
              </div>
            </div>
            <p className={styles.price}>{formatPrice(listing.price)}</p>
          </div>

          {!isOwnListing && (
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.buyButton}
                disabled={!canPlaceOrder}
                onClick={openPurchaseModal}
              >
                Đặt mua
              </button>
              <button
                type="button"
                className={`${styles.wishlistDetailButton} ${isWishlisted ? styles.wishlistActive : ''}`}
                onClick={handleToggleWishlist}
              >
                <FiHeart />
                {isWishlisted ? 'Đã lưu' : 'Lưu lại'}
              </button>
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
            <div className={styles.reputationRow}>
              Đánh giá:{" "}
              <strong>
                {listing.seller?.reputation_score !== undefined && listing.seller?.reputation_score !== null
                  ? listing.seller.reputation_score.toFixed(1)
                  : "5.0"}
              </strong>
              /5
            </div>
            {isOwnListing && listing.seller?.phone ? (
              <p style={{ marginTop: "0.75rem" }}>Điện thoại (tin của bạn): {listing.seller.phone}</p>
            ) : null}
            {!isOwnListing ? (
              <p style={{ marginTop: "0.75rem", color: "#64748b", fontSize: "0.9rem" }}>
                Số điện thoại và email liên hệ được hiển thị sau khi bạn đặt cọc thành công (Quản lý đơn hàng).
              </p>
            ) : null}
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
              <strong>{listing.bike_details?.condition_percent !== undefined && listing.bike_details?.condition_percent !== null ? `${listing.bike_details.condition_percent}%` : "-"}</strong>
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

      {purchaseOpen && listing && (
        <div className={styles.purchaseModalOverlay} onClick={() => !purchaseSubmitting && setPurchaseOpen(false)}>
          <div className={styles.purchaseModal} onClick={(e) => e.stopPropagation()}>
            <h3>Đặt cọc mua xe</h3>
            <p>
              Chọn tỷ lệ cọc bằng <strong>BikeCoin</strong>. Số BikeCoin cọc sẽ bị trừ khỏi ví và được sàn <strong>tạm
              giữ</strong> cho đến khi giao dịch xong hoặc hoàn trả theo quy định.
            </p>
            <p>
              Giá niêm yết: <strong>{formatPrice(listing.price)}</strong> (1 BikeCoin = 1 VNĐ trên ví).
            </p>
            <div className={styles.depositOptions}>
              {([100, 50, 25] as const).map((pct) => (
                <label key={pct} className={styles.depositOption}>
                  <input
                    type="radio"
                    name="deposit"
                    checked={depositPercent === pct}
                    onChange={() => setDepositPercent(pct)}
                  />
                  <span>
                    Thanh toán <strong>{pct}%</strong> — cọc khoảng{" "}
                    {formatPrice(String((Number(listing.price) * pct) / 100))}
                  </span>
                </label>
              ))}
            </div>
            {purchaseError ? <div className={styles.purchaseModalError}>{purchaseError}</div> : null}
            <div className={styles.purchaseModalActions}>
              <button type="button" className={styles.chatButton} onClick={() => setPurchaseOpen(false)} disabled={purchaseSubmitting}>
                Hủy
              </button>
              <button type="button" className={styles.buyButton} onClick={() => void submitPurchase()} disabled={purchaseSubmitting}>
                {purchaseSubmitting ? "Đang xử lý..." : "Xác nhận & trả cọc"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
