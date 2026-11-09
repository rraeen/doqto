import { describe, expect, it } from 'vitest';
import { prescriptionFileName, prescriptionText, type PrescriptionData } from './prescription';

const labels = {
  title: 'Doqto prescription (example)',
  doctor: 'Doctor',
  date: 'Date',
  rx: 'RX',
  medicines: 'Medicines',
  notes: 'Notes',
  followUp: 'Follow-up',
  timing: {
    after_food: 'After food',
    before_food: 'Before food',
    with_water: 'With water',
    anytime: 'Any time',
  },
  slots: { morning: 'Morning', noon: 'Noon', night: 'Night' },
};

const rx: PrescriptionData = {
  rxNumber: 'DQ-1001',
  medicines: [
    {
      name: 'Paracetamol 500 mg',
      purpose: 'Fever',
      dose: '1 tablet',
      duration: '3 days',
      timing: 'after_food',
      schedule: { morning: true, noon: false, night: true },
    },
  ],
  notes: 'Rest.',
  followUp: '2026-11-01',
};

describe('prescriptionFileName', () => {
  it('slugs the doctor and uses the visit day', () => {
    expect(prescriptionFileName('Dr Anita Sharma', '2026-10-08T12:00:00.000Z')).toBe(
      'prescription-dr-anita-sharma-2026-10-08.txt',
    );
  });
  it('survives odd names and a missing date', () => {
    expect(prescriptionFileName('  ../Dr: Ünï/ ', null)).toBe('prescription-dr-n-visit.txt');
    expect(prescriptionFileName('???', null)).toBe('prescription-doctor-visit.txt');
  });
});

describe('prescriptionText', () => {
  it('lists each medicine with its timing and schedule', () => {
    const text = prescriptionText(
      rx,
      { doctorName: 'Dr Anita Sharma', dateLabel: '8 Oct 2026' },
      labels,
    );
    expect(text).toContain('Doctor: Dr Anita Sharma');
    expect(text).toContain('RX: DQ-1001');
    expect(text).toContain('1. Paracetamol 500 mg (Fever)');
    expect(text).toContain('1 tablet - 3 days - After food - Morning / Night');
    expect(text).toContain('Notes: Rest.');
  });
  it('adds the follow-up only when given', () => {
    const none = prescriptionText(
      { ...rx, notes: null },
      { doctorName: 'Dr A', dateLabel: 'x' },
      labels,
    );
    expect(none).not.toContain('Follow-up');
    expect(none).not.toContain('Notes');
    const some = prescriptionText(
      rx,
      { doctorName: 'Dr A', dateLabel: 'x', followUpLabel: '1 Nov 2026' },
      labels,
    );
    expect(some).toContain('Follow-up: 1 Nov 2026');
  });
});
