import type {
  RecordKind as SharedRecordKind,
  RecordStatus as SharedRecordStatus,
  RecordVisitType,
} from '@doqto/shared';
import type { MessageKey } from '@/i18n/translate';
import { addDays, todayIst } from './booking';

export type RecordKind = SharedRecordKind;
/** OP = outpatient visit, IP = admitted (inpatient). */
export type VisitType = RecordVisitType;
export type RecordStatus = SharedRecordStatus;
export type FilterBy = 'all' | 'category' | 'date' | 'doctor' | 'type';

/** One row of the records page. Phase 1 stores none of these (ADR 0007): the rows are demo examples. */
export interface HealthRecord {
  id: string;
  kind: RecordKind;
  visitType: VisitType;
  title: string;
  doctor: string;
  facility: string;
  /** `YYYY-MM-DD` */
  date: string;
  status: RecordStatus;
  /** A matching prescription page, when there is one. */
  appointmentId?: string;
  /** The uploaded file (records from the API); the example rows have none. */
  file?: { name: string; contentType: string; sizeBytes: number };
}

export const FILTER_BY: Array<{ id: FilterBy; label: MessageKey }> = [
  { id: 'all', label: 'records.catAll' },
  { id: 'category', label: 'records.byCategory' },
  { id: 'date', label: 'records.byDate' },
  { id: 'doctor', label: 'records.byDoctor' },
  { id: 'type', label: 'records.byType' },
];

export const CATEGORIES: Array<{ id: RecordKind; label: MessageKey }> = [
  { id: 'lab', label: 'records.catLab' },
  { id: 'discharge', label: 'records.catDischarge' },
  { id: 'diagnostics', label: 'records.catDiagnostics' },
  { id: 'opd', label: 'records.catOpd' },
  { id: 'prescription', label: 'records.catPrescription' },
  { id: 'vaccination', label: 'records.catVaccination' },
  { id: 'other', label: 'records.catOther' },
];

export const VISIT_TYPES: Array<{ id: VisitType; label: MessageKey }> = [
  { id: 'OP', label: 'records.typeOp' },
  { id: 'IP', label: 'records.typeIp' },
];

/** What the user has picked in the filter panel. Empty means "no restriction". */
export interface RecordFilters {
  categories: RecordKind[];
  /** `YYYY-MM-DD`, inclusive; empty for open-ended. */
  from: string;
  to: string;
  doctors: string[];
  types: VisitType[];
}

export const NO_FILTERS: RecordFilters = {
  categories: [],
  from: '',
  to: '',
  doctors: [],
  types: [],
};

export function activeFilterCount(f: RecordFilters): number {
  return (
    Number(f.categories.length > 0) +
    Number(Boolean(f.from || f.to)) +
    Number(f.doctors.length > 0) +
    Number(f.types.length > 0)
  );
}

/** The doctors the patient has records from, A to Z. */
export function recordDoctors(all: readonly HealthRecord[]): string[] {
  return [...new Set(all.map((r) => r.doctor))].sort((a, b) => a.localeCompare(b));
}

export const STATUS_LABEL: Record<RecordStatus, MessageKey> = {
  normal: 'records.statusNormal',
  follow_up: 'records.statusFollowUp',
  completed: 'records.statusCompleted',
};

export const STATUS_TONE: Record<RecordStatus, 'success' | 'warning'> = {
  normal: 'success',
  follow_up: 'warning',
  completed: 'success',
};

