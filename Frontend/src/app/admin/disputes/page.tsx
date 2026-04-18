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
  dispute_area?: string | null;
  dispute_address?: string | null;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  opened_by?: { user_id: number; name: string };
  inspector?: { user_id: number; name: string; phone?: string; certificate_id?: string | null } | null;
  buyer?: { user_id: number; name: string; status?: string; reputation_score?: number; banned_until?: string | null; banned_permanent?: boolean } | null;
  seller?: { user_id: number; name: string; status?: string; reputation_score?: number; banned_until?: string | null; banned_permanent?: boolean } | null;
  penalty_proposal?: {
    target_scope?: 'BUYER' | 'SELLER' | 'BOTH' | null;
    actions?: Array<'LOCK_ACCOUNT' | 'DEDUCT_REPUTATION' | 'BAN_ACCOUNT'>;
    ban_duration_days?: number | null;
    ban_permanent?: boolean | null;
    reputation_deduction?: number | null;
    proposal_note?: string | null;
  } | null;
  admin_penalty_applied_at?: string | null;
  admin_penalty_note?: string | null;
};

type Inspector = {
  user_id: number;
  name: string;
  phone?: string;
  certificate_id?: string | null;
  service_area?: string | null;
};

type PenaltyAction = 'LOCK_ACCOUNT' | 'DEDUCT_REPUTATION';

