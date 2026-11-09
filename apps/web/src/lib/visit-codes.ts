/**
 * The visit code is created when the doctor confirms a booking and arrives with the booking
 * itself (`MyAppointment.visitCode`), so the app no longer stores codes on the device.
 *
 * A steady example code for the demo's sample bookings, so their screen has something to show.
 */
export function sampleVisitCode(appointmentId: string): string {
  let h = 0;
  for (const ch of appointmentId) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  return String(1000 + h);
}