/** Example records, dated back from `now` so they always look recent. */
export function sampleRecords(now: number): HealthRecord[] {
  const day = (back: number) => addDays(todayIst(now), -back);
  return [
    {
      id: 'r1',
      kind: 'lab',
      visitType: 'OP',
      title: 'Blood test – CBC',
      doctor: 'Dr Anita Sharma',
      facility: 'Sharma Family Clinic',
      date: day(8),
      status: 'normal',
    },
    {
      id: 'r2',
      kind: 'diagnostics',
      visitType: 'OP',
      title: 'Chest X-ray',
      doctor: 'Dr Vikram Singh',
      facility: 'Heartcare Clinic',
      date: day(14),
      status: 'follow_up',
    },
    {
      id: 'r3',
      kind: 'opd',
      visitType: 'OP',
      title: 'OPD note – fever and cough',
      doctor: 'Dr Sana Qureshi',
      facility: 'Shifa Child Care',
      date: day(12),
      status: 'completed',
      appointmentId: 'sample-3',
    },
    {
      id: 'r4',
      kind: 'opd',
      visitType: 'OP',
      title: 'OPD note – annual check-up',
      doctor: 'Dr Anita Sharma',
      facility: 'Sharma Family Clinic',
      date: day(20),
      status: 'completed',
    },
    {
      id: 'r5',
      kind: 'opd',
      visitType: 'OP',
      title: 'OPD note – calcium and vitamin D',
      doctor: 'Dr Rakesh Sharma',
      facility: 'Sharma Family Clinic',
      date: day(30),
      status: 'completed',
      appointmentId: 'sample-4',
    },
    {
      id: 'r6',
      kind: 'lab',
      visitType: 'OP',
      title: 'Thyroid panel',
      doctor: 'Dr Anita Sharma',
      facility: 'Sharma Family Clinic',
      date: day(45),
      status: 'normal',
    },
    {
      id: 'r7',
      kind: 'diagnostics',
      visitType: 'OP',
      title: 'Knee X-ray',
      doctor: 'Dr Rakesh Sharma',
      facility: 'Sharma Family Clinic',
      date: day(52),
      status: 'normal',
    },
    {
      id: 'r8',
      kind: 'opd',
      visitType: 'OP',
      title: 'OPD note – typhoid vaccine',
      doctor: 'Dr Sana Qureshi',
      facility: 'Shifa Child Care',
      date: day(90),
      status: 'completed',
    },
    {
      id: 'r9',
      kind: 'discharge',
      visitType: 'IP',
      title: 'Discharge summary – knee surgery',
      doctor: 'Dr Rakesh Sharma',
      facility: 'City Orthopaedic Hospital',
      date: day(66),
      status: 'completed',
    },
    {
      id: 'r10',
      kind: 'diagnostics',
      visitType: 'IP',
      title: 'MRI – right knee',
      doctor: 'Dr Rakesh Sharma',
      facility: 'City Orthopaedic Hospital',
      date: day(70),
      status: 'follow_up',
    },
  ];
}

/** Newest first, narrowed by the filters and a search over title, doctor and clinic. */
export function visibleRecords(
  all: readonly HealthRecord[],
  filters: RecordFilters,
  search: string,
): HealthRecord[] {
  const needle = search.trim().toLowerCase();
  return all
    .filter((r) => filters.categories.length === 0 || filters.categories.includes(r.kind))
    .filter((r) => filters.types.length === 0 || filters.types.includes(r.visitType))
    .filter((r) => filters.doctors.length === 0 || filters.doctors.includes(r.doctor))
    .filter((r) => !filters.from || r.date >= filters.from)
    .filter((r) => !filters.to || r.date <= filters.to)
    .filter(
      (r) =>
        !needle ||
        r.title.toLowerCase().includes(needle) ||
        r.doctor.toLowerCase().includes(needle) ||
        r.facility.toLowerCase().includes(needle),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Plain text for a single record, or several. */
export function recordsText(
  records: readonly HealthRecord[],
  title: string,
  labels: { doctor: string; facility: string; date: string; status: string },
  statusText: (s: RecordStatus) => string,
): string {
  const lines = [title, '='.repeat(title.length), ''];
  for (const r of records) {
    lines.push(
      r.title,
      `  ${labels.doctor}: ${r.doctor}`,
      `  ${labels.facility}: ${r.facility}`,
      `  ${labels.date}: ${r.date}`,
      `  ${labels.status}: ${statusText(r.status)}`,
      '',
    );
  }
  return lines.join('\n');
}
