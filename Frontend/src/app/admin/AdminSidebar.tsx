'use client';

import Link from 'next/link';
import adminStyles from './page.module.css';

export type AdminSidebarActive = 'home' | 'topup' | 'withdrawal' | 'bank' | 'disputes' | 'users' | 'settings';

function getLinkClass(active: AdminSidebarActive, key: AdminSidebarActive): string {
  const classes = [adminStyles.sidebarLink];
  if (active === key) {
    classes.push(adminStyles.sidebarLinkActive);
  }
  return classes.join(' ');
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
        <Link href="/admin" className={getLinkClass(active, 'home')}>
          Dashboard
        </Link>
        <Link href="/admin/topup-requests" className={getLinkClass(active, 'topup')}>
          Yêu cầu nạp tiền
        </Link>
        <Link href="/admin/withdrawal-requests" className={getLinkClass(active, 'withdrawal')}>
          Yêu cầu rút tiền
        </Link>
        <Link href="/admin/bank-verifications" className={getLinkClass(active, 'bank')}>
          Xác thực ngân hàng
        </Link>
        <Link href="/admin/disputes" className={getLinkClass(active, 'disputes')}>
          Tranh chấp đơn hàng
        </Link>
        <Link href="/admin/users" className={getLinkClass(active, 'users')}>
          Người dùng
        </Link>
        <Link href="/admin/settings" className={getLinkClass(active, 'settings')}>
          Cài đặt
        </Link>
      </nav>
    </aside>
  );
}
