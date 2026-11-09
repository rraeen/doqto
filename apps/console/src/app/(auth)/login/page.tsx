import type { Metadata } from 'next';
import { LoginCard } from '@/components/auth/login-card';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return <LoginCard />;
}
