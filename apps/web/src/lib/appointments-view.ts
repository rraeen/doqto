import {
  SPECIALTIES,
  appointmentReference,
  doctorReference,
  type AppointmentStatus,
  type MyAppointment,
  type PaymentOrder,
} from '@doqto/shared';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n/provider';
import type { MessageKey } from '@/i18n/translate';
import { appointmentsApi } from './api/lazy';
import { env } from './env';
import type { PrescriptionData } from './prescription';
import { SAMPLE_DOCTORS } from './sample-doctors';
import { sampleVisitCode } from './visit-codes';

/** What an appointment card needs: the appointment joined with its doctor and clinic. */
export interface AppointmentCardData {
  id: string;
  doctor: { id: string; name: string; slug: string; specialty: string; photoUrl?: string | null };
  clinic: { name: string; area: string | null };
  /** ISO time of the slot, or `null` for a walk-in with no slot. */
  start: string | null;
  status: AppointmentStatus;
  /** Not stored in Phase 1 (ADR 0007), so only the demo examples carry one. */
  prescription?: PrescriptionData | null;
  /** When the booking was made (ISO). Example visits have none. */
  bookedAt?: string;
  /** Doqto booking fee in paise. */
  fee?: number;
  /** While `pending_payment`: when the 10-minute hold on the slot runs out. */
  holdExpiresAt?: string | null;
  /** The 4-digit code for the front desk; set once the doctor has confirmed. */
  visitCode?: string | null;
  /** Set when the booking comes from the API; it carries the ids the API calls need. */
  api?: { doctorId: string; clinicId: string; order?: PaymentOrder | null };
}

export type AppointmentTab = 'upcoming' | 'past';

const UPCOMING: readonly AppointmentStatus[] = [
  'pending_payment',
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'in_consult',
];

export function tabOf(status: AppointmentStatus): AppointmentTab {
  return UPCOMING.includes(status) ? 'upcoming' : 'past';
}

export const STATUS_LABEL: Record<AppointmentStatus, MessageKey> = {
  pending_payment: 'appointments.statusPendingPayment',
  pending_confirmation: 'appointments.statusPendingConfirmation',
  confirmed: 'appointments.statusConfirmed',
  checked_in: 'appointments.statusCheckedIn',
  in_consult: 'appointments.statusInConsult',
  completed: 'appointments.statusCompleted',
  no_show: 'appointments.statusNoShow',
  cancelled_by_patient: 'appointments.statusCancelledByPatient',
  cancelled_by_clinic: 'appointments.statusCancelledByClinic',
  expired: 'appointments.statusExpired',
};

export const STATUS_TONE: Record<AppointmentStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  pending_payment: 'warning',
  pending_confirmation: 'info',
  confirmed: 'success',
  checked_in: 'info',
  in_consult: 'info',
  completed: 'success',
  no_show: 'warning',
  cancelled_by_patient: 'danger',
  cancelled_by_clinic: 'danger',
  expired: 'warning',
};

/** The doctor's id, or the slug for an old saved booking that has none. */
const doctorIdOf = (a: AppointmentCardData): string => a.doctor.id || a.doctor.slug || '';

/** Upcoming soonest first, past most recent first. */
export function visibleAppointments(
  all: readonly AppointmentCardData[],
  tab: AppointmentTab,
  search: string,
): AppointmentCardData[] {
  const needle = search.trim().toLowerCase();
  const time = (a: AppointmentCardData) => (a.start ? Date.parse(a.start) : 0);
  return all
    .filter((a) => tabOf(a.status) === tab)
    .filter(
      (a) =>
        !needle ||
        a.doctor.name.toLowerCase().includes(needle) ||
        a.doctor.specialty.toLowerCase().includes(needle) ||
        // The doctor's unique id, the short doctor ID (DR-...) and the appointment ID (DQ-...).
        doctorIdOf(a).toLowerCase() === needle ||
        (needle.length >= 4 && doctorIdOf(a).toLowerCase().includes(needle)) ||
        doctorReference(doctorIdOf(a)).toLowerCase().includes(needle) ||
        appointmentReference(a.id).toLowerCase().includes(needle),
    )
    .sort((a, b) => (tab === 'upcoming' ? time(a) - time(b) : time(b) - time(a)));
}

