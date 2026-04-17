'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiUser, FiLogOut, FiPlus, FiHome, FiDollarSign } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import styles from './AdminHeader.module.css';

const AdminHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { loggedIn, user, logout } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className={styles.adminHeader}>
      <div className={styles.headerInner}>
        <div className={styles.brandSection}>
          <Link href="/admin" className={styles.logoLink}>
            <span className={styles.logoMark}>BH</span>
            <div>
              <p className={styles.logoTitle}>BikeHub Admin</p>
              <p className={styles.logoSubtitle}>Quản trị hệ thống</p>
            </div>
          </Link>
        </div>

        <div className={styles.actionSection}>
          <Link href="/admin" className={`${styles.actionButton} ${pathname === '/admin' ? styles.active : ''}`}>
            <FiHome /> Dashboard
          </Link>
          <Link href="/admin/topup-requests" className={`${styles.actionButton} ${pathname === '/admin/topup-requests' ? styles.active : ''}`}>
            <FiDollarSign /> Yêu cầu nạp
          </Link>
          <Link href="/admin/add-inspector" className={styles.actionButton}>
            <FiPlus /> Thêm kiểm định
          </Link>
        </div>

        <div className={styles.userSection}>
          <div className={styles.userBadge}>
            <span>{user?.full_name?.charAt(0).toUpperCase() || 'A'}</span>
          </div>
          <div className={styles.userInfo}>
            <p>{user?.full_name || 'Admin'}</p>
            <span>{user?.email || 'admin@bikehub.test'}</span>
          </div>
          <button type="button" onClick={handleLogout} className={styles.logoutButton}>
            <FiLogOut />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