export default function AdminDisputesPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [areaFilter, setAreaFilter] = useState('');
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [applyingPenaltyId, setApplyingPenaltyId] = useState<number | null>(null);
  const [assignInspectorId, setAssignInspectorId] = useState<Record<number, string>>({});
  const [penaltyDraft, setPenaltyDraft] = useState<
    Record<number, { target_scope: '' | 'BUYER' | 'SELLER' | 'BOTH'; actions: PenaltyAction[]; ban_permanent: boolean; ban_duration_days: string; reputation_deduction: string; admin_note: string }>
  >({});
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
      const draftMap: Record<number, { target_scope: '' | 'BUYER' | 'SELLER' | 'BOTH'; actions: PenaltyAction[]; ban_permanent: boolean; ban_duration_days: string; reputation_deduction: string; admin_note: string }> = {};
      disputeList.forEach((d: DisputeItem) => {
        const p = d.penalty_proposal;
        const proposalActions = (p?.actions || []).map((a) => (a === 'BAN_ACCOUNT' ? 'LOCK_ACCOUNT' : a));
        draftMap[d.dispute_id] = {
          target_scope: (p?.target_scope || '') as '' | 'BUYER' | 'SELLER' | 'BOTH',
          actions: proposalActions.filter((a) => a === 'LOCK_ACCOUNT' || a === 'DEDUCT_REPUTATION') as PenaltyAction[],
          ban_permanent: Boolean(p?.ban_permanent),
          ban_duration_days: p?.ban_duration_days ? String(p.ban_duration_days) : '',
          reputation_deduction: p?.reputation_deduction ? String(p.reputation_deduction) : '',
          admin_note: '',
        };
      });
      setPenaltyDraft(draftMap);
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
      `${i.service_area || ''} ${i.name || ''} ${i.certificate_id || ''}`.toLowerCase().includes(needle)
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

  const updateDraft = (
    disputeId: number,
    updater: (prev: {
      target_scope: '' | 'BUYER' | 'SELLER' | 'BOTH';
      actions: PenaltyAction[];
      ban_permanent: boolean;
      ban_duration_days: string;
      reputation_deduction: string;
      admin_note: string;
    }) => {
      target_scope: '' | 'BUYER' | 'SELLER' | 'BOTH';
      actions: PenaltyAction[];
      ban_permanent: boolean;
      ban_duration_days: string;
      reputation_deduction: string;
      admin_note: string;
    }
  ) => {
    setPenaltyDraft((prev) => ({
      ...prev,
      [disputeId]: updater(
        prev[disputeId] || {
          target_scope: '',
          actions: [],
          ban_permanent: false,
          ban_duration_days: '',
          reputation_deduction: '',
          admin_note: '',
        }
      ),
    }));
  };

  const applyPenalty = async (disputeId: number) => {
    if (!token) return;
    const draft = penaltyDraft[disputeId];
    if (!draft) return;
    setApplyingPenaltyId(disputeId);
    setMessage(null);
    try {
      const res = await fetch(`http://localhost:9999/api/orders/disputes/${disputeId}/apply-penalty`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_scope: draft.target_scope || null,
          actions: draft.actions,
          ban_permanent: draft.ban_permanent,
          ban_duration_days: draft.ban_duration_days ? Number(draft.ban_duration_days) : null,
          reputation_deduction: draft.reputation_deduction ? Number(draft.reputation_deduction) : null,
          admin_note: draft.admin_note || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Áp dụng án phạt thất bại.');
      setMessage({ type: 'success', text: `Đã áp dụng án phạt cho tranh chấp #${disputeId}.` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Áp dụng án phạt thất bại.' });
    } finally {
      setApplyingPenaltyId(null);
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
                    {d.dispute_area ? (
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Khu vực</dt>
                        <dd className={styles.detailDd}>{d.dispute_area}</dd>
                      </div>
                    ) : null}
                    {d.dispute_address ? (
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Địa chỉ</dt>
                        <dd className={styles.detailDd}>{d.dispute_address}</dd>
                      </div>
                    ) : null}
                    {d.inspector ? (
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Đã giao</dt>
                        <dd className={styles.detailDd}>
                          {d.inspector.name} ({d.inspector.certificate_id || 'Không có mã vùng'})
                        </dd>
                      </div>
                    ) : null}
                    {d.buyer ? (
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Người mua</dt>
                        <dd className={styles.detailDd}>
                          {d.buyer.name} · {d.buyer.status || 'ACTIVE'} · ⭐ {Number(d.buyer.reputation_score || 0).toFixed(1)}
                        </dd>
                      </div>
                    ) : null}
                    {d.seller ? (
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Người bán</dt>
                        <dd className={styles.detailDd}>
                          {d.seller.name} · {d.seller.status || 'ACTIVE'} · ⭐ {Number(d.seller.reputation_score || 0).toFixed(1)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {d.status !== 'RESOLVED' ? (
                    <div className={styles.cardActions}>
                      {d.dispute_area ? (
                        <button
                          type="button"
                          className={styles.btnReject}
                          onClick={() => setAreaFilter(d.dispute_area || '')}
                          style={{ minWidth: '170px' }}
                        >
                          Lọc khu vực: {d.dispute_area}
                        </button>
                      ) : null}
                      <select
                        value={assignInspectorId[d.dispute_id] || ''}
                        onChange={(e) =>
                          setAssignInspectorId((prev) => ({ ...prev, [d.dispute_id]: e.target.value }))
                        }
                        className={styles.btnReject}
                        style={{ minWidth: '170px' }}
                      >
                        <option value="">Chọn inspector</option>
                        {filteredInspectors
                          .filter((i) => !d.dispute_area || (i.service_area || '').toLowerCase() === (d.dispute_area || '').toLowerCase())
                          .map((i) => (
                          <option key={i.user_id} value={i.user_id}>
                            {i.name} {i.service_area ? `- ${i.service_area}` : ''} {i.certificate_id ? `(${i.certificate_id})` : ''}
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
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <div className={styles.inlineBannerSuccess}>Đã xử lý: {d.resolution_note || 'N/A'}</div>
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', background: '#f8fafc' }}>
                        <strong style={{ display: 'block', marginBottom: '8px' }}>Áp dụng án phạt</strong>
                        <select
                          value={penaltyDraft[d.dispute_id]?.target_scope || ''}
                          onChange={(e) =>
                            updateDraft(d.dispute_id, (p) => ({ ...p, target_scope: e.target.value as '' | 'BUYER' | 'SELLER' | 'BOTH' }))
                          }
                          style={{ width: '100%', marginBottom: '8px' }}
                        >
                          <option value="">Chọn đối tượng</option>
                          <option value="BUYER">Người mua</option>
                          <option value="SELLER">Người bán</option>
                          <option value="BOTH">Cả 2 bên</option>
                        </select>
                        <label style={{ display: 'block' }}>
                          <input
                            type="checkbox"
                            checked={(penaltyDraft[d.dispute_id]?.actions || []).includes('LOCK_ACCOUNT')}
                            onChange={(e) =>
                              updateDraft(d.dispute_id, (p) => ({
                                ...p,
                                actions: e.target.checked
                                  ? ([...new Set([...p.actions, 'LOCK_ACCOUNT'])] as PenaltyAction[])
                                  : (p.actions.filter((a) => a !== 'LOCK_ACCOUNT') as PenaltyAction[]),
                                ban_permanent: e.target.checked ? p.ban_permanent : false,
                                ban_duration_days: e.target.checked ? p.ban_duration_days : '',
                              }))
                            }
                          />{' '}
                          Khóa tài khoản
                        </label>
                        {(penaltyDraft[d.dispute_id]?.actions || []).includes('LOCK_ACCOUNT') ? (
                          <div style={{ display: 'flex', gap: '8px', margin: '6px 0' }}>
                            <label>
                              <input
                                type="checkbox"
                                checked={!!penaltyDraft[d.dispute_id]?.ban_permanent}
                                onChange={(e) =>
                                  updateDraft(d.dispute_id, (p) => ({
                                    ...p,
                                    ban_permanent: e.target.checked,
                                    ban_duration_days: e.target.checked ? '' : p.ban_duration_days,
                                  }))
                                }
                              />{' '}
                              Khóa vĩnh viễn
                            </label>
                            {!penaltyDraft[d.dispute_id]?.ban_permanent ? (
                              <input
                                value={penaltyDraft[d.dispute_id]?.ban_duration_days || ''}
                                onChange={(e) => updateDraft(d.dispute_id, (p) => ({ ...p, ban_duration_days: e.target.value }))}
                                placeholder="Số ngày khóa"
                              />
                            ) : null}
                          </div>
                        ) : null}
                        <label style={{ display: 'block' }}>
                          <input
                            type="checkbox"
                            checked={(penaltyDraft[d.dispute_id]?.actions || []).includes('DEDUCT_REPUTATION')}
                            onChange={(e) =>
                              updateDraft(d.dispute_id, (p) => ({
                                ...p,
                                actions: e.target.checked
                                  ? ([...new Set([...p.actions, 'DEDUCT_REPUTATION'])] as PenaltyAction[])
                                  : (p.actions.filter((a) => a !== 'DEDUCT_REPUTATION') as PenaltyAction[]),
                              }))
                            }
                          />{' '}
                          Trừ điểm sao uy tín
                        </label>
                        {(penaltyDraft[d.dispute_id]?.actions || []).includes('DEDUCT_REPUTATION') ? (
                          <input
                            value={penaltyDraft[d.dispute_id]?.reputation_deduction || ''}
                            onChange={(e) => updateDraft(d.dispute_id, (p) => ({ ...p, reputation_deduction: e.target.value }))}
                            placeholder="Mức trừ sao (ví dụ 1)"
                            style={{ width: '100%', marginTop: '6px' }}
                          />
                        ) : null}
                        <textarea
                          value={penaltyDraft[d.dispute_id]?.admin_note || ''}
                          onChange={(e) => updateDraft(d.dispute_id, (p) => ({ ...p, admin_note: e.target.value }))}
                          placeholder="Ghi chú của admin (tùy chọn)"
                          style={{ width: '100%', minHeight: '64px', marginTop: '8px' }}
                        />
                        <button
                          type="button"
                          className={styles.btnApprove}
                          onClick={() => void applyPenalty(d.dispute_id)}
                          disabled={applyingPenaltyId === d.dispute_id}
                          style={{ marginTop: '8px' }}
                        >
                          {applyingPenaltyId === d.dispute_id ? 'Đang áp dụng...' : 'Áp dụng án phạt'}
                        </button>
                        {d.admin_penalty_applied_at ? (
                          <div style={{ marginTop: '6px', color: '#166534' }}>
                            Đã áp dụng lúc: {new Date(d.admin_penalty_applied_at).toLocaleString('vi-VN')}
                            {d.admin_penalty_note ? ` · Ghi chú: ${d.admin_penalty_note}` : ''}
                          </div>
                        ) : null}
                      </div>
                    </div>
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

