import { Suspense } from 'react';
import { HomeSwitch } from '@/components/home/home-switch';
import { LandingPage } from '@/components/landing/landing-page';

export default function HomePage() {
  return (
    <Suspense fallback={<LandingPage />}>
      <HomeSwitch landing={<LandingPage />} />
    </Suspense>
  );
}
