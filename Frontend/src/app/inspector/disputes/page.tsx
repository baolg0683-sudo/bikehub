'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import styles from '../Inspector.module.css';

type DisputeItem = {
  dispute_id: number;
  order_id: number;
  listing_id: number | null;
  listing_title: string | null;
  description: string;
  status: string;
  resolution_note?: string | null;
  inspector?: { user_id: number; name: string } | null;
};

export default function InspectorDisputesPage() {
  const { user, loggedIn, initialized, accessToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const token = resolveAccessToken(accessToken);
    if (!token) {
      setError('Thiếu token đăng nhập.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:9999/api/orders/disputes/assigned', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.message || 'Không tải được tranh chấp được giao.');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'INSPECTOR') {
      router.push('/');
      return;
    }
    void load();
  }, [initialized, loggedIn, user, router, load]);

  const resolveDispute = async (disputeId: number) => {
    const note = (notes[disputeId] || '').trim();
    if (note.length < 10) {
      setError('Kết luận tối thiểu 10 ký tự.');
      return;
    }
    const token = resolveAccessToken(accessToken);
    if (!token) return;
    setSavingId(disputeId);
    setError('');
    try {
      const res = await fetch(`http://localhost:9999/api/orders/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolution_note: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Không lưu được kết luận.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Đang tải tranh chấp được giao...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Tranh chấp được phân công</h1>
        </div>
        <div className={styles.headerActions}>
          <Link href="/inspector" className={styles.toggleViewBtn}>
            Quay về kiểm định
          </Link>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.section}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8b949e', marginTop: '30px' }}>
            <h2>Chưa có tranh chấp được giao.</h2>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((d) => (
              <div key={d.dispute_id} className={styles.card}>
                <div className={styles.statusBadge}>{d.status}</div>
                <h3 className={styles.cardTitle}>{d.listing_title || `Listing #${d.listing_id || '-'}`}</h3>
                <div className={styles.cardDetails}>
                  <p>Dispute #{d.dispute_id}</p>
                  <p>Order #{d.order_id}</p>
                  <p>Mô tả: {d.description}</p>
                </div>

                {d.status === 'RESOLVED' ? (
                  <div className={styles.resultButton}>Đã xử lý: {d.resolution_note || 'N/A'}</div>
                ) : (
                  <div className={styles.actionRow}>
                    <textarea
                      value={notes[d.dispute_id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [d.dispute_id]: e.target.value }))}
                      placeholder="Nhập kết luận xử lý tranh chấp..."
                      style={{
                        width: '100%',
                        minHeight: '88px',
                        background: '#0d1117',
                        color: '#c9d1d9',
                        border: '1px solid #30363d',
                        borderRadius: '8px',
                        padding: '10px',
                      }}
                    />
                    <button
                      type="button"
                      className={styles.inspectBtn}
                      disabled={savingId === d.dispute_id}
                      onClick={() => void resolveDispute(d.dispute_id)}
                    >
                      {savingId === d.dispute_id ? 'Đang lưu...' : 'Xác nhận đã xử lý'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

