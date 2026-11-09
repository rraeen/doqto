'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';
import {
  CATEGORIES,
  FILTER_BY,
  NO_FILTERS,
  VISIT_TYPES,
  activeFilterCount,
  type FilterBy,
  type RecordFilters,
} from '@/lib/records-view';

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function Option({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: string;
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        checked ? 'bg-brand-500 text-ink' : 'neu-raised text-ink',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md',
          checked ? 'bg-white text-brand-700' : 'neu-inset',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      {children}
    </label>
  );
}

const dateInput =
  'neu-inset h-12 w-full min-w-0 rounded-2xl bg-transparent px-4 text-base text-ink focus:outline-none';

/**
 * One "Filter health records" dropdown picks what to filter by (category, date, doctor, type);
 * the options for that choice appear underneath. Choices for other kinds are kept, so they can be
 * combined, and "Clear filters" resets all of them.
 */
export function RecordsFilter({
  filters,
  onChange,
  doctors,
}: {
  filters: RecordFilters;
  onChange: (next: RecordFilters) => void;
  doctors: readonly string[];
}) {
  const { t } = useI18n();
  const [by, setBy] = useState<FilterBy>('all');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const choose = (next: FilterBy) => {
    setBy(next);
    setOpen(false);
    // "All records" means no narrowing at all.
    if (next === 'all') onChange(NO_FILTERS);
  };
  const active = activeFilterCount(filters);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div ref={box} className="relative min-w-0 flex-1 sm:max-w-sm">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={t('records.filterBy')}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              'flex h-12 w-full items-center justify-between gap-3 rounded-full px-5 text-base font-semibold text-ink transition-shadow',
              open ? 'neu-inset' : 'neu-raised',
            )}
          >
            <span className="truncate">
              {t(FILTER_BY.find((f) => f.id === by)?.label ?? 'records.catAll')}
            </span>
            <ChevronDown
              className={cn(
                'size-5 shrink-0 text-brand-700 transition-transform',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
          {open && (
            <ul
              role="listbox"
              aria-label={t('records.filterBy')}
              className="neu-card absolute left-0 right-0 top-full z-20 mt-2 space-y-1 rounded-2xl p-2"
            >
              {FILTER_BY.map((f) => {
                const selected = f.id === by;
                return (
                  <li key={f.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => choose(f.id)}
                      className={cn(
                        'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-base font-semibold transition-colors',
                        selected ? 'neu-inset text-brand-700' : 'text-ink hover:bg-brand-500/15',
                      )}
                    >
                      {t(f.label)}
                      {selected && <Check className="size-4" strokeWidth={3} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-brand-700"
          >
            <X className="size-4" aria-hidden />
            {t('records.clearFilters')} ({active})
          </button>
        )}
      </div>

      {by === 'category' && (
        <div className="flex flex-wrap gap-3" role="group" aria-label={t('records.byCategory')}>
          {CATEGORIES.map((c) => (
            <Option
              key={c.id}
              checked={filters.categories.includes(c.id)}
              onChange={() =>
                onChange({ ...filters, categories: toggle(filters.categories, c.id) })
              }
            >
              {t(c.label)}
            </Option>
          ))}
        </div>
      )}

      {by === 'date' && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink-muted">{t('records.dateFrom')}</span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
              className={dateInput}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink-muted">{t('records.dateTo')}</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
              className={dateInput}
            />
          </label>
        </div>
      )}

      {by === 'doctor' && (
        <div className="flex flex-wrap gap-3" role="group" aria-label={t('records.byDoctor')}>
          {doctors.map((d) => (
            <Option
              key={d}
              checked={filters.doctors.includes(d)}
              onChange={() => onChange({ ...filters, doctors: toggle(filters.doctors, d) })}
            >
              {d}
            </Option>
          ))}
        </div>
      )}

      {by === 'type' && (
        <div className="flex flex-wrap gap-3" role="group" aria-label={t('records.byType')}>
          {VISIT_TYPES.map((v) => (
            <Option
              key={v.id}
              checked={filters.types.includes(v.id)}
              onChange={() => onChange({ ...filters, types: toggle(filters.types, v.id) })}
            >
              {t(v.label)}
            </Option>
          ))}
        </div>
      )}
    </div>
  );
}
