'use client';

import React, { useEffect, useState } from 'react';
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
  created_at: string;
}

export default function InspectorDashboard() {
  const { user, loggedIn, accessToken } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
        const response = await fetch('http://localhost:5000/api/listings/pending-inspection', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu kiểm định');
        }
        
        const data = await response.json();
        setListings(data);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingListings();
  }, [loggedIn, user, router, accessToken]);

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Đang tải dữ liệu...</div></div>;
  }

  if (error) {
    return <div className={styles.container}><div className={styles.error}>{error}</div></div>;
  }

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Khu Vực Kiểm Định</h1>
        <p className={styles.subtitle}>Danh sách xe đang chờ được xác thực chất lượng</p>
      </header>

      {listings.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#8b949e', marginTop: '50px' }}>
          <h2>Không có xe nào đang chờ kiểm duyệt lúc này.</h2>
        </div>
      ) : (
        <div className={styles.grid}>
          {listings.map((listing) => (
            <div key={listing.listing_id} className={styles.card}>
              <div className={styles.statusBadge}>CHỜ KIỂM ĐỊNH</div>
              
              <div className={styles.cardImageWrapper}>
                {listing.images && listing.images.length > 0 ? (
                  <img src={listing.images[0]} alt={listing.title} className={styles.cardImage} />
                ) : (
                  <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e'}}>No Image</div>
                )}
              </div>
              
              <h3 className={styles.cardTitle}>{listing.title}</h3>
              <div className={styles.cardPrice}>{formatPrice(listing.price)}</div>
              
              <div className={styles.cardDetails}>
                <p>Hãng: {listing.bike_details?.brand || 'N/A'}</p>
                <p>Loại xe: {listing.bike_details?.type || 'N/A'}</p>
                <p>Mới: {listing.bike_details?.condition_percent || 0}%</p>
                <p>Ngày tạo: {listing.created_at ? new Date(listing.created_at).toLocaleDateString('vi-VN') : 'N/A'}</p>
              </div>
              
              <Link href={`/inspector/${listing.listing_id}`} className={styles.inspectBtn}>
                Tiến Hành Kiểm Định
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
