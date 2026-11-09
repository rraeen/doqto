import type { ReactNode } from 'react';
import { AdminChrome } from '@/components/shell/admin-chrome';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
