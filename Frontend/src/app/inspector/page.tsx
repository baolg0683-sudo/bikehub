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
  const [pendingApprovalListings, setPendingApprovalListings] = useState<Listing[]>([]);
  const [historyListings, setHistoryListings] = useState<Listing[]>([]);
  const [viewMode, setViewMode] = useState<'pending' | 'approval' | 'history'>('pending');
  const [areaFilter, setAreaFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

    const fetchPendingApprovalListings = async () => {
      try {
        const response = await fetch('/api/listings/pending-approval', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Không thể tải danh sách chờ duyệt');
        }

        const data = await response.json();
        setPendingApprovalListings(data);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra');
      }
    };

    const fetchHistoryListings = async () => {
      try {
        // Fetch inspection history
        const inspectionResponse = await fetch('/api/listings/inspector-history?type=inspection', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        // Fetch approval history  
        const approvalResponse = await fetch('/api/listings/inspector-history?type=approval', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        const inspectionData = inspectionResponse.ok ? await inspectionResponse.json() : [];
        const approvalData = approvalResponse.ok ? await approvalResponse.json() : [];

        // Mark the type for filtering
        const inspectionListings = inspectionData.map((item: any) => ({ ...item, historyType: 'inspection' }));
        const approvalListings = approvalData.map((item: any) => ({ ...item, historyType: 'approval' }));

        setHistoryListings([...inspectionListings, ...approvalListings]);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra khi tải lịch sử');
      }
    };

    Promise.all([fetchPendingListings(), fetchPendingApprovalListings(), fetchHistoryListings()]).finally(() => setLoading(false));
  }, [loggedIn, user, router, accessToken, refreshKey, initialized]);

  const filteredPendingListings = useMemo(() => {
    if (areaFilter === 'all') return pendingListings;
    return pendingListings.filter((listing) => {
      const notes = (listing as any).inspection_notes || '';
      return notes.toLowerCase().includes(areaFilter.toLowerCase());
    });
  }, [areaFilter, pendingListings]);

  const filteredPendingApprovalListings = useMemo(() => {
    if (areaFilter === 'all') return pendingApprovalListings;
    return pendingApprovalListings.filter((listing) => {
      const notes = (listing as any).inspection_notes || '';
      return notes.toLowerCase().includes(areaFilter.toLowerCase());
    });
  }, [areaFilter, pendingApprovalListings]);

  const filteredHistoryListings = useMemo(() => {
    if (typeFilter === 'all') return historyListings;
    return historyListings.filter((listing) => (listing as any).historyType === typeFilter);
  }, [typeFilter, historyListings]);

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

  const listingsToRender =
    viewMode === 'approval'
      ? filteredPendingApprovalListings
      : viewMode === 'history'
      ? filteredHistoryListings
      : filteredPendingListings;
  const emptyText =
    viewMode === 'approval'
      ? 'Không có xe chờ duyệt.'
      : viewMode === 'history'
      ? 'Bạn chưa xử lý xe nào.'
      : 'Không có xe chờ kiểm định.';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Khu Vực Kiểm Định</h1>
          {user?.service_area && (
            <p style={{ fontSize: '0.95rem', color: '#64748b', marginTop: '0.25rem' }}>
              Khu vực hoạt động: <strong>{user.service_area}</strong>
            </p>
          )}
        </div>

        <div className={styles.headerActions}>
          <Link href="/inspector/disputes" className={styles.toggleViewBtn}>
            Tranh chấp được giao
          </Link>
          <button
            type="button"
            className={`${styles.toggleViewBtn} ${viewMode === 'pending' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('pending')}
          >
            Danh sách kiểm định
          </button>
          <button
            type="button"
            className={`${styles.toggleViewBtn} ${viewMode === 'approval' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('approval')}
          >
            Danh sách chờ duyệt
          </button>
          <button
            type="button"
            className={`${styles.toggleViewBtn} ${viewMode === 'history' ? styles.activeViewBtn : ''}`}
            onClick={() => setViewMode('history')}
          >
            Lịch sử
          </button>
        </div>
      </header>

      <div className={styles.filterRow}>
        {viewMode === 'history' ? (
          <>
            <label htmlFor="typeFilter" className={styles.filterLabel}>
              Loại xử lý
            </label>
            <select
              id="typeFilter"
              className={styles.filterSelect}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="inspection">Tin kiểm định</option>
              <option value="approval">Tin kiểm duyệt</option>
            </select>
          </>
        ) : viewMode === 'pending' ? (
          <>
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
            </select>
          </>
        ) : null}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
            <div>
              <h2>
                {viewMode === 'history'
                  ? 'Lịch sử'
                  : viewMode === 'approval'
                  ? 'Danh sách chờ duyệt'
                  : 'Yêu cầu kiểm định chờ'}
              </h2>
              <p>
                {viewMode === 'history'
                  ? 'Các xe bạn đã xử lý kiểm định và duyệt tin.'
                  : viewMode === 'approval'
                  ? 'Các xe đăng tin chờ duyệt, inspector có thể xem và chấp nhận hoặc từ chối.'
                  : 'Danh sách xe người bán đã gửi yêu cầu kiểm định chưa được nhận.'}
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
                <div className={styles.statusBadge}>
                  {viewMode === 'history'
                    ? ((listing as any).historyType === 'inspection' ? 'ĐÃ KIỂM ĐỊNH' : 'ĐÃ DUYỆT TIN')
                    : viewMode === 'approval'
                    ? 'CHỜ DUYỆT'
                    : 'CHỜ KIỂM ĐỊNH'}
                </div>
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
                  {viewMode === 'pending' ? (
                    <button
                      type="button"
                      className={styles.inspectBtn}
                      onClick={() => handleAssignInspection(listing.listing_id)}
                      disabled={actionLoading === listing.listing_id}
                    >
                      {actionLoading === listing.listing_id ? 'Đang nhận...' : 'Nhận kiểm định'}
                    </button>
                  ) : (
                    <Link href={`/inspector/${listing.listing_id}`} className={styles.inspectBtn}>
                      {viewMode === 'approval' ? 'Kiểm tra' : 'Xem chi tiết'}
                    </Link>
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
