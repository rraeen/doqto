export type DoseTiming = 'after_food' | 'before_food' | 'with_water' | 'anytime';

export interface Medicine {
  name: string;
  /** What it is for, e.g. "Fever and pain relief". */
  purpose: string;
  /** How much per dose, e.g. "1 tablet". */
  dose: string;
  duration: string;
  timing: DoseTiming;
  schedule: { morning: boolean; noon: boolean; night: boolean };
}

export interface PrescriptionData {
  rxNumber: string;
  medicines: Medicine[];
  notes: string | null;
  /** `YYYY-MM-DD`, or `null` when no follow-up was set. */
  followUp: string | null;
}

/** `prescription-dr-anita-sharma-2026-10-08.txt`, safe for any file system. */
export function prescriptionFileName(doctorName: string, startIso: string | null): string {
  const slug = doctorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const day = startIso ? startIso.slice(0, 10) : 'visit';
  return `prescription-${slug || 'doctor'}-${day}.txt`;
}

export interface PrescriptionLabels {
  title: string;
  doctor: string;
  date: string;
  rx: string;
  medicines: string;
  notes: string;
  followUp: string;
  timing: Record<DoseTiming, string>;
  slots: { morning: string; noon: string; night: string };
}

/** Plain-text copy of a prescription, for the download and share buttons. */
export function prescriptionText(
  rx: PrescriptionData,
  info: { doctorName: string; dateLabel: string; followUpLabel?: string | null },
  labels: PrescriptionLabels,
): string {
  const lines = [
    labels.title,
    '='.repeat(labels.title.length),
    `${labels.doctor}: ${info.doctorName}`,
    `${labels.date}: ${info.dateLabel}`,
    `${labels.rx}: ${rx.rxNumber}`,
    '',
    `${labels.medicines}:`,
  ];
  rx.medicines.forEach((m, i) => {
    const slots = (['morning', 'noon', 'night'] as const)
      .filter((k) => m.schedule[k])
      .map((k) => labels.slots[k])
      .join(' / ');
    lines.push(
      `${i + 1}. ${m.name} (${m.purpose})`,
      `   ${m.dose} - ${m.duration} - ${labels.timing[m.timing]}${slots ? ` - ${slots}` : ''}`,
    );
  });
  if (rx.notes) lines.push('', `${labels.notes}: ${rx.notes}`);
  if (info.followUpLabel) lines.push(`${labels.followUp}: ${info.followUpLabel}`);
  return lines.join('\n') + '\n';
}

/** Saves text as a file in the browser. */
export function downloadTextFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
