'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./Header.module.css";

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const updateLoginState = () => {
      setLoggedIn(!!window.localStorage.getItem("authToken"));
    };

    updateLoginState();
    window.addEventListener("storage", updateLoginState);
    return () => window.removeEventListener("storage", updateLoginState);
  }, []);
  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        {/* Cửa hàng Logo */}
        <div className={styles.headerLogo}>
          <div className={styles.logoIcon}>
            <img src="/assets/favicon.ico" width={24} height={24} alt="logo" />
            <span className={styles.logoText}>BikeMarket</span>
          </div>
        </div> {/* Thêm thẻ đóng cho header-logo */}

        {/* Menu điều hướng */}
        <nav className={styles.headerNav}>
          <Link href="/" className={styles.navLink}>
            Trang chủ
            <span className="nav-underline"></span>
          </Link>
          {loggedIn && (
            <Link href="/profile" className={styles.navLink}>
              Hồ sơ
              <span className="nav-underline"></span>
            </Link>
          )}
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
            <Link href="/post" className={styles.btnPost}>
              Đăng tin
            </Link>
          )}
        </div>
      </div> {/* Thẻ đóng cho header-container */}
    </header>
  );
};

export default Header;