/** A booking from the API as a card, with specialties shown in the reader's language. */
export function toCardData(a: MyAppointment, locale: 'en' | 'hi'): AppointmentCardData {
  const label = (key: string) => SPECIALTIES.find((s) => s.key === key)?.[locale] ?? key;
  return {
    id: a.id,
    doctor: {
      id: a.doctor.id,
      name: a.doctor.name,
      slug: a.doctor.slug,
      specialty: a.doctor.specialties.map(label).join(', '),
      photoUrl: a.doctor.photoUrl ?? null,
    },
    clinic: { name: a.clinic.name, area: a.clinic.area },
    start: a.slotStart,
    status: a.status,
    bookedAt: a.createdAt,
    fee: a.bookingFee,
    holdExpiresAt: a.holdExpiresAt,
    visitCode: a.visitCode,
    api: { doctorId: a.doctor.id, clinicId: a.clinic.id, order: a.order ?? null },
  };
}

/**
 * Upcoming visits with the one booked most recently first (so a booking just made is the first
 * thing the patient sees), then the example visits by date.
 */
export function latestBookedFirst(list: readonly AppointmentCardData[]): AppointmentCardData[] {
  const booked = (a: AppointmentCardData) => (a.bookedAt ? Date.parse(a.bookedAt) : 0);
  const start = (a: AppointmentCardData) => (a.start ? Date.parse(a.start) : 0);
  return [...list].sort((a, b) => booked(b) - booked(a) || start(a) - start(b));
}

const day = 24 * 60 * 60 * 1000;
/** Example rows for the demo and local development. Not real bookings. */
export function sampleAppointments(now = Date.now()): AppointmentCardData[] {
  const rows = sampleRows(now);
  return rows.map((r) => ({
    ...r,
    doctor: {
      ...r.doctor,
      id: SAMPLE_DOCTORS.find((d) => d.slug === r.doctor.slug)?.id ?? r.doctor.slug,
    },
  }));
}

type SampleRow = Omit<AppointmentCardData, 'doctor'> & {
  doctor: { name: string; slug: string; specialty: string };
};

