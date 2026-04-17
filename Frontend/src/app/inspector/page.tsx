'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import styles from './Inspector.module.css';

interface Listing {
  listing_id: number;
  title: string;
  price: string;
  status: string;
  is_verified: boolean;
  images: string[];
  bike_details: any;
  seller_id: number;
  seller?: {
    seller_id: number;
    name: string;
    phone?: string;
  };
  inspection_notes?: string;
  assigned_inspector_id?: number;
  assigned_inspector?: {
    user_id: number;
    name: string;
    phone?: string;
  };
  created_at: string;
}

export default function InspectorDashboard() {
  const { user, loggedIn, initialized, accessToken } = useAuth();
  const router = useRouter();
  const [pendingListings, setPendingListings] = useState<Listing[]>([]);
  const [myInspections, setMyInspections] = useState<Listing[]>([]);
  const [areaFilter, setAreaFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAccepted, setShowAccepted] = useState(false);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!loggedIn) {
      router.push('/login');
      return;
    }

    if (user?.role !== 'INSPECTOR') {
      setError('Bạn không có quyền truy cập khu vực này.');
      setLoading(false);
      return;
    }

    const fetchPendingListings = async () => {
      try {
        const response = await fetch('/api/listings/pending-inspection', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu kiểm định');
        }

        const data = await response.json();
        setPendingListings(data);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra');
      }
    };

    const fetchAssignedInspections = async () => {
      try {
        const response = await fetch('/api/listings/pending-inspection?mine=true', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Không thể tải danh sách đã nhận');
        }

        const data = await response.json();
        setMyInspections(data);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra');
      }
    };

    Promise.all([fetchPendingListings(), fetchAssignedInspections()]).finally(() => setLoading(false));
  }, [loggedIn, user, router, accessToken, refreshKey, initialized]);

  const filteredPendingListings = useMemo(() => {
    if (areaFilter === 'all') return pendingListings;
    return pendingListings.filter((listing) => {
      const notes = (listing as any).inspection_notes || '';
      return notes.toLowerCase().includes(areaFilter.toLowerCase());
    });
  }, [areaFilter, pendingListings]);

  const filteredAssignedListings = useMemo(() => {
    if (areaFilter === 'all') return myInspections;
    return myInspections.filter((listing) => {
      const notes = (listing as any).inspection_notes || '';
      return notes.toLowerCase().includes(areaFilter.toLowerCase());
    });
  }, [areaFilter, myInspections]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const handleAssignInspection = async (listingId: number) => {
    if (!accessToken) {
      setError('Vui lòng đăng nhập để nhận kiểm định.');
      return;
    }

    setActionLoading(listingId);
    setError('');

    try {
      const response = await fetch(`/api/listings/${listingId}/assign-inspector`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Không thể nhận kiểm định');
      }

      setRefreshKey((prev) => prev + 1);
      router.push(`/inspector/${listingId}`);
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi nhận kiểm định');
    } finally {
      setActionLoading(null);
    }
  };

  const listingsToRender = showAccepted ? filteredAssignedListings : filteredPendingListings;
  const emptyText = showAccepted ? 'Bạn chưa nhận kiểm định nào.' : 'Không có xe chờ kiểm định.';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Khu Vực Kiểm Định</h1>
          <p className={styles.subtitle}>Danh sách xe đang chờ được xác thực chất lượng</p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.toggleViewBtn} ${!showAccepted ? styles.activeViewBtn : ''}`}
            onClick={() => setShowAccepted(false)}
          >
            Danh sách chờ
          </button>
          <button
            type="button"
            className={`${styles.toggleViewBtn} ${showAccepted ? styles.activeViewBtn : ''}`}
            onClick={() => setShowAccepted(true)}
          >
            Danh sách kiểm định
          </button>
        </div>
      </header>

      <div className={styles.filterRow}>
        <label htmlFor="areaFilter" className={styles.filterLabel}>
          Lọc khu vực
        </label>
        <select
          id="areaFilter"
          className={styles.filterSelect}
          value={areaFilter}
          onChange={(event) => setAreaFilter(event.target.value)}
        >
          <option value="all">Tất cả</option>
          <option value="tp hcm">TP. HCM</option>
          <option value="hà nội">Hà Nội</option>
          <option value="đà nẵng">Đà Nẵng</option>
          <option value="khác">Khác</option>
        </select>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>{showAccepted ? 'Danh sách kiểm định đã nhận' : 'Yêu cầu kiểm định chờ'}</h2>
            <p>
              {showAccepted
                ? 'Xe bạn đã nhận kiểm định, đang chờ xử lý.'
                : 'Danh sách xe người bán đã gửi yêu cầu, chưa được nhận kiểm định.'}
            </p>
          </div>
        </div>

        {listingsToRender.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8b949e', marginTop: '30px' }}>
            <h2>{emptyText}</h2>
          </div>
        ) : (
          <div className={styles.grid}>
            {listingsToRender.map((listing) => (
              <div key={listing.listing_id} className={styles.card}>
                <div className={styles.statusBadge}>{showAccepted ? 'ĐÃ NHẬN KIỂM ĐỊNH' : 'CHỜ KIỂM ĐỊNH'}</div>
                <div className={styles.cardImageWrapper}>
                  {listing.images && listing.images.length > 0 ? (
                    <img src={listing.images[0]} alt={listing.title} className={styles.cardImage} />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#8b949e',
                      }}
                    >
                      No Image
                    </div>
                  )}
                </div>

                <h3 className={styles.cardTitle}>{listing.title}</h3>
                <div className={styles.cardPrice}>{formatPrice(listing.price)}</div>

                <div className={styles.cardDetails}>
                  <p>Hãng: {listing.bike_details?.brand || 'N/A'}</p>
                  <p>Loại xe: {listing.bike_details?.type || 'N/A'}</p>
                  <p>
                    Điều kiện:{' '}
                    {typeof listing.bike_details?.condition_percent === 'number'
                      ? `${listing.bike_details.condition_percent}%`
                      : 'N/A'}
                  </p>
                  <p>
                    Ngày tạo:{' '}
                    {listing.created_at ? new Date(listing.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                </div>

                <div className={styles.cardActionWrapper}>
                  {showAccepted ? (
                    <Link href={`/inspector/${listing.listing_id}`} className={styles.inspectBtn}>
                      Xem chi tiết
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={styles.inspectBtn}
                      onClick={() => handleAssignInspection(listing.listing_id)}
                      disabled={actionLoading === listing.listing_id}
                    >
                      {actionLoading === listing.listing_id ? 'Đang nhận...' : 'Nhận kiểm định'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
