'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import adminStyles from '../page.module.css';
import styles from '../bank-verifications/bank-verifications.module.css';

type TopUpRequest = {
  transaction_id: number;
  user_id: number;
  user_full_name?: string;
  fiat_amount: string;
  currency: string;
  type: string;
  status: string;
  transfer_note: string;
  bank_info: Record<string, unknown> | null;
  evidence_url: string | null;
  created_at: string | null;
};

const BANK_LABELS: Record<string, string> = {
  bank_name: 'Ngân hàng',
  account_number: 'Số tài khoản',
  account_holder: 'Chủ tài khoản',
};

function userInitials(name: string | undefined, userId: number): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return `U${userId % 100}`;
}

function formatBankRows(bank: Record<string, unknown> | null): { key: string; label: string; value: string }[] {
  if (!bank || typeof bank !== 'object') return [];
  return Object.entries(bank)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([key, value]) => ({
      key,
      label: BANK_LABELS[key] || key,
      value: String(value),
    }));
}

export default function AdminTopupRequestsPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadRequests = useCallback(async () => {
    setMessage(null);
    const token = resolveAccessToken(accessToken);
    if (!token) {
      setMessage({ type: 'error', text: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:9999/api/wallet/topup-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Không tải được yêu cầu nạp.');
      }
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Lỗi khi tải dữ liệu.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

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
    void loadRequests();
  }, [initialized, loggedIn, user, router, loadRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadRequests();
  };

  const handleAction = async (transactionId: number, action: 'approve' | 'reject') => {
    setActionLoading(transactionId);
    setMessage(null);

    const token = resolveAccessToken(accessToken);
    if (!token) {
      setMessage({ type: 'error', text: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      setActionLoading(null);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:9999/api/wallet/topup-requests/${transactionId}/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            admin_note: action === 'reject' ? 'Từ chối yêu cầu nạp' : 'Duyệt yêu cầu nạp',
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Đã có lỗi xảy ra.');
      }
      setMessage({ type: 'success', text: data.message || 'Cập nhật thành công.' });
      await loadRequests();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Lỗi khi thực hiện hành động.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className={adminStyles.adminPage}>
        <AdminSidebar active="topup" />
        <div className={styles.mainWrap}>
          <div className={styles.loading}>Đang tải yêu cầu nạp…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={adminStyles.adminPage}>
      <AdminSidebar active="topup" />

      <main className={styles.mainWrap}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <p className={styles.kicker}>Ví BikeCoin</p>
              <h1 className={styles.title}>Yêu cầu nạp tiền</h1>
              <p className={styles.subtitle}>
                Duyệt hoặc từ chối các lệnh nạp đang chờ. Đối chiếu nội dung chuyển khoản và số tiền với thông tin người dùng.
              </p>
            </div>
            <div className={styles.toolbar}>
              <span className={styles.countBadge}>
                Chờ xử lý: <strong>{requests.length}</strong>
              </span>
              <button type="button" className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? 'Đang làm mới…' : 'Làm mới danh sách'}
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div
            className={message.type === 'success' ? styles.inlineBannerSuccess : styles.inlineBannerError}
            role="status"
          >
            {message.text}
          </div>
        ) : null}

        <section className={styles.panel}>
          {requests.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden>
                💳
              </div>
              <h2 className={styles.emptyTitle}>Không có yêu cầu nạp chờ duyệt</h2>
              <p className={styles.emptyText}>
                Khi người dùng tạo lệnh nạp, yêu cầu sẽ xuất hiện tại đây. Dùng &quot;Làm mới danh sách&quot; để cập nhật.
              </p>
            </div>
          ) : (
            <div className={styles.requestGrid}>
              {requests.map((request) => {
                const displayName = (request.user_full_name || '').trim() || 'Chưa có tên hiển thị';
                const bankRows = formatBankRows(request.bank_info);
                return (
                  <article key={request.transaction_id} className={styles.requestCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardId}>#{request.transaction_id}</span>
                      <time className={styles.cardDate} dateTime={request.created_at || undefined}>
                        {request.created_at
                          ? new Date(request.created_at).toLocaleString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </time>
                    </div>

                    <div className={styles.userBlock}>
                      <div className={styles.avatar} aria-hidden>
                        {userInitials(request.user_full_name, request.user_id)}
                      </div>
                      <div className={styles.userMeta}>
                        <p className={styles.userLabel}>Người dùng</p>
                        <p className={styles.userName}>{displayName}</p>
                      </div>
                    </div>

                    <dl className={styles.details}>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Số tiền</dt>
                        <dd className={styles.detailDd}>
                          <span className={styles.fiatBig}>
                            {Number(request.fiat_amount).toLocaleString('vi-VN')} VNĐ
                          </span>{' '}
                          <span className={styles.currencyHint}>({request.currency})</span>
                        </dd>
                      </div>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Nội dung CK</dt>
                        <dd className={styles.detailDd}>
                          {request.transfer_note ? (
                            <span className={styles.transferNoteMono}>{request.transfer_note}</span>
                          ) : (
                            '—'
                          )}
                        </dd>
                      </div>
                      {bankRows.map((row) => (
                        <div key={row.key} className={styles.detailRow}>
                          <dt className={styles.detailDt}>{row.label}</dt>
                          <dd className={styles.detailDd}>
                            {row.key === 'account_number' ? (
                              <span className={styles.accountMono}>{row.value}</span>
                            ) : (
                              row.value
                            )}
                          </dd>
                        </div>
                      ))}
                      {request.evidence_url ? (
                        <div className={styles.detailRow}>
                          <dt className={styles.detailDt}>Minh chứng</dt>
                          <dd className={styles.detailDd}>
                            <a
                              href={request.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.evidenceLink}
                            >
                              Xem ảnh / file
                            </a>
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        disabled={actionLoading === request.transaction_id}
                        onClick={() => handleAction(request.transaction_id, 'approve')}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className={styles.btnReject}
                        disabled={actionLoading === request.transaction_id}
                        onClick={() => handleAction(request.transaction_id, 'reject')}
                      >
                        Từ chối
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
