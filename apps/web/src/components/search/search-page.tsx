'use client';

import type { DoctorListItem, SpecialtyKey } from '@doqto/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Clock, Crosshair, MapPin, Search, SearchX, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';
import type { Translate } from '@/i18n/translate';
import { searchApi } from '@/lib/api/lazy';
import { authErrorMessage } from '@/lib/api/messages';
import type { DoctorSearchParams } from '@/lib/api/doctors';
import { formatRupees } from '@/lib/money';

const CITY_KEY = 'doqto_city';
const PILOT_CITIES = ['Bareilly', 'Lucknow', 'Kanpur', 'Moradabad', 'Shahjahanpur', 'Agra'];

interface Coords {
  lat: number;
  lng: number;
}

export function formatDistance(meters: number, t: Translate): string {
  if (meters < 1000)
    return t('search.distanceM', { m: Math.max(50, Math.round(meters / 50) * 50) });
  const km = meters / 1000;
  return t('search.distanceKm', { km: km < 10 ? km.toFixed(1) : Math.round(km) });
}

/** The contract's India bounds (`LatLngSchema`); outside them the API answers 400. */
function inIndia({ lat, lng }: Coords) {
  return lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
}

function readCity(): string {
  try {
    return localStorage.getItem(CITY_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberCity(city: string) {
  try {
    localStorage.setItem(CITY_KEY, city);
  } catch {
    // Private mode: the city just is not remembered.
  }
}

export function SearchPage({
  specialties,
  photoHost,
}: {
  specialties: { key: string; label: string }[];
  photoHost: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const labels = Object.fromEntries(specialties.map((s) => [s.key, s.label]));

  const urlCity = params.get('city') ?? '';
  const urlSpecialty = params.get('specialty') ?? '';
  const urlQ = params.get('q') ?? '';
  const nearOn = params.get('near') === '1';

  // Inputs start from the URL, or the last city searched on this phone.
  const [city, setCity] = useState(() => urlCity || readCity());
  const [specialty, setSpecialty] = useState(urlSpecialty);
  const [q, setQ] = useState(urlQ);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const go = (next: { city?: string; specialty?: string; q?: string; near?: boolean }) => {
    const sp = new URLSearchParams();
    const c = (next.city ?? city).trim();
    const s = next.specialty ?? specialty;
    const n = (next.q ?? q).trim();
    if (c) sp.set('city', c);
    if (s) sp.set('specialty', s);
    if (n.length >= 2) sp.set('q', n);
    if (next.near ?? nearOn) sp.set('near', '1');
    if (c) rememberCity(c);
    router.replace(`/search${sp.size ? `?${sp}` : ''}`, { scroll: false });
  };

  const fallBackToCity = (message: string) => {
    toast(message);
    setCoords(null);
    go({ near: false });
  };

  const locate = () => {
    if (!('geolocation' in navigator)) {
      fallBackToCity(t('search.nearMeDenied'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inIndia(c)) {
          fallBackToCity(t('search.nearMeDenied'));
          return;
        }
        setCoords(c);
        go({ near: true });
      },
      () => {
        setLocating(false);
        fallBackToCity(t('search.nearMeDenied'));
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  };

  // `near=1` in a shared or reloaded URL: ask for the location again (coordinates stay off the URL).
  const asked = useRef(false);
  useEffect(() => {
    if (nearOn && !coords && !asked.current) {
      asked.current = true;
      locate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the URL asks for near me
  }, [nearOn]);

  const query: DoctorSearchParams | null =
    nearOn && coords
      ? {
          near: `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`,
          ...(urlSpecialty ? { specialty: urlSpecialty as SpecialtyKey } : {}),
          ...(urlQ.length >= 2 ? { q: urlQ } : {}),
        }
      : !nearOn && urlCity
        ? {
            city: urlCity,
            ...(urlSpecialty ? { specialty: urlSpecialty as SpecialtyKey } : {}),
            ...(urlQ.length >= 2 ? { q: urlQ } : {}),
          }
        : null;

  return (
    <div className="space-y-4">
      <PageTitle>{t('search.title')}</PageTitle>
      <form
        role="search"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!city.trim()) {
            toast(t('search.enterCity'));
            return;
          }
          setCoords(null);
          go({ near: false });
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">{t('search.cityLabel')}</span>
            <Input
              list="doqto-cities"
              value={city}
              maxLength={80}
              placeholder={t('search.cityPlaceholder')}
              autoComplete="address-level2"
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">{t('search.specialtyLabel')}</span>
            <select
              className="h-tap w-full rounded-md border border-line bg-surface px-3 text-base"
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value);
                if (urlCity || nearOn) go({ specialty: e.target.value });
              }}
            >
              <option value="">{t('search.anySpecialty')}</option>
              {specialties.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <datalist id="doqto-cities">
          {PILOT_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            {t('search.nameLabel')} ({t('form.optional')})
          </span>
          <Input value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit">
            <Search className="size-5" aria-hidden />
            {t('search.search')}
          </Button>
          <Button
            type="button"
            variant={nearOn && coords ? 'secondary' : 'outline'}
            loading={locating}
            aria-pressed={nearOn && Boolean(coords)}
            onClick={locate}
          >
            <Crosshair className="size-5" aria-hidden />
            {t('search.nearMe')}
          </Button>
        </div>
      </form>

      {nearOn && coords && (
        <p className="flex items-center gap-1.5 text-sm text-brand-700">
          <MapPin className="size-4" aria-hidden />
          {t('search.nearMeOn')}
        </p>
      )}

      {query ? (
        <Results query={query} labels={labels} photoHost={photoHost} />
      ) : (
        !locating && <EmptyState icon={Search} title={t('search.enterCity')} />
      )}
    </div>
  );
}

function Results({
  query,
  labels,
  photoHost,
}: {
  query: DoctorSearchParams;
  labels: Record<string, string>;
  photoHost: string | null;
}) {
  const t = useT();
  const results = useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam, signal }) =>
      searchApi.searchDoctors({ ...query, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = results;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (results.isPending) {
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  if (results.isError) {
    return (
      <EmptyState
        title={authErrorMessage(results.error, t)}
        action={
          <Button variant="outline" onClick={() => void results.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }
  const items = results.data.pages.flatMap((p) => p.items);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t('search.noResults')}
        description={t('search.noResultsBody')}
      />
    );
  }
  return (
    <>
      <ul className="space-y-3">
        {items.map((d) => (
          <li key={d.id}>
            <DoctorCard doctor={d} labels={labels} photoHost={photoHost} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-live="polite" className="py-2 text-center text-sm text-ink-muted">
        {isFetchingNextPage ? (
          t('search.loadingMore')
        ) : hasNextPage ? (
          // Fallback when IntersectionObserver never fires (old WebViews).
          <Button variant="ghost" size="sm" onClick={() => void fetchNextPage()}>
            {t('adminVerify.loadMore')}
          </Button>
        ) : (
          t('search.endOfResults')
        )}
      </div>
    </>
  );
}

function DoctorCard({
  doctor: d,
  labels,
  photoHost,
}: {
  doctor: DoctorListItem;
  labels: Record<string, string>;
  photoHost: string | null;
}) {
  const t = useT();
  const optimise = (() => {
    try {
      return Boolean(d.photoUrl && photoHost && new URL(d.photoUrl).hostname === photoHost);
    } catch {
      return false;
    }
  })();
  return (
    <Link href={`/d/${d.slug}`} className="block">
      <Card className="flex gap-3 hover:bg-canvas">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-brand-50">
          {d.photoUrl ? (
            <Image
              src={d.photoUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized={!optimise}
            />
          ) : (
            <UserRound className="absolute inset-0 m-auto size-8 text-brand-600" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-semibold">{d.name}</p>
          <p className="truncate text-sm text-ink-muted">
            {d.specialties.map((s) => labels[s] ?? s).join(', ')}
            {d.experienceYears
              ? ` · ${t('doctorPage.experience', { years: d.experienceYears })}`
              : ''}
          </p>
          {d.primaryClinic && (
            <p className="flex items-center gap-1 truncate text-sm">
              <MapPin className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
              <span className="truncate">
                {[d.primaryClinic.name, d.primaryClinic.area].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {d.distanceMeters !== null && (
              <Badge tone="brand">{formatDistance(d.distanceMeters, t)}</Badge>
            )}
            {d.consultFee !== null && <Badge>{formatRupees(d.consultFee)}</Badge>}
            {(!d.ratingSummary || d.ratingSummary.count === 0) && (
              <Badge tone="info">{t('doctorPage.newOnDoqto')}</Badge>
            )}
            <span className="flex items-center gap-1 text-ink-muted">
              <Clock className="size-3.5" aria-hidden />
              {t('search.availabilitySoon')}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
