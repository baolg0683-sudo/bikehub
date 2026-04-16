'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import styles from './page.module.css';

const navItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Yêu cầu nạp', href: '/admin' },
  { label: 'Kiểm định', href: '/admin' },
  { label: 'Người dùng', href: '/admin' },
  { label: 'Cài đặt', href: '/admin' },
];

export default function AdminDashboard() {
  const { loggedIn, initialized, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!loggedIn) {
      router.push('/login');
      return;
    }

    if (user?.role !== 'ADMIN') {
      router.push('/');
    }
  }, [initialized, loggedIn, user, router]);

  return (
    <div className={styles.adminPage}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>A</div>
          <div>
            <h2>Admin Dashboard</h2>
            <p>BikeHub</p>
          </div>
        </div>
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link key={item.href + item.label} href={item.href} className={styles.sidebarLink}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className={styles.mainContent}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.pageLabel}>Dashboard chính</p>
            <h1 className={styles.pageTitle}>Xin chào, {user?.full_name || 'Admin'}!</h1>
            <p className={styles.pageSubtitle}>
              Đây là không gian quản trị. Các chỉ số và tính năng sẽ được mở rộng sau.
            </p>
          </div>
        </header>

        <div className={styles.cardsGrid}>
          <div className={styles.card}>
            <h3>Số liệu tổng quan</h3>
            <p>Chưa có dữ liệu</p>
          </div>
          <div className={styles.card}>
            <h3>Yêu cầu nạp</h3>
            <p>Chờ cập nhật</p>
          </div>
          <div className={styles.card}>
            <h3>Kiểm định</h3>
            <p>Đang phát triển</p>
          </div>
          <div className={styles.card}>
            <h3>Người dùng</h3>
            <p>Danh sách sắp có</p>
          </div>
        </div>
      </section>
    </div>
  );
}
