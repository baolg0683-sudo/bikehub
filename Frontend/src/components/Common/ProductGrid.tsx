"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiHeart } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { readWishlist, saveWishlist, WishlistItem } from "../../utils/wishlist";
import styles from "./ProductGrid.module.css";

interface ProductCardProps {
  listing_id: number;
  image: string;
  title: string;
  condition: string;
  price: string;
  isPromoted?: boolean;
  isVerified?: boolean;
  isWishlisted: boolean;
  onToggleWishlist: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

interface ListingData {
  listing_id: number;
  title: string;
  price: string;
  status: string;
  created_at?: string | null;
  is_promoted?: boolean;
  is_verified?: boolean;
  images?: string[];
  bike_details?: {
    condition_percent?: number;
    brand?: string;
    model?: string;
    type?: string;
    frame_material?: string;
    primary_image_url?: string;
  };
}

interface FilterOption {
  value: string;
  label: string;
}


interface ProductGridFilters {
  q?: string;
  status?: string;
}

interface ProductGridProps {
  filters: ProductGridFilters;
  brands: string[];
  materials: string[];
  conditions: FilterOption[];
  types: string[];
  filtersOpen: boolean;
}

const formatPrice = (value: string) => {
  const number = Number(value);
  if (Number.isNaN(number) || number === 0) {
    return "Liên hệ";
  }
  return number.toLocaleString("vi-VN") + " BikeCoin";
};

const ProductCard: React.FC<ProductCardProps> = ({ listing_id, image, title, condition, price, isPromoted, isVerified, isWishlisted, onToggleWishlist }) => {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/listing/${listing_id}`);
  };

  return (
    <article className={styles.productCard} onClick={handleCardClick}>
      <div className={styles.productImageContainer}>
        <img src={image} alt={title} className={styles.productImage} />
        <button
          type="button"
          className={`${styles.wishlistButton} ${isWishlisted ? styles.wishlistActive : ''}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleWishlist(event);
          }}
          aria-label={isWishlisted ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'}
        >
          <FiHeart />
        </button>
      </div>
      <div className={styles.productContent}>
        <h4 className={styles.productTitle}>
          {title}
          {isVerified && (
            <span className={styles.verifiedLabel} title="Xe đã qua kiểm định chất lượng">
              <FiCheckCircle />
              Đã kiểm định
            </span>
          )}
        </h4>
        <p className={styles.productCondition}>
          Tình trạng: <span className={styles.conditionText}>{condition}</span>
        </p>
        <div className={styles.productFooter}>
          <p className={styles.productPrice}>{price}</p>
        </div>
      </div>
    </article>
  );
};

