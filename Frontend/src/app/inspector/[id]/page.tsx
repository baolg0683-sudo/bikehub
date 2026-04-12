'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import styles from './Detail.module.css';

interface Bicycle {
  brand: string;
  model: string;
  type: string;
  condition_percent: number;
}

interface Listing {
  listing_id: number;
  title: string;
  price: string;
  status: string;
  bike_details: Bicycle;
  images: string[];
}

const CHECKLIST_ITEMS = [
  { id: 'frame', label: 'Khung sườn (Không nứt, gãy)' },
  { id: 'brakes', label: 'Hệ thống phanh (Hoạt động tốt, an toàn)' },
  { id: 'tires', label: 'Bánh xe & Lốp (Không bị thủng, vành không cong vênh)' },
  { id: 'chain', label: 'Dây xích & Líp (Chạy trơn tru, không gỉ sét nặng)' },
  { id: 'gears', label: 'Bộ truyền động (Chuyển số mượt mà)' },
  { id: 'overall', label: 'Đánh giá tổng thể trùng khớp với mô tả của người bán' },
];

export default function InspectorDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loggedIn, accessToken } = useAuth();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loggedIn) {
      router.push('/login');
      return;
    }
    
    if (user?.role !== 'INSPECTOR') {
      router.push('/');
      return;
    }

    const fetchListing = async () => {
      try {
        // We might not have a specific ID fetch for inspector, let's reuse the public one or filter
        const response = await fetch(`/api/listings`);
        const data = await response.json();
        const found = data.find((l: any) => l.listing_id === Number(id));
        if (found) {
          setListing(found);
        } else {
          alert('Không tìm thấy tin đăng!');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, loggedIn, router, user]);

  const handleCheck = (itemId: string) => {
    setChecks(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const allChecked = CHECKLIST_ITEMS.every(item => checks[item.id]);

  const handleApprove = async () => {
    if (!allChecked) return;
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/listings/${id}/inspect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'APPROVE' })
      });
      
      if (response.ok) {
        alert('Kiểm định thành công. Đã gắn tích xanh cho xe!');
        router.push('/inspector');
      } else {
        const err = await response.json();
        alert(`Lỗi: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi phê duyệt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Bạn có chắc chắn muốn TỪ CHỐI tin đăng này?')) return;
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/listings/${id}/inspect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'REJECT' })
      });
      
      if (response.ok) {
        alert('Đã từ chối tin đăng thành công.');
        router.push('/inspector');
      } else {
        const err = await response.json();
        alert(`Lỗi: ${err.message}`);
      }
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi từ chối');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className={styles.container}><div className={styles.loading}>Đang tải chi tiết xe...</div></div>;
  if (!listing) return <div className={styles.container}><div>Không tìm thấy xe.</div></div>;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <Link href="/inspector" className={styles.backLink}>← Quay lại danh sách</Link>
          <h1 className={styles.title}>Biên Bản Kiểm Định: {listing.title}</h1>
        </div>

        <div className={styles.card}>
          <div className={styles.grid}>
            <div>
              <div className={styles.label}>Hãng xe</div>
              <div className={styles.value}>{listing.bike_details?.brand || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Loại xe</div>
              <div className={styles.value}>{listing.bike_details?.type || 'Không xác định'}</div>
            </div>
            <div>
              <div className={styles.label}>Độ mới theo mô tả</div>
              <div className={styles.value}>{listing.bike_details?.condition_percent || 0}%</div>
            </div>
            <div>
              <div className={styles.label}>Giá niêm yết</div>
              <div className={styles.value}>{parseInt(listing.price).toLocaleString('vi-VN')} ₫</div>
            </div>
          </div>

          <div style={{marginTop: '20px'}}>
            {listing.images && listing.images.length > 0 && (
              <img 
                src={listing.images[0]} 
                alt="Xe" 
                style={{width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px'}} 
              />
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.checkTitle}>Checklist Đánh Giá Tình Trạng</h2>
          <div className={styles.checklist}>
            {CHECKLIST_ITEMS.map(item => (
              <div key={item.id} className={styles.checkItem} onClick={() => handleCheck(item.id)}>
                <input 
                  type="checkbox" 
                  className={styles.checkbox}
                  checked={!!checks[item.id]}
                  onChange={() => {}} // Handle by div click
                />
                <span className={styles.checkLabel}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button 
              className={styles.rejectBtn} 
              onClick={handleReject}
              disabled={isSubmitting}
            >
              Từ Chối Xe & Xoá Tin
            </button>
            <button 
              className={styles.approveBtn} 
              onClick={handleApprove}
              disabled={!allChecked || isSubmitting}
              title={!allChecked ? "Cần tick hết tất cả hạng mục trước khi duyệt" : ""}
            >
              ✓ PHÊ DUYỆT XE (ĐẠT CHUẨN)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
