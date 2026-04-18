'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import adminStyles from '../page.module.css';
import styles from '../bank-verifications/bank-verifications.module.css';

type DisputeItem = {
  dispute_id: number;
  order_id: number;
  order_status: string | null;
  listing_id: number | null;
  listing_title: string | null;
  description: string;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  opened_by?: { user_id: number; name: string };
  inspector?: { user_id: number; name: string; phone?: string; certificate_id?: string | null } | null;
};

type Inspector = {
  user_id: number;
  name: string;
  phone?: string;
  certificate_id?: string | null;
};

export default function AdminDisputesPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [areaFilter, setAreaFilter] = useState('');
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignInspectorId, setAssignInspectorId] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const token = resolveAccessToken(accessToken);

  const loadData = useCallback(async () => {
    setMessage(null);
    if (!token) {
      setMessage({ type: 'error', text: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [dRes, iRes] = await Promise.all([
        fetch('http://localhost:9999/api/orders/disputes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:9999/api/orders/disputes/inspectors', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dData = await dRes.json().catch(() => []);
      const iData = await iRes.json().catch(() => []);
      if (!dRes.ok) throw new Error(dData?.message || 'Không tải được tranh chấp.');
      if (!iRes.ok) throw new Error(iData?.message || 'Không tải được kiểm định viên.');
      const disputeList = Array.isArray(dData) ? dData : [];
      setDisputes(disputeList);
      const inspectorList = Array.isArray(iData) ? iData : [];
      setInspectors(inspectorList);
      const initialMap: Record<number, string> = {};
      disputeList.forEach((d: DisputeItem) => {
        if (d.inspector?.user_id) {
          initialMap[d.dispute_id] = String(d.inspector.user_id);
        }
      });
      setAssignInspectorId(initialMap);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Có lỗi khi tải dữ liệu.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    void loadData();
  }, [initialized, loggedIn, user, router, loadData]);

  const filteredInspectors = useMemo(() => {
    const needle = areaFilter.trim().toLowerCase();
    if (!needle) return inspectors;
    return inspectors.filter((i) =>
      `${i.name || ''} ${i.certificate_id || ''}`.toLowerCase().includes(needle)
    );
  }, [inspectors, areaFilter]);

  const handleAssign = async (disputeId: number) => {
    if (!token) return;
    const selected = assignInspectorId[disputeId];
    if (!selected) {
      setMessage({ type: 'error', text: 'Vui lòng chọn kiểm định viên trước khi phân công.' });
      return;
    }
    setAssigningId(disputeId);
    setMessage(null);
    try {
      const res = await fetch(`http://localhost:9999/api/orders/disputes/${disputeId}/assign-inspector`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inspector_id: Number(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Phân công thất bại.');
      setMessage({ type: 'success', text: `Đã phân công tranh chấp #${disputeId}.` });
      await loadData();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Phân công thất bại.',
      });
    } finally {
      setAssigningId(null);
    }
  };

  if (loading) {
    return (
      <div className={adminStyles.adminPage}>
        <AdminSidebar active="disputes" />
        <div className={styles.mainWrap}>
          <div className={styles.loading}>Đang tải tranh chấp…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={adminStyles.adminPage}>
      <AdminSidebar active="disputes" />
      <main className={styles.mainWrap}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <p className={styles.kicker}>Escrow Dispute</p>
              <h1 className={styles.title}>Phân công kiểm định viên xử lý tranh chấp</h1>
              <p className={styles.subtitle}>
                Admin nhận tranh chấp và phân công inspector theo khu vực (lọc theo tên hoặc mã chứng chỉ).
              </p>
            </div>
            <div className={styles.toolbar}>
              <span className={styles.countBadge}>
                Tổng tranh chấp: <strong>{disputes.length}</strong>
              </span>
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={() => {
                  setRefreshing(true);
                  void loadData();
                }}
                disabled={refreshing}
              >
                {refreshing ? 'Đang làm mới…' : 'Làm mới'}
              </button>
            </div>
          </div>
        </header>

        <section className={styles.panel}>
          <div style={{ marginBottom: '1rem' }}>
            <label className={styles.detailDt} htmlFor="areaSearch">
              Lọc khu vực inspector
            </label>
            <input
              id="areaSearch"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              placeholder="Ví dụ: Hà Nội, HCM, miền Trung..."
              style={{
                width: '100%',
                marginTop: '0.45rem',
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                padding: '0.55rem 0.75rem',
              }}
            />
          </div>

          {message ? (
            <div className={message.type === 'success' ? styles.inlineBannerSuccess : styles.inlineBannerError}>
              {message.text}
            </div>
          ) : null}

          {disputes.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>⚖️</div>
              <h2 className={styles.emptyTitle}>Chưa có tranh chấp</h2>
              <p className={styles.emptyText}>Khi buyer/seller tạo tranh chấp, dữ liệu sẽ hiển thị ở đây.</p>
            </div>
          ) : (
            <div className={styles.requestGrid}>
              {disputes.map((d) => (
                <article key={d.dispute_id} className={styles.requestCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardId}>Dispute #{d.dispute_id}</span>
                    <span className={styles.cardDate}>{d.status}</span>
                  </div>
                  <div className={styles.userBlock}>
                    <div className={styles.avatar}>!</div>
                    <div className={styles.userMeta}>
                      <p className={styles.userLabel}>Tin tranh chấp</p>
                      <p className={styles.userName}>{d.listing_title || `Listing #${d.listing_id || '-'}`}</p>
                      <p className={styles.userId}>Order #{d.order_id}</p>
                    </div>
                  </div>
                  <dl className={styles.details}>
                    <div className={styles.detailRow}>
                      <dt className={styles.detailDt}>Người mở</dt>
                      <dd className={styles.detailDd}>{d.opened_by?.name || `User #${d.opened_by?.user_id || '-'}`}</dd>
                    </div>
                    <div className={styles.detailRow}>
                      <dt className={styles.detailDt}>Mô tả</dt>
                      <dd className={styles.detailDd}>{d.description}</dd>
                    </div>
                    {d.inspector ? (
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Đã giao</dt>
                        <dd className={styles.detailDd}>
                          {d.inspector.name} ({d.inspector.certificate_id || 'Không có mã vùng'})
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {d.status !== 'RESOLVED' ? (
                    <div className={styles.cardActions}>
                      <select
                        value={assignInspectorId[d.dispute_id] || ''}
                        onChange={(e) =>
                          setAssignInspectorId((prev) => ({ ...prev, [d.dispute_id]: e.target.value }))
                        }
                        className={styles.btnReject}
                        style={{ minWidth: '170px' }}
                      >
                        <option value="">Chọn inspector</option>
                        {filteredInspectors.map((i) => (
                          <option key={i.user_id} value={i.user_id}>
                            {i.name} {i.certificate_id ? `- ${i.certificate_id}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        disabled={assigningId === d.dispute_id}
                        onClick={() => void handleAssign(d.dispute_id)}
                      >
                        {assigningId === d.dispute_id ? 'Đang phân công...' : 'Phân công'}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.inlineBannerSuccess}>Đã xử lý: {d.resolution_note || 'N/A'}</div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

