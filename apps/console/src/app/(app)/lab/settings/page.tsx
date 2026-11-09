import { ServicesSettings } from '@/components/home/services-settings';
import { PlannedScreen } from '@/components/planned-screen';

export default function Page() {
  return (
    <>
      <ServicesSettings />
      <PlannedScreen type="lab" area="settings" />
    </>
  );
}
