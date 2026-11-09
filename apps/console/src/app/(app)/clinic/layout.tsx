import type { ReactNode } from 'react';
import { AppChrome } from '@/components/shell/app-chrome';

// Sign-in guarding is added with the accounts API (phase 2B); until then these are skeleton screens.
export default function Layout({ children }: { children: ReactNode }) {
  return <AppChrome type="clinic">{children}</AppChrome>;
}
