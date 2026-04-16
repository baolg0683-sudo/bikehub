'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AdminHeader from './AdminHeader';

export default function HeaderWrapper() {
  const pathname = usePathname();
  const showAdminHeader = pathname?.startsWith('/admin');

  return showAdminHeader ? <AdminHeader /> : <Header />;
}
