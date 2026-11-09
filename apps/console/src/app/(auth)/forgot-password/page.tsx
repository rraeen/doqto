import type { Metadata } from 'next';
import { ForgotCard } from '@/components/auth/forgot-card';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return <ForgotCard />;
}
