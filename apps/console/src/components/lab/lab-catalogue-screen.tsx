'use client';

import type { LabTest } from '@doqto/shared';
import { Button } from '@doqto/ui/button';
import { Checkbox } from '@doqto/ui/checkbox';
import { EmptyState } from '@doqto/ui/empty-state';
import { Field, Input, inputClass } from '@doqto/ui/input';
import { PageHeader } from '@doqto/ui/page-header';
import { Panel } from '@doqto/ui/panel';
import { StatusChip } from '@doqto/ui/status-chip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/i18n/provider';
import {
  createLabCategory,
  createLabTest,
  getLabCatalogue,
  labCatalogueKey,
  updateLabTest,
} from '@/lib/lab-api';
import { rupees, useLabErrorText, useLabUnit } from './lab-shared';

interface Draft {
  name: string;
  price: string;
  categoryId: string;
  sampleType: string;
  preparation: string;
  turnaround: string;
  home: boolean;
  active: boolean;
}
const EMPTY: Draft = {
  name: '',
  price: '',
  categoryId: '',
  sampleType: '',
  preparation: '',
  turnaround: '',
  home: false,
  active: true,
};
const draftOf = (t: LabTest): Draft => ({
  name: t.name,
  price: String(t.pricePaise / 100),
  categoryId: t.categoryId ?? '',
  sampleType: t.sampleType ?? '',
  preparation: t.preparation ?? '',
  turnaround: t.turnaroundHours ? String(t.turnaroundHours) : '',
  home: t.homeCollection,
  active: t.active,
});

