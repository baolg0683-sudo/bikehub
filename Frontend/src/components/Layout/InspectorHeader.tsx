'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FiLogOut, FiCheckSquare, FiHome } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import styles from './InspectorHeader.module.css';

const InspectorHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className={styles.inspectorHeader}>
      <div className={styles.headerInner}>
        <div className={styles.brandSection}>
          <Link href="/inspector" className={styles.logoLink}>
            <span className={styles.logoMark}>KI</span>
            <div>
              <p className={styles.logoTitle}>BikeHub Kiểm Định</p>
              <p className={styles.logoSubtitle}>Giao diện chuyên viên kiểm định</p>
            </div>
          </Link>
        </div>

        <nav className={styles.navSection}>
          <Link href="/inspector" className={`${styles.navLink} ${pathname === '/inspector' ? styles.active : ''}`}>
            <FiHome className={styles.navIcon} /> Danh sách kiểm định
          </Link>
        </nav>

        <div className={styles.userSection}>
          <div className={styles.userBadge}>
            <span>{user?.full_name?.charAt(0).toUpperCase() || 'I'}</span>
          </div>
          <div className={styles.userInfo}>
            <p>{user?.full_name || 'Kiểm định viên'}</p>
            <span>{user?.email || 'inspector@bikehub.test'}</span>
          </div>
          <button type="button" onClick={handleLogout} className={styles.logoutButton}>
            <FiLogOut />
          </button>
        </div>
      </div>
    </header>
  );
};

export default InspectorHeader;
