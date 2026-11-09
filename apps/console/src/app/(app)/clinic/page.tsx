import { WaitingCallout } from '@/components/clinic/appointments-screen';
import { ScheduleCallout } from '@/components/clinic/schedule-editor';
import { PlannedScreen } from '@/components/planned-screen';

export default function Page() {
  return (
    <>
      <WaitingCallout />
      <ScheduleCallout />
      <PlannedScreen type="clinic" area="dashboard" />
    </>
  );
}