/** The lab's tests and categories, with prices. Switched-off tests stay but patients do not see them. */
export function LabCatalogueScreen() {
  const t = useT();
  const queryClient = useQueryClient();
  const errorText = useLabErrorText();
  const { unitId } = useLabUnit();
  const catalogue = useQuery({
    queryKey: labCatalogueKey(unitId ?? ''),
    queryFn: () => getLabCatalogue(unitId!),
    enabled: Boolean(unitId),
  });
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft }>();
  const [errors, setErrors] = useState<{ name?: string; price?: string; form?: string }>({});
  const [categoryName, setCategoryName] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: labCatalogueKey(unitId!) });
  const fail = (err: unknown) => setMessage({ ok: false, text: errorText(err) });

  const addCategory = useMutation({
    mutationFn: () => createLabCategory(unitId!, categoryName.trim()),
    onSuccess: async () => {
      await refresh();
      setCategoryName('');
    },
    onError: fail,
  });

  const save = useMutation({
    mutationFn: ({ id, d }: { id: string | null; d: Draft }) => {
      const body = {
        name: d.name.trim(),
        pricePaise: Math.round(Number(d.price) * 100),
        categoryId: d.categoryId || null,
        sampleType: d.sampleType.trim() || null,
        preparation: d.preparation.trim() || null,
        turnaroundHours: d.turnaround ? Number(d.turnaround) : null,
        homeCollection: d.home,
        active: d.active,
      };
      return id ? updateLabTest(unitId!, id, body) : createLabTest(unitId!, body);
    },
    onSuccess: async () => {
      await refresh();
      setEditing(undefined);
      setMessage({ ok: true, text: t('lab.catalogue.saved') });
    },
    onError: (err) => setErrors({ form: errorText(err) }),
  });

  const toggle = useMutation({
    mutationFn: (test: LabTest) => updateLabTest(unitId!, test.id, { active: !test.active }),
    onSuccess: refresh,
    onError: fail,
  });

  function submit() {
    if (!editing) return;
    const d = editing.draft;
    const next: typeof errors = {};
    if (d.name.trim().length < 2) next.name = t('lab.catalogue.errName');
    const price = Number(d.price);
    if (d.price === '' || !Number.isFinite(price) || price < 0 || price > 50000) {
      next.price = t('lab.catalogue.errPrice');
    }
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate({ id: editing.id, d });
  }

  const set = (patch: Partial<Draft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));
  const data = catalogue.data;

  return (
    <>
      <PageHeader title={t('areas.catalogue.title')} description={t('lab.catalogue.intro')} />
      {message && (
        <p role="status" className={message.ok ? 'mb-4 text-sm text-success' : 'mb-4 text-sm text-danger'}>
          {message.text}
        </p>
      )}

      <Panel title={t('lab.catalogue.categories')} className="mb-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {data?.categories.map((c) => (
            <StatusChip key={c.id} tone="info">
              {c.name}
            </StatusChip>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (categoryName.trim().length >= 2) addCategory.mutate();
          }}
        >
          <Field label={t('lab.catalogue.categoryName')} className="min-w-56 flex-1">
            {({ id }) => (
              <Input id={id} maxLength={60} value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="outline" loading={addCategory.isPending} disabled={categoryName.trim().length < 2}>
            {t('lab.catalogue.addCategory')}
          </Button>
        </form>
      </Panel>

      {!editing && (
        <div className="mb-4">
          <Button onClick={() => (setErrors({}), setEditing({ id: null, draft: EMPTY }))}>
            {t('lab.catalogue.addTest')}
          </Button>
        </div>
      )}
      {editing && (
        <Panel title={editing.id ? t('lab.catalogue.editTest') : t('lab.catalogue.addTest')} className="mb-4">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            noValidate
          >
            <Field label={t('lab.catalogue.name')} error={errors.name}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={editing.draft.name} onChange={(e) => set({ name: e.target.value })} />
              )}
            </Field>
            <Field label={t('lab.catalogue.price')} error={errors.price}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} inputMode="decimal" aria-describedby={describedBy} aria-invalid={invalid} value={editing.draft.price} onChange={(e) => set({ price: e.target.value })} />
              )}
            </Field>
            <Field label={t('lab.catalogue.category')}>
              {({ id }) => (
                <select id={id} className={inputClass} value={editing.draft.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">{t('lab.catalogue.noCategory')}</option>
                  {data?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t('lab.catalogue.sampleType')}>
              {({ id }) => <Input id={id} maxLength={60} value={editing.draft.sampleType} onChange={(e) => set({ sampleType: e.target.value })} />}
            </Field>
            <Field label={t('lab.catalogue.preparation')} className="sm:col-span-2">
              {({ id }) => <Input id={id} maxLength={400} value={editing.draft.preparation} onChange={(e) => set({ preparation: e.target.value })} />}
            </Field>
            <Field label={t('lab.catalogue.turnaround')}>
              {({ id }) => <Input id={id} inputMode="numeric" value={editing.draft.turnaround} onChange={(e) => set({ turnaround: e.target.value.replace(/\D/g, '') })} />}
            </Field>
            <div>
              <Checkbox checked={editing.draft.home} onChange={(e) => set({ home: e.target.checked })} label={t('lab.catalogue.home')} />
              <Checkbox checked={editing.draft.active} onChange={(e) => set({ active: e.target.checked })} label={t('lab.catalogue.active')} />
            </div>
            {errors.form && (
              <p role="alert" className="text-sm text-danger sm:col-span-2">
                {errors.form}
              </p>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={save.isPending}>
                {t('lab.catalogue.save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>
                {t('lab.catalogue.cancel')}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <Panel>
        {catalogue.isPending ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('common.loading')}
          </p>
        ) : catalogue.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('common.somethingWrong')}
          </p>
        ) : data!.tests.length === 0 ? (
          <EmptyState icon={FlaskConical} title={t('lab.catalogue.none')} />
        ) : (
          <ul className="divide-y divide-line">
            {data!.tests.map((test) => (
              <li key={test.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {test.name} <span className="font-normal text-ink-muted">· {rupees(test.pricePaise)}</span>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {[test.categoryName, test.sampleType, test.turnaroundHours ? `${test.turnaroundHours} h` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {!test.active && <StatusChip tone="neutral">{t('lab.catalogue.hiddenTag')}</StatusChip>}
                    {test.homeCollection && <StatusChip tone="info">{t('lab.catalogue.homeTag')}</StatusChip>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => (setErrors({}), setEditing({ id: test.id, draft: draftOf(test) }))}>
                    {t('lab.catalogue.edit')}
                  </Button>
                  <Button size="sm" variant="ghost" loading={toggle.isPending && toggle.variables?.id === test.id} onClick={() => toggle.mutate(test)}>
                    {test.active ? t('lab.catalogue.hide') : t('lab.catalogue.show')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
