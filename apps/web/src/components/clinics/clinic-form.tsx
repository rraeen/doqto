'use client';

import type {
  ClinicPrivate,
  CreateClinicRequest,
  LatLng,
  UpdateClinicRequest,
} from '@doqto/shared';
import { Crosshair, ExternalLink, MapPin, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import type { Translate } from '@/i18n/translate';
import { clinicsApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';

export interface ClinicFormValues {
  name: string;
  phone: string | null;
  phoneDigits: string;
  line1: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  pin: (LatLng & { label?: string }) | null;
}

export function clinicFormFrom(c?: ClinicPrivate): ClinicFormValues {
  const [lng, lat] = c?.location?.coordinates ?? [];
  return {
    name: c?.name ?? '',
    phone: c?.phone ?? null,
    phoneDigits: c?.phone?.slice(3) ?? '',
    line1: c?.address.line1 ?? '',
    area: c?.address.area ?? '',
    city: c?.address.city ?? '',
    district: c?.address.district ?? '',
    state: c?.address.state ?? 'Uttar Pradesh',
    pincode: c?.address.pincode ?? '',
    pin: lat !== undefined && lng !== undefined ? { lat, lng } : null,
  };
}

export type ClinicErrors = Partial<Record<keyof ClinicFormValues, string>>;

export function validateClinic(v: ClinicFormValues, t: Translate): ClinicErrors {
  const e: ClinicErrors = {};
  if (v.name.trim().length < 2) e.name = v.name.trim() ? t('form.tooShort') : t('form.required');
  if (v.phoneDigits && !v.phone) e.phone = t('form.invalidPhone');
  if (!v.line1.trim()) e.line1 = t('form.required');
  if (!v.city.trim()) e.city = t('form.required');
  if (!v.state.trim()) e.state = t('form.required');
  if (!/^[1-9]\d{5}$/.test(v.pincode)) e.pincode = t('form.invalidPincode');
  return e;
}

function address(v: ClinicFormValues) {
  return {
    line1: v.line1.trim(),
    ...(v.area.trim() ? { area: v.area.trim() } : {}),
    city: v.city.trim(),
    ...(v.district.trim() ? { district: v.district.trim() } : {}),
    state: v.state.trim(),
    pincode: v.pincode,
  };
}

export function toCreateRequest(v: ClinicFormValues): CreateClinicRequest {
  return {
    name: v.name.trim(),
    ...(v.phone ? { phone: v.phone } : {}),
    address: address(v),
    ...(v.pin ? { location: { lat: v.pin.lat, lng: v.pin.lng } } : {}),
  };
}

export function toUpdateRequest(v: ClinicFormValues, c: ClinicPrivate): UpdateClinicRequest | null {
  const prev = clinicFormFrom(c);
  const patch: UpdateClinicRequest = {};
  if (v.name.trim() !== prev.name) patch.name = v.name.trim();
  if (v.phone !== prev.phone) patch.phone = v.phone;
  if (JSON.stringify(address(v)) !== JSON.stringify(address(prev))) patch.address = address(v);
  const pin = v.pin ? { lat: v.pin.lat, lng: v.pin.lng } : null;
  const prevPin = prev.pin ? { lat: prev.pin.lat, lng: prev.pin.lng } : null;
  if (JSON.stringify(pin) !== JSON.stringify(prevPin)) patch.location = pin;
  return Object.keys(patch).length ? patch : null;
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/** Pin picker without a paid map SDK (TDD/INT-07): device location, geocode suggestions, OSM preview. */
function LocationPicker({
  v,
  set,
  disabled,
}: {
  v: ClinicFormValues;
  set: (p: Partial<ClinicFormValues>) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [locating, setLocating] = useState(false);
  const [finding, setFinding] = useState(false);
  const [candidates, setCandidates] = useState<
    { lat: number; lng: number; label: string; precision: string }[] | null
  >(null);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error(t('clinicSetup.locationUnavailable'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set({ pin: { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) } });
        setCandidates(null);
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? t('clinicSetup.locationDenied')
            : t('clinicSetup.locationUnavailable'),
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const find = async () => {
    if (!v.city.trim()) {
      toast.error(`${t('clinicSetup.cityLabel')}: ${t('form.required')}`);
      return;
    }
    setFinding(true);
    try {
      const res = await clinicsApi.geocode({
        city: v.city.trim(),
        ...(v.line1.trim()
          ? { address: [v.line1, v.area].filter(Boolean).join(', ').slice(0, 200) }
          : {}),
        ...(v.state.trim() ? { state: v.state.trim() } : {}),
        ...(/^[1-9]\d{5}$/.test(v.pincode) ? { pincode: v.pincode } : {}),
      });
      setCandidates(res.items);
    } catch (err) {
      toast.error(authErrorMessage(err, t));
    } finally {
      setFinding(false);
    }
  };

  const pin = v.pin;
  const bbox = pin
    ? [pin.lng - 0.004, pin.lat - 0.003, pin.lng + 0.004, pin.lat + 0.003].join(',')
    : '';

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t('clinicSetup.locationTitle')}</h3>
        <p className="text-xs text-ink-muted">{t('clinicSetup.locationHint')}</p>
      </div>
      {pin ? (
        <div className="overflow-hidden rounded-md border border-line">
          <iframe
            title={t('clinicSetup.locationTitle')}
            className="h-44 w-full"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${pin.lat},${pin.lng}`}
          />
          <div className="space-y-2 bg-canvas px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-success">
              <MapPin className="size-4" aria-hidden />
              {pin.label
                ? t('clinicSetup.pinApproximate', { label: pin.label })
                : t('clinicSetup.pinSet')}
            </span>
            <span className="flex flex-wrap justify-between gap-x-4 gap-y-2">
              <a
                className="inline-flex items-center gap-1 font-medium text-brand-700"
                href={`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('clinicSetup.openInMaps')}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
              {!disabled && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-ink-muted"
                  onClick={() => set({ pin: null })}
                >
                  <X className="size-4" aria-hidden />
                  {t('clinicSetup.clearPin')}
                </button>
              )}
            </span>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-ink-muted">
          {t('clinicSetup.noPin')}
        </p>
      )}
      {!disabled && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" loading={locating} onClick={useMyLocation}>
            <Crosshair className="size-5" aria-hidden />
            {t('clinicSetup.useMyLocation')}
          </Button>
          <Button type="button" variant="outline" loading={finding} onClick={() => void find()}>
            <Search className="size-5" aria-hidden />
            {t('clinicSetup.findOnMap')}
          </Button>
        </div>
      )}
      {!disabled && <p className="text-xs text-ink-muted">{t('clinicSetup.useMyLocationHint')}</p>}
      {candidates && (
        <div role="list" className="space-y-2">
          {candidates.length === 0 && (
            <p className="text-sm text-warning">{t('clinicSetup.noMatches')}</p>
          )}
          {candidates.map((c) => (
            <button
              key={`${c.lat},${c.lng}`}
              type="button"
              role="listitem"
              className="flex w-full items-center gap-2 rounded-md neu-raised px-3 py-3 text-left text-sm hover:brightness-105"
              onClick={() => {
                set({
                  pin: {
                    lat: c.lat,
                    lng: c.lng,
                    ...(c.precision === 'approximate' ? { label: c.label } : {}),
                  },
                });
                setCandidates(null);
              }}
            >
              <MapPin className="size-4 shrink-0 text-brand-600" aria-hidden />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClinicDetailsForm({
  value,
  onChange,
  errors,
  disabled,
}: {
  value: ClinicFormValues;
  onChange: (v: ClinicFormValues) => void;
  errors: ClinicErrors;
  disabled?: boolean;
}) {
  const t = useT();
  const set = (p: Partial<ClinicFormValues>) => onChange({ ...value, ...p });
  const text = (
    key: 'name' | 'line1' | 'area' | 'city' | 'district' | 'state' | 'pincode',
    label: string,
    extra: Record<string, unknown> = {},
  ) => (
    <Field label={label} error={errors[key]}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          value={value[key]}
          disabled={disabled}
          onChange={(e) =>
            set({
              [key]:
                key === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value,
            })
          }
          {...extra}
        />
      )}
    </Field>
  );
  return (
    <Card className="space-y-4">
      {text('name', t('clinicSetup.nameLabel'), {
        placeholder: t('clinicSetup.namePlaceholder'),
        maxLength: 120,
      })}
      <Field label={`${t('clinicSetup.phoneLabel')} (${t('form.optional')})`} error={errors.phone}>
        {({ id, describedBy, invalid }) => (
          <PhoneInput
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            defaultDigits={value.phoneDigits}
            onValueChange={(phone, phoneDigits) => set({ phone, phoneDigits })}
          />
        )}
      </Field>
      {text('line1', t('clinicSetup.addressLabel'), {
        maxLength: 200,
        autoComplete: 'address-line1',
      })}
      {text('area', `${t('clinicSetup.areaLabel')} (${t('form.optional')})`, { maxLength: 100 })}
      <div className="grid grid-cols-2 gap-3">
        {text('city', t('clinicSetup.cityLabel'), {
          maxLength: 80,
          autoComplete: 'address-level2',
        })}
        {text('pincode', t('clinicSetup.pincodeLabel'), {
          inputMode: 'numeric',
          autoComplete: 'postal-code',
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {text('district', `${t('clinicSetup.districtLabel')} (${t('form.optional')})`, {
          maxLength: 80,
        })}
        {text('state', t('clinicSetup.stateLabel'), {
          maxLength: 80,
          autoComplete: 'address-level1',
        })}
      </div>
      <LocationPicker v={value} set={set} disabled={disabled} />
    </Card>
  );
}
