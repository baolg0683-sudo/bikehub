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

type UserModalProps = {
  user: AdminUser | null;
  onClose: () => void;
  onResetPassword: (userId: number) => Promise<string>;
};

function UserModal({ user, onClose, onResetPassword }: UserModalProps) {
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  if (!user) return null;

  const roleLabel = user.role === 'INSPECTOR' ? 'Kiểm định viên' : 'Người dùng';

  const handleReset = async () => {
    setResetting(true);
    setResetMsg('');
    try {
      const msg = await onResetPassword(user.user_id);
      setResetMsg(msg);
    } catch {
      setResetMsg('Lỗi khi đặt lại mật khẩu');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Thông tin người dùng</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.userProfile}>
            <div className={styles.userAvatar}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} />
              ) : (
                <span>{user.full_name?.charAt(0) || 'U'}</span>
              )}
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
              {user.status && (
                <p>
                  Trạng thái:{' '}
                  <span className={user.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive}>
                    {user.status === 'ACTIVE' ? 'Hoạt động' : user.status}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className={styles.userStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Điểm đánh giá</span>
              <span className={styles.statValue}>
                <StarRating value={user.rating ?? 5} />
              </span>
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

          {resetMsg && (
            <div className={`${styles.message} ${styles.success}`} style={{ marginBottom: '1rem' }}>
              {resetMsg}
            </div>
          )}

          <div className={styles.modalActions}>
            <button onClick={handleReset} disabled={resetting} className={styles.resetPasswordBtn}>
              {resetting ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    fetch('http://localhost:9999/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e?.message || 'Lỗi tải dữ liệu')))
      .then(data => setUsers(data))
      .catch(err => setError(typeof err === 'string' ? err : 'Lỗi khi tải danh sách người dùng'))
      .finally(() => setLoading(false));
  }, [token, user?.role]);

  // Filtered + searched list
  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      return (
        u.full_name?.toLowerCase().includes(t) ||
        u.email?.toLowerCase().includes(t) ||
        u.phone?.includes(t)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, roleFilter]);

  const handleResetPassword = async (userId: number): Promise<string> => {
    if (!token) throw new Error('No token');
    const res = await fetch(`http://localhost:9999/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Lỗi');
    return data.message || 'Mật khẩu đã được đặt lại';
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.roleFilterBtns}>
            {(['all', 'USER', 'INSPECTOR'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`${styles.roleFilterBtn} ${roleFilter === r ? styles.roleFilterBtnActive : ''}`}
              >
                {r === 'all' ? 'Tất cả' : r === 'USER' ? 'Người dùng' : 'Kiểm định viên'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.usersCard}>
          {loading ? (
            <p>Đang tải danh sách người dùng...</p>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : paginated.length === 0 ? (
            <p>Không tìm thấy người dùng nào.</p>
          ) : (
            <>
              <div className={styles.usersGrid}>
                {paginated.map(u => (
                  <div
                    key={u.user_id}
                    className={styles.userTile}
                    onClick={() => setSelectedUser(u)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.userAvatar}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.full_name} />
                      ) : (
                        <span>{u.full_name?.charAt(0) || 'U'}</span>
                      )}
                    </div>
                    <div className={styles.userInfo}>
                      <p className={styles.userName}>{u.full_name}</p>
                      <p className={styles.userMeta}>
                        <span className={u.role === 'INSPECTOR' ? styles.badgeInspector : styles.badgeUser}>
                          {u.role === 'INSPECTOR' ? 'Kiểm định' : 'Người dùng'}
                        </span>
                      </p>
                      <p className={styles.userMeta}>{u.email}</p>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={styles.pageBtn}
                  >
                    ‹ Trước
                  </button>
                  <span className={styles.pageInfo}>Trang {currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={styles.pageBtn}
                  >
                    Sau ›
                  </button>
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
      />
    </div>
  );
}
