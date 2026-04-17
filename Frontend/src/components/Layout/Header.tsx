'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiUser, FiFileText, FiDollarSign, FiLogOut, FiCheckSquare, FiHeart } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { readWishlist } from "../../utils/wishlist";
import styles from "./Header.module.css";

const Header: React.FC = () => {
  const router = useRouter();
  const { loggedIn, user, accessToken, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedItems, setSavedItems] = useState<{ listing_id: number; title: string }[]>([]);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<string>('B');
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('100000');
  const [topUpNote, setTopUpNote] = useState('Nạp tiền vào ví');
  const [topUpStatus, setTopUpStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdminUser = user?.role === 'ADMIN';
  const isInspectorUser = user?.role === 'INSPECTOR';

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

  useEffect(() => {
    if (!loggedIn) {
      setWalletBalance(null);
      return;
    }

    const token = accessToken ?? (typeof window !== 'undefined' ? window.sessionStorage.getItem('access_token') : null);
    if (!token) {
      return;
    }

    let isMounted = true;
    const fetchWallet = async () => {
      try {
        const response = await fetch('/api/wallet/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Không thể tải thông tin ví');
        }
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        setWalletBalance(data.balance ?? null);
        setWalletCurrency(data.currency ?? 'B');
      } catch (error) {
        console.error('[Header] Wallet fetch failed', error);
      }
    };

    fetchWallet();
    return () => { isMounted = false; };
  }, [loggedIn, accessToken]);

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

  const handleTopUpSubmit = async () => {
    if (!loggedIn) {
      setTopUpStatus({ type: 'error', message: 'Cần đăng nhập để nạp tiền.' });
      return;
    }

    const token = accessToken ?? (typeof window !== 'undefined' ? window.sessionStorage.getItem('access_token') : null);
    if (!token) {
      setTopUpStatus({ type: 'error', message: 'Không tìm thấy token. Vui lòng đăng nhập lại.' });
      return;
    }

    const amountValue = Number(topUpAmount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setTopUpStatus({ type: 'error', message: 'Vui lòng nhập số tiền hợp lệ lớn hơn 0.' });
      return;
    }

    setTopUpLoading(true);
    setTopUpStatus(null);

    try {
      const response = await fetch('/api/wallet/topup-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fiat_amount: amountValue,
          transfer_note: topUpNote,
          evidence_url: '',
          bank_info: {},
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Không thể gửi yêu cầu nạp.');
      }

      setTopUpStatus({ type: 'success', message: data.message || 'Yêu cầu nạp tiền đã được gửi.' });
      setShowTopUpForm(false);
      setTopUpAmount('100000');
      setTopUpNote('Nạp tiền vào ví');
    } catch (error) {
      setTopUpStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Lỗi khi gửi yêu cầu nạp tiền.',
      });
    } finally {
      setTopUpLoading(false);
    }
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
              {!isAdminUser && !isInspectorUser && (
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
                  <div className={styles.dropdownSection}>
                    <div className={styles.dropdownSectionTitle}>Ví của bạn</div>
                    <button
                      type="button"
                      onClick={() => setShowTopUpForm(prev => !prev)}
                      className={styles.dropdownItem}
                    >
                      <FiDollarSign className={styles.dropdownIcon} />
                      <span>
                        Số dư: {walletBalance !== null ? `${walletBalance} ${walletCurrency}` : 'Đang tải...'}
                      </span>
                    </button>
                    {showTopUpForm && (
                      <div className={styles.topUpForm}>
                        <label className={styles.topUpLabel}>
                          Số tiền nạp
                          <input
                            type="number"
                            min="100000"
                            step="100000"
                            className={styles.topUpInput}
                            value={topUpAmount}
                            onChange={(event) => setTopUpAmount(event.target.value)}
                          />
                        </label>
                        <label className={styles.topUpLabel}>
                          Ghi chú chuyển khoản
                          <input
                            type="text"
                            className={styles.topUpInput}
                            value={topUpNote}
                            onChange={(event) => setTopUpNote(event.target.value)}
                          />
                        </label>
                        <div className={styles.topUpActions}>
                          <button
                            type="button"
                            disabled={topUpLoading}
                            onClick={handleTopUpSubmit}
                            className={styles.topUpSubmit}
                          >
                            Gửi yêu cầu
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowTopUpForm(false)}
                            className={styles.topUpCancel}
                          >
                            Hủy
                          </button>
                        </div>
                        {topUpStatus && (
                          <p className={`${styles.topUpMessage} ${topUpStatus.type === 'success' ? styles.topUpSuccess : styles.topUpError}`}>
                            {topUpStatus.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {!isAdminUser && !isInspectorUser && (
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