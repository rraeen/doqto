import { describe, expect, it } from 'vitest';
import {
  NO_FILTERS,
  activeFilterCount,
  recordDoctors,
  recordsText,
  sampleRecords,
  visibleRecords,
  type RecordFilters,
} from './records-view';

const NOW = Date.parse('2026-10-20T06:00:00Z');
const all = sampleRecords(NOW);

const none = NO_FILTERS;
const ids = (f: Partial<RecordFilters>, q = '') =>
  visibleRecords(all, { ...none, ...f }, q).map((r) => r.id);

describe('visibleRecords', () => {
  it('lists newest first', () => {
    const dates = visibleRecords(all, none, '').map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
  it('filters by category, allowing several', () => {
    expect(ids({ categories: ['discharge'] })).toEqual(['r9']);
    expect(ids({ categories: ['lab', 'discharge'] })).toEqual(['r1', 'r6', 'r9']);
  });
  it('filters by visit type', () => {
    expect(ids({ types: ['IP'] })).toEqual(['r9', 'r10']);
    expect(ids({ types: ['OP'] })).toHaveLength(8);
  });
  it('filters by doctor', () => {
    expect(ids({ doctors: ['Dr Sana Qureshi'] })).toEqual(['r3', 'r8']);
    expect(ids({ doctors: ['Dr Sana Qureshi', 'Dr Vikram Singh'] })).toEqual(['r3', 'r2', 'r8']);
  });
  it('filters by an inclusive date range, open at either end', () => {
    expect(ids({ from: '2026-10-06', to: '2026-10-12' })).toEqual(['r1', 'r3', 'r2']);
    expect(ids({ to: '2026-08-20' })).toEqual(['r9', 'r10', 'r8']);
    expect(ids({ from: '2026-10-20' })).toEqual([]);
  });
  it('searches title, doctor and clinic, ignoring case', () => {
    expect(ids({}, 'CBC')).toEqual(['r1']);
    expect(ids({}, 'qureshi')).toEqual(['r3', 'r8']);
    expect(ids({}, 'heartcare')).toEqual(['r2']);
    expect(ids({}, 'nothing here')).toEqual([]);
  });
  it('combines filters with a search', () => {
    expect(ids({ categories: ['lab'] }, 'thyroid')).toEqual(['r6']);
    expect(ids({ categories: ['diagnostics'] }, 'thyroid')).toEqual([]);
  });
});

describe('activeFilterCount', () => {
  it('counts each kind of filter once', () => {
    expect(activeFilterCount(none)).toBe(0);
    expect(
      activeFilterCount({ ...none, from: '2026-01-01', to: '2026-02-01', types: ['IP'] }),
    ).toBe(2);
  });
});

describe('recordDoctors', () => {
  it('lists each visited doctor once, A to Z', () => {
    expect(recordDoctors(all)).toEqual([
      'Dr Anita Sharma',
      'Dr Rakesh Sharma',
      'Dr Sana Qureshi',
      'Dr Vikram Singh',
    ]);
  });
});

describe('sampleRecords', () => {
  it('dates records back from now', () => {
    expect(all.every((r) => r.date <= '2026-10-20')).toBe(true);
  });
});

describe('recordsText', () => {
  it('writes each record with its details', () => {
    const text = recordsText(
      all.slice(0, 1),
      'Doqto health records (example)',
      { doctor: 'Doctor', facility: 'Clinic', date: 'Date', status: 'Status' },
      () => 'Normal',
    );
    expect(text).toContain('Blood test – CBC');
    expect(text).toContain('Doctor: Dr Anita Sharma');
    expect(text).toContain('Status: Normal');
  });
});
