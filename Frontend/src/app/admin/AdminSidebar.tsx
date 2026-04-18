'use client';

import Link from 'next/link';
import adminStyles from './page.module.css';

export type AdminSidebarActive = 'home' | 'topup' | 'withdrawal' | 'bank' | 'disputes';

function linkClass(active: AdminSidebarActive, key: AdminSidebarActive) {
  return `${adminStyles.sidebarLink}${active === key ? ` ${adminStyles.sidebarLinkActive}` : ''}`;
}

export function AdminSidebar({ active }: { active: AdminSidebarActive }) {
  return (
    <aside className={adminStyles.sidebar}>
      <div className={adminStyles.brand}>
        <div className={adminStyles.brandIcon}>A</div>
        <div>
          <h2>Admin Dashboard</h2>
          <p>BikeHub</p>
        </div>
      </div>
      <nav className={adminStyles.sidebarNav}>
        <Link href="/admin" className={linkClass(active, 'home')}>
          Dashboard
        </Link>
        <Link href="/admin/topup-requests" className={linkClass(active, 'topup')}>
          Yêu cầu nạp tiền
        </Link>
        <Link href="/admin/withdrawal-requests" className={linkClass(active, 'withdrawal')}>
          Yêu cầu rút tiền
        </Link>
        <Link href="/admin/bank-verifications" className={linkClass(active, 'bank')}>
          Xác thực ngân hàng
        </Link>
        <Link href="/admin/disputes" className={linkClass(active, 'disputes')}>
          Tranh chấp đơn hàng
        </Link>
        <Link href="/admin" className={adminStyles.sidebarLink}>
          Kiểm định
        </Link>
        <Link href="/admin" className={adminStyles.sidebarLink}>
          Người dùng
        </Link>
        <Link href="/admin" className={adminStyles.sidebarLink}>
          Cài đặt
        </Link>
      </nav>
    </aside>
  );
}
