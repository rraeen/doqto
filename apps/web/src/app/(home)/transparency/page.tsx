import type { Metadata } from 'next';
import { PublicFooter, PublicNav } from '@/components/landing/public-nav';
import { TransparencyView } from '@/components/transparency/transparency-view';

export const metadata: Metadata = {
  title: 'Transparency',
  description:
    'Every month we publish how many reviews were submitted, published, held and removed, and how appeals went.',
};

export default function TransparencyPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <PublicNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-28 sm:px-6 sm:pt-36">
        <TransparencyView />
      </main>
      <PublicFooter />
    </div>
  );
}