function sampleRows(now: number): SampleRow[] {
  const followUp = (offset: number) => new Date(now + offset * day).toISOString().slice(0, 10);
  const at = (offset: number, hour: number) => {
    const d = new Date(now + offset * day);
    d.setHours(hour, 30, 0, 0);
    return d.toISOString();
  };
  const clinic = { name: 'Sharma Family Clinic', area: 'Civil Lines' };
  return [
    {
      id: 'sample-1',
      doctor: {
        name: 'Dr Anita Sharma',
        slug: 'dr-anita-sharma-bareilly',
        specialty: 'General Physician',
      },
      clinic,
      start: at(1, 10),
      status: 'confirmed',
      visitCode: sampleVisitCode('sample-1'),
    },
    {
      id: 'sample-2',
      doctor: { name: 'Dr Vikram Singh', slug: 'sample-vikram-singh', specialty: 'Cardiologist' },
      clinic: { name: 'Heartcare Clinic', area: 'Izzatnagar' },
      start: at(3, 16),
      status: 'pending_payment',
    },
    {
      id: 'sample-8',
      doctor: {
        name: 'Dr Sana Qureshi',
        slug: 'dr-sana-qureshi-bareilly',
        specialty: 'Paediatrician',
      },
      clinic: { name: 'Shifa Child Care', area: 'Rajendra Nagar' },
      start: at(2, 11),
      status: 'pending_confirmation',
    },
    {
      id: 'sample-3',
      doctor: {
        name: 'Dr Sana Qureshi',
        slug: 'dr-sana-qureshi-bareilly',
        specialty: 'Paediatrician',
      },
      clinic: { name: 'Shifa Child Care', area: 'Rajendra Nagar' },
      start: at(-12, 17),
      status: 'completed',
      prescription: {
        rxNumber: 'DQ-24081',
        medicines: [
          {
            name: 'Paracetamol syrup',
            purpose: 'Fever and pain relief',
            dose: '5 ml',
            duration: '3 days',
            timing: 'after_food',
            schedule: { morning: true, noon: false, night: true },
          },
          {
            name: 'Cetirizine 5 mg',
            purpose: 'Cold and allergy relief',
            dose: '1 tablet',
            duration: '5 days',
            timing: 'anytime',
            schedule: { morning: false, noon: false, night: true },
          },
          {
            name: 'Oral rehydration salts',
            purpose: 'Keeps the body hydrated',
            dose: '1 sachet in a glass of water',
            duration: 'as needed',
            timing: 'with_water',
            schedule: { morning: true, noon: true, night: true },
          },
        ],
        notes:
          'Give plenty of fluids and rest. Complete the full course of medicines. Come back if the fever lasts more than 3 days.',
        followUp: followUp(-12 + 14),
      },
    },
    {
      id: 'sample-9',
      doctor: {
        name: 'Dr Anita Sharma',
        slug: 'dr-anita-sharma-bareilly',
        specialty: 'General Physician',
      },
      clinic,
      start: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
    },
    {
      id: 'sample-10',
      doctor: {
        name: 'Dr Anita Sharma',
        slug: 'dr-anita-sharma-bareilly',
        specialty: 'General Physician',
      },
      clinic,
      start: at(-5, 10),
      status: 'completed',
    },
    {
      id: 'sample-4',
      doctor: {
        name: 'Dr Rakesh Sharma',
        slug: 'dr-rakesh-sharma-bareilly',
        specialty: 'Orthopaedic',
      },
      clinic,
      start: at(-30, 11),
      status: 'completed',
      prescription: {
        rxNumber: 'DQ-23977',
        medicines: [
          {
            name: 'Calcium with vitamin D3',
            purpose: 'Bone strength',
            dose: '1 tablet',
            duration: '30 days',
            timing: 'after_food',
            schedule: { morning: false, noon: true, night: false },
          },
          {
            name: 'Pain relief gel',
            purpose: 'Joint and muscle pain',
            dose: 'apply a thin layer',
            duration: '7 days',
            timing: 'anytime',
            schedule: { morning: true, noon: false, night: true },
          },
        ],
        notes: 'Light stretching every day. Avoid lifting heavy weights until the follow-up.',
        followUp: followUp(-30 + 21),
      },
    },
    {
      id: 'sample-5',
      doctor: {
        name: 'Dr Anita Sharma',
        slug: 'dr-anita-sharma-bareilly',
        specialty: 'General Physician',
      },
      clinic,
      start: at(-45, 9),
      status: 'cancelled_by_patient',
    },
    {
      id: 'sample-6',
      doctor: { name: 'Dr Priya Verma', slug: 'sample-priya-verma', specialty: 'Gynaecologist' },
      clinic: { name: 'Janani Women’s Clinic', area: 'Pilibhit Bypass' },
      start: at(-60, 12),
      status: 'no_show',
    },
    {
      id: 'sample-7',
      doctor: { name: 'Dr Imran Khan', slug: 'sample-imran-khan', specialty: 'ENT Specialist' },
      clinic: { name: 'City ENT Centre', area: 'Subhash Nagar' },
      start: at(-75, 15),
      status: 'cancelled_by_clinic',
    },
  ];
}

/**
 * The signed-in patient's appointments. With `NEXT_PUBLIC_BOOKING_API` on they come from the API
 * (or its mocks); otherwise the list stays empty and the demo store fills the screen.
 */
export function useMyAppointments(opts: { enabled: boolean }) {
  const { locale } = useI18n();
  return useQuery({
    queryKey: ['my-appointments', locale, env.bookingApi],
    queryFn: async ({ signal }): Promise<AppointmentCardData[]> => {
      if (!env.bookingApi) return [];
      const page = await appointmentsApi.listMyAppointments({}, signal);
      return page.items.map((a) => toCardData(a, locale));
    },
    enabled: opts.enabled,
  });
}
