import type { Metadata } from 'next';
import { RegisterCard } from '@/components/auth/register-card';

export const metadata: Metadata = { title: 'Register' };

export default function RegisterPage() {
  return <RegisterCard />;
}
