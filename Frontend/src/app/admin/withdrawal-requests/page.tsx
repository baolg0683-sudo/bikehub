'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import adminStyles from '../page.module.css';
import styles from '../bank-verifications/bank-verifications.module.css';

type WithdrawalRequest = {
  transaction_id: number;
  user_id: number;
  user_full_name?: string;
  amount: string;
  fiat_amount?: string;
  currency: string;
  type: string;
  status: string;
  created_at: string | null;
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

export default function AdminWithdrawalRequestsPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
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
      const response = await fetch('http://localhost:9999/api/wallet/withdrawal-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Không tải được yêu cầu rút.');
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
    if (action === 'reject') {
      const ok = window.confirm('Từ chối yêu cầu rút này? Số dư ví của người dùng không đổi.');
      if (!ok) return;
    }

    setActionLoading(transactionId);
    setMessage(null);

    const token = resolveAccessToken(accessToken);
    if (!token) {
      setMessage({ type: 'error', text: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      setActionLoading(null);
      return;
    }

    const adminNote =
      action === 'reject'
        ? (window.prompt('Ghi chú từ chối (tùy chọn):') || '').trim() || 'Từ chối yêu cầu rút'
        : 'Duyệt yêu cầu rút';

    try {
      const response = await fetch(
        `http://localhost:9999/api/wallet/withdrawal-requests/${transactionId}/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ admin_note: adminNote }),
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
        <AdminSidebar active="withdrawal" />
        <div className={styles.mainWrap}>
          <div className={styles.loading}>Đang tải yêu cầu rút…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={adminStyles.adminPage}>
      <AdminSidebar active="withdrawal" />

      <main className={styles.mainWrap}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <p className={styles.kicker}>Ví BikeCoin</p>
              <h1 className={styles.title}>Yêu cầu rút tiền</h1>
              <p className={styles.subtitle}>
                Duyệt sau khi đã chuyển khoản thủ công cho người dùng; từ chối nếu chưa chuyển hoặc sai thông tin. 1 BikeCoin = 1 VNĐ.
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
                💸
              </div>
              <h2 className={styles.emptyTitle}>Không có yêu cầu rút chờ duyệt</h2>
              <p className={styles.emptyText}>
                Khi người dùng tạo lệnh rút, yêu cầu sẽ hiển thị tại đây. Dùng &quot;Làm mới danh sách&quot; để cập nhật.
              </p>
            </div>
          ) : (
            <div className={styles.requestGrid}>
              {requests.map((req) => {
                const displayName = (req.user_full_name || '').trim() || 'Chưa có tên hiển thị';
                const vnd = req.fiat_amount ?? req.amount;
                return (
                  <article key={req.transaction_id} className={styles.requestCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardId}>#{req.transaction_id}</span>
                      <time className={styles.cardDate} dateTime={req.created_at || undefined}>
                        {req.created_at
                          ? new Date(req.created_at).toLocaleString('vi-VN', {
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
                        {userInitials(req.user_full_name, req.user_id)}
                      </div>
                      <div className={styles.userMeta}>
                        <p className={styles.userLabel}>Người dùng</p>
                        <p className={styles.userName}>{displayName}</p>
                      </div>
                    </div>

                    <dl className={styles.details}>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Số rút</dt>
                        <dd className={styles.detailDd}>
                          <span className={styles.fiatBig}>
                            {Number(req.amount).toLocaleString('vi-VN')} BikeCoin
                          </span>
                        </dd>
                      </div>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}></dt>
                        <dd className={styles.detailDd}>
                          <span className={styles.accountMono}>
                            {Number(vnd).toLocaleString('vi-VN')} VNĐ
                          </span>
                          <span className={styles.currencyHint}> ({req.currency})</span>
                        </dd>
                      </div>
                    </dl>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        disabled={actionLoading === req.transaction_id}
                        onClick={() => handleAction(req.transaction_id, 'approve')}
                      >
                        Đã chuyển khoản — Duyệt
                      </button>
                      <button
                        type="button"
                        className={styles.btnReject}
                        disabled={actionLoading === req.transaction_id}
                        onClick={() => handleAction(req.transaction_id, 'reject')}
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
