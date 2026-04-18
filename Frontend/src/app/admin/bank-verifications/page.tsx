'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import adminStyles from '../page.module.css';
import styles from './bank-verifications.module.css';

interface BankVerification {
  bank_info_id: number;
  user_id: number;
  user_full_name?: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status?: string;
  created_at: string;
}

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

export default function BankVerificationsPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const [verifications, setVerifications] = useState<BankVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchVerifications = useCallback(async () => {
    try {
      setError('');
      const token = resolveAccessToken(accessToken);
      if (!token) {
        setError('Chưa đăng nhập hoặc thiếu token');
        return;
      }
      const response = await fetch('http://localhost:9999/api/bank/pending-verifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setVerifications(Array.isArray(data) ? data : []);
      } else {
        setError('Không thể tải danh sách xác nhận ngân hàng');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi mạng');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn || user?.role !== 'ADMIN') {
      router.push('/login');
      return;
    }
    fetchVerifications();
  }, [initialized, loggedIn, user, router, fetchVerifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVerifications();
  };

  const handleVerify = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xác nhận ngân hàng này?')) return;
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) return;
      const response = await fetch(`http://localhost:9999/api/bank/verifications/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        await fetchVerifications();
      } else {
        alert('Lỗi khi xác nhận');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    try {
      const token = resolveAccessToken(accessToken);
      if (!token) return;
      const response = await fetch(`http://localhost:9999/api/bank/verifications/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admin_note: reason }),
      });
      if (response.ok) {
        await fetchVerifications();
      } else {
        alert('Lỗi khi từ chối');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi');
    }
  };

  if (loading) {
    return (
      <div className={adminStyles.adminPage}>
        <AdminSidebar active="bank" />
        <div className={styles.mainWrap}>
          <div className={styles.loading}>Đang tải danh sách…</div>
        </div>
      </div>
    );
  }

  if (error && verifications.length === 0 && !loading) {
    return (
      <div className={adminStyles.adminPage}>
        <AdminSidebar active="bank" />
        <div className={styles.mainWrap}>
          <div className={styles.errorBox}>
            <p className={styles.errorMessage}>{error}</p>
            <button
              type="button"
              className={`${styles.refreshBtn} ${styles.errorRetryBtn}`}
              onClick={() => {
                setError('');
                setLoading(true);
                void fetchVerifications();
              }}
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={adminStyles.adminPage}>
      <AdminSidebar active="bank" />

      <main className={styles.mainWrap}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <p className={styles.kicker}>Duyệt tài khoản</p>
              <h1 className={styles.title}>Xác nhận ngân hàng người dùng</h1>
              <p className={styles.subtitle}>
                Kiểm tra thông tin STK và chủ tài khoản trước khi duyệt. Sau khi xác nhận, người dùng có thể nạp và rút qua ví.
              </p>
            </div>
            <div className={styles.toolbar}>
              <span className={styles.countBadge}>
                Chờ xử lý: <strong>{verifications.length}</strong>
              </span>
              <button type="button" className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? 'Đang làm mới…' : 'Làm mới danh sách'}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        ) : null}

        <section className={styles.panel}>
          {verifications.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon} aria-hidden>
                🏦
              </div>
              <h2 className={styles.emptyTitle}>Không có yêu cầu chờ duyệt</h2>
              <p className={styles.emptyText}>
                Khi người dùng gửi liên kết ngân hàng mới, yêu cầu sẽ hiển thị tại đây. Bạn có thể bấm &quot;Làm mới danh sách&quot; để cập nhật.
              </p>
            </div>
          ) : (
            <div className={styles.requestGrid}>
              {verifications.map((v) => {
                const displayName = (v.user_full_name || '').trim() || 'Chưa có tên hiển thị';
                return (
                  <article key={v.bank_info_id} className={styles.requestCard}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardId}>#{v.bank_info_id}</span>
                      <time className={styles.cardDate} dateTime={v.created_at}>
                        {new Date(v.created_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>

                    <div className={styles.userBlock}>
                      <div className={styles.avatar} aria-hidden>
                        {userInitials(v.user_full_name, v.user_id)}
                      </div>
                      <div className={styles.userMeta}>
                        <p className={styles.userLabel}>Người dùng</p>
                        <p className={styles.userName}>{displayName}</p>
                      </div>
                    </div>

                    <dl className={styles.details}>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Ngân hàng</dt>
                        <dd className={styles.detailDd}>{v.bank_name}</dd>
                      </div>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Số tài khoản</dt>
                        <dd className={styles.detailDd}>
                          <span className={styles.accountMono}>{v.account_number}</span>
                        </dd>
                      </div>
                      <div className={styles.detailRow}>
                        <dt className={styles.detailDt}>Chủ TK</dt>
                        <dd className={styles.detailDd}>{v.account_holder}</dd>
                      </div>
                    </dl>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        onClick={() => handleVerify(v.bank_info_id)}
                      >
                        Duyệt
                      </button>
                      <button
                        type="button"
                        className={styles.btnReject}
                        onClick={() => handleReject(v.bank_info_id)}
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
