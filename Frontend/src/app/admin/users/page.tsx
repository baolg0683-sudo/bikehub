'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { resolveAccessToken } from '../../../utils/accessToken';
import { AdminSidebar } from '../AdminSidebar';
import styles from '../page.module.css';

type AdminUser = {
  user_id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_url?: string | null;
  role: string;
  service_area?: string | null;
  status?: string | null;
  banned_permanent?: boolean;
  banned_until?: string | null;
  rating?: number;
  bikes_sold?: number;
  bikes_bought?: number;
};

function StarRating({ value }: { value: number }) {
  return (
    <span className={styles.starRating}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(value) ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
      <span className={styles.ratingNum}> {value.toFixed(1)}</span>
    </span>
  );
}

function statusLabel(u: AdminUser) {
  if (u.status === 'BANNED') {
    if (u.banned_permanent) return 'Bị khóa vĩnh viễn';
    if (u.banned_until) {
      const d = new Date(u.banned_until);
      return `Bị khóa đến ${d.toLocaleDateString('vi-VN')}`;
    }
    return 'Bị khóa';
  }
  return 'Hoạt động';
}

// ── Lock modal ────────────────────────────────────────────────────────────────
function LockModal({ onConfirm, onCancel, loading }: {
  onConfirm: (permanent: boolean, days: number) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [permanent, setPermanent] = useState(false);
  const [days, setDays] = useState(7);

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.lockModalBox} onClick={e => e.stopPropagation()}>
        <h3 className={styles.lockModalTitle}>Khóa tài khoản</h3>

        <div className={styles.lockOptions}>
          <label className={styles.lockOption}>
            <input
              type="radio"
              checked={!permanent}
              onChange={() => setPermanent(false)}
            />
            <span>Khóa có thời hạn</span>
          </label>
          <label className={styles.lockOption}>
            <input
              type="radio"
              checked={permanent}
              onChange={() => setPermanent(true)}
            />
            <span>Khóa vĩnh viễn</span>
          </label>
        </div>

        {!permanent && (
          <div className={styles.lockDaysRow}>
            <label>Số ngày khóa:</label>
            <input
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={e => setDays(Math.max(1, Number(e.target.value)))}
              className={styles.lockDaysInput}
            />
            <span>ngày</span>
          </div>
        )}

        <div className={styles.lockModalActions}>
          <button onClick={onCancel} className={styles.lockCancelBtn} disabled={loading}>
            Hủy
          </button>
          <button
            onClick={() => onConfirm(permanent, days)}
            className={styles.lockConfirmBtn}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : permanent ? 'Khóa vĩnh viễn' : `Khóa ${days} ngày`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User modal ────────────────────────────────────────────────────────────────
type UserModalProps = {
  user: AdminUser | null;
  onClose: () => void;
  onResetPassword: (userId: number) => Promise<string>;
  onLock: (userId: number, permanent: boolean, days: number) => Promise<void>;
  onUnlock: (userId: number) => Promise<void>;
  onUserUpdated: (updated: Partial<AdminUser> & { user_id: number }) => void;
};

function UserModal({ user, onClose, onResetPassword, onLock, onUnlock, onUserUpdated }: UserModalProps) {
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lockLoading, setLockLoading] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!user) return null;

  const isLocked = user.status === 'BANNED';
  const roleLabel = user.role === 'INSPECTOR' ? 'Kiểm định viên' : 'Người dùng';

  const handleReset = async () => {
    setResetting(true);
    setResetMsg(null);
    try {
      const msg = await onResetPassword(user.user_id);
      setResetMsg({ type: 'success', text: msg });
    } catch (e) {
      setResetMsg({ type: 'error', text: (e as Error).message || 'Lỗi khi đặt lại mật khẩu' });
    } finally {
      setResetting(false);
    }
  };

  const handleLockConfirm = async (permanent: boolean, days: number) => {
    setLockLoading(true);
    setActionMsg(null);
    try {
      await onLock(user.user_id, permanent, days);
      const newStatus = 'BANNED';
      const newUntil = permanent ? null : new Date(Date.now() + days * 86400000).toISOString();
      onUserUpdated({ user_id: user.user_id, status: newStatus, banned_permanent: permanent, banned_until: newUntil });
      setActionMsg({ type: 'success', text: permanent ? 'Đã khóa vĩnh viễn' : `Đã khóa ${days} ngày` });
    } catch (e) {
      setActionMsg({ type: 'error', text: (e as Error).message || 'Lỗi khi khóa tài khoản' });
    } finally {
      setLockLoading(false);
      setShowLockModal(false);
    }
  };

  const handleUnlock = async () => {
    setLockLoading(true);
    setActionMsg(null);
    try {
      await onUnlock(user.user_id);
      onUserUpdated({ user_id: user.user_id, status: 'ACTIVE', banned_permanent: false, banned_until: null });
      setActionMsg({ type: 'success', text: 'Đã mở khóa tài khoản' });
    } catch (e) {
      setActionMsg({ type: 'error', text: (e as Error).message || 'Lỗi khi mở khóa' });
    } finally {
      setLockLoading(false);
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2>Thông tin người dùng</h2>
            <button onClick={onClose} className={styles.closeButton}>×</button>
          </div>

          <div className={styles.modalBody}>
            {/* Profile */}
            <div className={styles.userProfile}>
              <div className={styles.userAvatar}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.full_name} />
                  : <span>{user.full_name?.charAt(0) || 'U'}</span>}
              </div>
              <div className={styles.userInfo}>
                <h3>{user.full_name}</h3>
                <p>{user.email}</p>
                <p>{user.phone}</p>
                <p>
                  <span className={user.role === 'INSPECTOR' ? styles.badgeInspector : styles.badgeUser}>
                    {roleLabel}
                  </span>
                </p>
                {user.service_area && <p>Khu vực: {user.service_area}</p>}
                <p>
                  Trạng thái:{' '}
                  <span className={isLocked ? styles.statusInactive : styles.statusActive}>
                    {statusLabel(user)}
                  </span>
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className={styles.userStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Điểm đánh giá</span>
                <span className={styles.statValue}><StarRating value={user.rating ?? 5} /></span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Đã bán</span>
                <span className={styles.statValue}>{user.bikes_sold ?? 0} xe</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Đã mua</span>
                <span className={styles.statValue}>{user.bikes_bought ?? 0} xe</span>
              </div>
            </div>

            {/* Messages */}
            {actionMsg && (
              <div className={`${styles.message} ${styles[actionMsg.type]}`}>{actionMsg.text}</div>
            )}
            {resetMsg && (
              <div className={`${styles.message} ${styles[resetMsg.type]}`}>{resetMsg.text}</div>
            )}

            {/* Actions */}
            <div className={styles.modalActions}>
              <button onClick={handleReset} disabled={resetting} className={styles.resetPasswordBtn}>
                {resetting ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </button>

              {isLocked ? (
                <button onClick={handleUnlock} disabled={lockLoading} className={styles.unlockBtn}>
                  {lockLoading ? 'Đang xử lý...' : '🔓 Mở khóa'}
                </button>
              ) : (
                <button onClick={() => setShowLockModal(true)} disabled={lockLoading} className={styles.lockBtn}>
                  Khóa tài khoản
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showLockModal && (
        <LockModal
          onConfirm={handleLockConfirm}
          onCancel={() => setShowLockModal(false)}
          loading={lockLoading}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { loggedIn, initialized, user, accessToken } = useAuth();
  const router = useRouter();
  const token = resolveAccessToken(accessToken);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'USER' | 'INSPECTOR'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    if (!initialized) return;
    if (!loggedIn) { router.push('/login'); return; }
    if (user?.role !== 'ADMIN') { router.push('/'); }
  }, [initialized, loggedIn, user, router]);

  useEffect(() => {
    if (!token || user?.role !== 'ADMIN') return;
    setLoading(true);
    fetch('http://localhost:9999/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e?.message || 'Lỗi')))
      .then(data => setUsers(data))
      .catch(err => setError(typeof err === 'string' ? err : 'Lỗi khi tải danh sách'))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter]);

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      return u.full_name?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t) || u.phone?.includes(t);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleResetPassword = async (userId: number): Promise<string> => {
    const res = await fetch(`http://localhost:9999/api/admin/users/${userId}/reset-password`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Lỗi');
    return data.message;
  };

  const handleLock = async (userId: number, permanent: boolean, days: number) => {
    const res = await fetch(`http://localhost:9999/api/admin/users/${userId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ permanent, days }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Lỗi');
  };

  const handleUnlock = async (userId: number) => {
    const res = await fetch(`http://localhost:9999/api/admin/users/${userId}/unlock`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Lỗi');
  };

  // Update user in list + selected after lock/unlock
  const handleUserUpdated = (updated: Partial<AdminUser> & { user_id: number }) => {
    setUsers(prev => prev.map(u => u.user_id === updated.user_id ? { ...u, ...updated } : u));
    setSelectedUser(prev => prev && prev.user_id === updated.user_id ? { ...prev, ...updated } : prev);
  };

  return (
    <div className={styles.adminPage}>
      <AdminSidebar active="users" />
      <section className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.pageLabel}>Người dùng</p>
            <h1 className={styles.pageTitle}>Quản lý người dùng</h1>
            <p className={styles.pageSubtitle}>Xem và quản lý thông tin người dùng và kiểm định viên</p>
          </div>
        </header>

        <div className={styles.filtersSection}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email, số điện thoại..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.roleFilterBtns}>
            {(['all', 'USER', 'INSPECTOR'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`${styles.roleFilterBtn} ${roleFilter === r ? styles.roleFilterBtnActive : ''}`}>
                {r === 'all' ? 'Tất cả' : r === 'USER' ? 'Người dùng' : 'Kiểm định viên'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.usersCard}>
          {loading ? <p>Đang tải...</p> : error ? <p className={styles.errorText}>{error}</p>
            : paginated.length === 0 ? <p>Không tìm thấy người dùng nào.</p> : (
              <>
                <div className={styles.usersGrid}>
                  {paginated.map(u => (
                    <div key={u.user_id} className={`${styles.userTile} ${u.status === 'BANNED' ? styles.userTileLocked : ''}`}
                      onClick={() => setSelectedUser(u)} style={{ cursor: 'pointer' }}>
                      <div className={styles.userAvatar}>
                        {u.avatar_url ? <img src={u.avatar_url} alt={u.full_name} /> : <span>{u.full_name?.charAt(0) || 'U'}</span>}
                      </div>
                      <div className={styles.userInfo}>
                        <p className={styles.userName}>{u.full_name}</p>
                        <p className={styles.userMeta}>
                          <span className={u.role === 'INSPECTOR' ? styles.badgeInspector : styles.badgeUser}>
                            {u.role === 'INSPECTOR' ? 'Kiểm định' : 'Người dùng'}
                          </span>
                          {u.status === 'BANNED' && (
                            <span className={styles.badgeLocked}>🔒 Bị khóa</span>
                          )}
                        </p>
                        <p className={styles.userMeta}>{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={styles.pageBtn}>‹ Trước</button>
                    <span className={styles.pageInfo}>Trang {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={styles.pageBtn}>Sau ›</button>
                  </div>
                )}
              </>
            )}
        </div>
      </section>

      <UserModal
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onResetPassword={handleResetPassword}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}
