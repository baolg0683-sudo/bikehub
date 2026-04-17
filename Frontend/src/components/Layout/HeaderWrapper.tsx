'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AdminHeader from './AdminHeader';
import InspectorHeader from './InspectorHeader';

export default function HeaderWrapper() {
  const pathname = usePathname();
  const showAdminHeader = pathname?.startsWith('/admin');
  const showInspectorHeader = pathname?.startsWith('/inspector');

  if (showAdminHeader) return <AdminHeader />;
  if (showInspectorHeader) return <InspectorHeader />;
  return <Header />;
}
