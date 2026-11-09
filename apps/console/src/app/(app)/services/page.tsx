import type { Metadata } from 'next';
import { ServicesPanel } from '@/components/home/services-panel';

export const metadata: Metadata = { title: 'Your services' };

export default function ServicesPage() {
  return <ServicesPanel />;
}
