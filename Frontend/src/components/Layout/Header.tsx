'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiUser, FiFileText, FiDollarSign, FiLogOut, FiCheckSquare, FiHeart, FiPlus } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { readWishlist } from "../../utils/wishlist";
import styles from "./Header.module.css";

const Header: React.FC = () => {
  const router = useRouter();
  const { loggedIn, user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedItems, setSavedItems] = useState<{ listing_id: number; title: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdminUser = user?.role === 'ADMIN';

  const loadSavedWishlist = () => {
    if (!user) {
      setSavedItems([]);
      return;
    }

    try {
      const parsed = readWishlist(user.user_id ?? null);
      setSavedItems(parsed);
    } catch (error) {
      console.error('[Header] Could not parse wishlist for user', error);
      setSavedItems([]);
    }
  };

  useEffect(() => {
    loadSavedWishlist();
    const handler = () => loadSavedWishlist();
    window.addEventListener('wishlistUpdated', handler);
    return () => window.removeEventListener('wishlistUpdated', handler);
  }, [user]);

  console.log('[Header] Rendering with loggedIn=%s, user=%o', loggedIn, user);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  const handleLogout = () => {
    console.log('[Header] Logout clicked');
    logout();
    setShowDropdown(false);
    router.push("/");
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        {/* Cửa hàng Logo */}
        <div className={styles.headerLogo}>
          <Link href="/" className={styles.logoIcon}>
            <img src="/assets/favicon.ico" width={24} height={24} alt="logo" />
            <span className={styles.logoText}>BikeMarket</span>
          </Link>
        </div>

        {/* Menu điều hướng */}
        <nav className={styles.headerNav}>
          <a href="#" className={styles.navLink}>
            Sản phẩm
            <span className={styles.navUnderline}></span>
          </a>
          <a href="#" className={styles.navLink}>
            Dịch vụ
            <span className={styles.navUnderline}></span>
          </a>
          <a href="#" className={styles.navLink}>
            Liên hệ
            <span className={styles.navUnderline}></span>
          </a>
        </nav>

        {/* Nút hành động */}
        <div className={styles.headerActions}>
          {!loggedIn && (
            <Link href="/login" className={styles.btnLogin}>
              Đăng nhập
            </Link>
          )}
          {loggedIn && (
            <div className={styles.userSection} ref={dropdownRef}>
              {!isAdminUser && (
                <Link href="/post" className={styles.btnPost}>
                  Đăng tin
                </Link>
              )}
              <div className={styles.userInfo} onClick={() => setShowDropdown(prev => !prev)}>
                <div className={styles.userAvatar}>
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" />
                  ) : (
                    <div className={styles.defaultAvatar}>
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
                <span className={styles.userName}>{user?.full_name || 'Người dùng'}</span>
                <span className={styles.dropdownArrow}>▼</span>
              </div>
              {showDropdown && (
                <div className={styles.userDropdown}>
                  <Link href="/profile" className={styles.dropdownItem}>
                    <FiUser className={styles.dropdownIcon} />
                    <span>Thông tin cá nhân</span>
                  </Link>
                  {!isAdminUser && (
                    <>
                      <Link href="/wishlist" className={styles.dropdownItem}>
                        <FiHeart className={styles.dropdownIcon} />
                        <span>Wishlist đã lưu ({savedItems.length})</span>
                      </Link>
                      <Link href="/manage" className={styles.dropdownItem}>
                        <FiFileText className={styles.dropdownIcon} />
                        <span>Quản lý tin đăng</span>
                      </Link>
                    </>
                  )}
                  {user?.role === 'INSPECTOR' && (
                    <Link href="/inspector" className={styles.dropdownItem}>
                      <FiCheckSquare className={styles.dropdownIcon} />
                      <span>Khu vực Kiểm định</span>
                    </Link>
                  )}
                  <div className={styles.dropdownDivider}></div>
                  <button 
                    onClick={handleLogout} 
                    className={styles.dropdownItem}
                  >
                    <FiLogOut className={styles.dropdownIcon} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;