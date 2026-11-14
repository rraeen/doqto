import type { Metadata } from 'next';
import { ChangePasswordCard } from '@/components/auth/change-password-card';

export const metadata: Metadata = { title: 'Choose your password' };

export default function ChangePasswordPage() {
  return <ChangePasswordCard />;
}