const ProductGrid: React.FC<ProductGridProps> = ({ filters, brands, materials, conditions, types, filtersOpen }) => {
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const OTHER_BRANDS_VALUE = "__other__";
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const featuredRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadWishlist();

    const loadListings = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (filters.q) {
          params.append("q", filters.q);
        }

        if (filters.status) {
          params.append("status", filters.status);
        }

        if (selectedType) {
          params.append("type", selectedType);
        }

        if (selectedBrand && selectedBrand !== OTHER_BRANDS_VALUE) {
          params.append("brand", selectedBrand);
        }

        if (selectedMaterial) {
          params.append("frame_material", selectedMaterial);
        }

        if (selectedCondition) {
          params.append("min_condition", selectedCondition);
        }

        const response = await fetch(`/api/listings?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Lỗi tải danh sách: ${response.status}`);
        }
        let data: ListingData[] = await response.json();
        if (selectedBrand === OTHER_BRANDS_VALUE) {
          const knownBrands = new Set(brands.map((brand) => brand.toLowerCase()));
          data = data.filter(
            (item) => !knownBrands.has((item.bike_details?.brand || "").toLowerCase())
          );
        }
        setListings(data);
      } catch (err) {
        console.error(err);
        setError("Không thể tải sản phẩm. Vui lòng thử lại sau.");
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [filters, selectedBrand, selectedMaterial, selectedCondition, selectedType, user]);

  const getPrimaryImage = (listing: ListingData) => {
    return listing.images?.[0] || listing.bike_details?.primary_image_url || "/assets/bike.png";
  };

  const getConditionLabel = (listing: ListingData) => {
    const condition = listing.bike_details?.condition_percent;
    return condition != null ? `${condition}%` : "Không rõ";
  };

  const getStoredWishlist = (): WishlistItem[] => {
    return readWishlist(user?.user_id ?? null);
  };

  const saveStoredWishlist = (items: WishlistItem[]) => {
    saveWishlist(user?.user_id ?? null, items);
  };

  const loadWishlist = () => {
    const items = getStoredWishlist();
    setWishlistIds(items.map((item) => item.listing_id));
  };

  const handleToggleWishlist = (event: React.MouseEvent<HTMLButtonElement>, listing: ListingData) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      router.push('/login');
      return;
    }

    const current = getStoredWishlist();
    const alreadySaved = current.some((item) => item.listing_id === listing.listing_id);
    const nextItems = alreadySaved
      ? current.filter((item) => item.listing_id !== listing.listing_id)
      : [
          ...current,
          {
            listing_id: listing.listing_id,
            title: listing.title,
            image: getPrimaryImage(listing),
            price: formatPrice(listing.price),
          },
        ];

    saveStoredWishlist(nextItems);
    setWishlistIds(nextItems.map((item) => item.listing_id));
  };

  const featuredListings = [...listings]
    .sort((a, b) => {
      const aPromoted = a.is_promoted ? 1 : 0;
      const bPromoted = b.is_promoted ? 1 : 0;
      if (aPromoted !== bPromoted) {
        return bPromoted - aPromoted;
      }
      return Number(b.price) - Number(a.price);
    })
    .slice(0, 20);

  useEffect(() => {
    setActiveFeaturedIndex(0);
  }, [featuredListings.length]);

  const [isCarouselHovering, setIsCarouselHovering] = useState(false);

  useEffect(() => {
    if (!featuredRef.current || featuredListings.length === 0) {
      return;
    }
    const container = featuredRef.current;
    const activeCard = container.querySelector(
      `[data-carousel-index="${activeFeaturedIndex}"]`
    ) as HTMLElement | null;
    if (!activeCard) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const cardRect = activeCard.getBoundingClientRect();
    const scrollLeft = container.scrollLeft + cardRect.left - containerRect.left - (containerRect.width - cardRect.width) / 2;
    container.scrollTo({ left: scrollLeft, behavior: "smooth" });
  }, [activeFeaturedIndex, featuredListings]);

  useEffect(() => {
    if (featuredListings.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      if (isCarouselHovering) {
        return;
      }
      setActiveFeaturedIndex((current) =>
        current >= featuredListings.length - 1 ? 0 : current + 1
      );
    }, 4500);

    return () => window.clearInterval(interval);
  }, [featuredListings.length, isCarouselHovering]);

  const handlePrevFeatured = () => {
    if (featuredListings.length === 0) {
      return;
    }
    setActiveFeaturedIndex((current) =>
      current <= 0 ? featuredListings.length - 1 : current - 1
    );
  };

  const handleNextFeatured = () => {
    if (featuredListings.length === 0) {
      return;
    }
    setActiveFeaturedIndex((current) =>
      current >= featuredListings.length - 1 ? 0 : current + 1
    );
  };

  const mainListings = [...listings].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  const resetFilters = () => {
    setSelectedBrand("");
    setSelectedMaterial("");
    setSelectedCondition("");
    setSelectedType("");
  };

  return (
    <section className={styles.productsSection}>
      <div className={styles.productsContainer}>
        <div className={styles.productsHeader}>
          <h3 className={styles.productsTitle}>Sản phẩm nổi bật</h3>
          <p className={styles.productsSubtitle}>Khám phá những chiếc xe đạp đã đăng bán trên hệ thống</p>
        </div>

        {filtersOpen && (
          <div className={styles.filterPanel}>
            <div className={styles.filterGroup}>
              <label htmlFor="brand-filter">Hãng</label>
              <select
                id="brand-filter"
                value={selectedBrand}
                onChange={(event) => setSelectedBrand(event.target.value)}
              >
                <option value="">Tất cả hãng</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
                <option value={OTHER_BRANDS_VALUE}>Các hãng khác</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="type-filter">Loại xe</label>
              <select
                id="type-filter"
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
              >
                <option value="">Tất cả loại</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="condition-filter">Độ mới</label>
              <select
                id="condition-filter"
                value={selectedCondition}
                onChange={(event) => setSelectedCondition(event.target.value)}
              >
                {conditions.map((condition) => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="material-filter">Chất liệu</label>
              <select
                id="material-filter"
                value={selectedMaterial}
                onChange={(event) => setSelectedMaterial(event.target.value)}
              >
                <option value="">Tất cả chất liệu</option>
                {materials.map((material) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterActions}>
              <button type="button" className={styles.filterButton} onClick={resetFilters}>
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}

        <div className={styles.featuredSection}>
          <div className={styles.sectionHeader}>
            <h3>Sản phẩm nổi bật</h3>
            <p>Các xe được ưu tiên hoặc có giá cao nhất.</p>
          </div>
          <div className={styles.featuredCarouselWrapper}>
            <button
              type="button"
              className={`${styles.carouselControl} ${styles.carouselPrev}`}
              onClick={handlePrevFeatured}
              aria-label="Trước"
            >
              ‹
            </button>
            <div
              className={styles.featuredCarousel}
              ref={featuredRef}
              onMouseEnter={() => setIsCarouselHovering(true)}
              onMouseLeave={() => setIsCarouselHovering(false)}
              onTouchStart={() => setIsCarouselHovering(true)}
              onTouchEnd={() => setIsCarouselHovering(false)}
            >
              {featuredListings.map((listing, index) => (
                <Link
                  key={listing.listing_id}
                  href={`/listing/${listing.listing_id}`}
                  className={`${styles.featuredCard} ${
                    index === activeFeaturedIndex ? styles.featuredCardActive : ""
                  }`}
                  data-carousel-index={index}
                >
                  <img
                    src={getPrimaryImage(listing)}
                    alt={listing.title}
                    className={styles.featuredImage}
                  />
                  <div className={styles.featuredInfo}>
                    <h4>{listing.title}</h4>
                    <p>{listing.bike_details?.brand || ""} {listing.bike_details?.model || ""}</p>
                    <p>{formatPrice(listing.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
            <button
              type="button"
              className={`${styles.carouselControl} ${styles.carouselNext}`}
              onClick={handleNextFeatured}
              aria-label="Tiếp"
            >
              ›
            </button>
          </div>
        </div>

        {loading ? (
          <p className={styles.productsLoading}>Đang tải sản phẩm...</p>
        ) : error ? (
          <p className={styles.productsError}>{error}</p>
        ) : mainListings.length === 0 ? (
          <p className={styles.productsEmpty}>Hiện chưa có sản phẩm phù hợp.</p>
        ) : (
          <div className={styles.productsGrid}>
            {mainListings.map((product) => (
              <ProductCard
                key={product.listing_id}
                listing_id={product.listing_id}
                image={getPrimaryImage(product)}
                title={product.title}
                condition={getConditionLabel(product)}
                price={formatPrice(product.price)}
                isPromoted={product.is_promoted}
                isVerified={product.is_verified}
                isWishlisted={wishlistIds.includes(product.listing_id)}
                onToggleWishlist={(event) => handleToggleWishlist(event, product)}
              />
            ))}
          </div>
        )}

        <div className={styles.productsFooter}>
          <button className={styles.productsViewAll}>Xem tất cả sản phẩm</button>
        </div>
      </div>
    </section>
  );
};

export default ProductGrid;
