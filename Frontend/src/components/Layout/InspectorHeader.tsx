'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FiLogOut, FiHome, FiUser } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import styles from './InspectorHeader.module.css';

const InspectorHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', onClickOutside);
    }

    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showDropdown]);

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

        <div className={styles.userSection} ref={dropdownRef}>
          <button type="button" className={styles.avatarButton} onClick={() => setShowDropdown((prev) => !prev)}>
            <div className={styles.userBadge}>
              <span>{user?.full_name?.charAt(0).toUpperCase() || 'I'}</span>
            </div>
            <div className={styles.userInfo}>
              <p>{user?.full_name || 'Kiểm định viên'}</p>
              <span>{user?.email || 'inspector@bikehub.test'}</span>
            </div>
            <span className={styles.dropdownArrow}>▾</span>
          </button>

          {showDropdown && (
            <div className={styles.userDropdown}>
              <Link href="/inspector/profile" className={styles.dropdownItem} onClick={() => setShowDropdown(false)}>
                <FiUser className={styles.dropdownIcon} /> Hồ sơ kiểm định
              </Link>
              <button type="button" className={styles.dropdownItem} onClick={handleLogout}>
                <FiLogOut className={styles.dropdownIcon} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default InspectorHeader;
