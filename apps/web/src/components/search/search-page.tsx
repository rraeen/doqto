'use client';

import { mediaSrc } from '@/lib/media';
import type { DoctorListItem, SpecialtyKey } from '@doqto/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  MapPin,
  Search,
  SearchX,
  UserRound,
  Star,
} from 'lucide-react';
import Image from 'next/image';
import { doctorReference } from '@doqto/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PageTitle } from '@/components/shell/page';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
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

  // The boxes start from the link (a shared or reloaded search) and drive it from then on. No city
  // is remembered or assumed: leave it empty to search every city.
  const [city, setCity] = useState(urlCity);
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

  // The boxes drive the link: a moment after the city, specialty or name changes, the search is
  // applied, so what is typed always wins over what the link said.
  const name = q.trim().length >= 2 ? q.trim() : '';
  useEffect(() => {
    if (
      city.trim().toLowerCase() === urlCity.toLowerCase() &&
      specialty === urlSpecialty &&
      name === urlQ
    ) {
      return;
    }
    const id = setTimeout(() => go({}), 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` only reads the values listed
  }, [city, name, specialty, urlCity, urlSpecialty, urlQ]);

  // Every box is optional: with none filled in, the page lists every doctor, a page at a time.
  // (With Near me on, wait for the location.)
  const query: DoctorSearchParams | null = nearOn
    ? coords
      ? {
          near: `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`,
          ...(urlSpecialty ? { specialty: urlSpecialty as SpecialtyKey } : {}),
          ...(urlQ.length >= 2 ? { q: urlQ } : {}),
        }
      : null
    : {
        ...(urlCity ? { city: urlCity } : {}),
        ...(urlSpecialty ? { specialty: urlSpecialty as SpecialtyKey } : {}),
        ...(urlQ.length >= 2 ? { q: urlQ } : {}),
      };

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-x-8 lg:gap-y-2 lg:space-y-0">
      <div className="lg:col-span-2">
        <PageTitle>{t('search.title')}</PageTitle>
      </div>
      <form
        role="search"
        className="space-y-3 lg:neu-card lg:sticky lg:top-24 lg:rounded-xl lg:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          setCoords(null);
          go({ near: false });
        }}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
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
              className="neu-inset h-tap w-full rounded-2xl border-0 px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
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

      <div className="space-y-4">
        {nearOn && coords && (
          <p className="flex items-center gap-1.5 text-sm text-brand-700">
            <MapPin className="size-4" aria-hidden />
            {t('search.nearMeOn')}
          </p>
        )}

        {query && <Results query={query} labels={labels} photoHost={photoHost} />}
      </div>
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
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = results;

  if (results.isPending) {
    return (
      <div className="grid gap-4" aria-busy>
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
      <VirtualDoctors
        total={results.data.pages[0]?.total ?? items.length}
        items={items}
        labels={labels}
        photoHost={photoHost}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={async () => {
          const next = await fetchNextPage();
          return {
            count: next.data?.pages.flatMap((p) => p.items).length ?? 0,
            hasNextPage: next.hasNextPage,
          };
        }}
      />
      <div aria-live="polite" className="py-2 text-center text-sm text-ink-muted">
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

/** The API's default page size. */
const PAGE_SIZE = 20;
/** Space the app bar and the count bar take at the top of the screen. */
const SCROLL_PADDING = 150;
/**
 * Only the cards near the screen are in the page, so a long list stays light. Reaching the end
 * loads the next page, so more results appear as you scroll.
 */
function VirtualDoctors({
  total,
  items,
  labels,
  photoHost,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  total: number;
  items: DoctorListItem[];
  labels: Record<string, string>;
  photoHost: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<{ count: number; hasNextPage: boolean }>;
}) {
  const t = useT();
  const rows = items.length; // one card per row
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => setMargin(listRef.current?.offsetTop ?? 0), []);

  const virtualizer = useWindowVirtualizer({
    count: rows,
    // Close to the real card height (about 220 px wide, 270 px on a phone) so jumping to a page lands
    // right: rows not yet on screen have no measurement, only this guess.
    estimateSize: () => (typeof window !== 'undefined' && window.innerWidth < 640 ? 270 : 220),
    overscan: 4,
    scrollMargin: margin,
    scrollPaddingStart: SCROLL_PADDING,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastRow = virtualRows[virtualRows.length - 1]?.index ?? -1;

  useEffect(() => {
    if (lastRow >= rows - 2 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [lastRow, rows, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // The page the top of the screen is on: results arrive 20 at a time, so page n starts at 20(n-1).
  // Rows under the sticky bars at the top do not count: the first row below them is the current one.
  const below = (virtualizer.scrollOffset ?? 0) + SCROLL_PADDING;
  const firstRow = virtualRows.find((r) => r.end > below)?.index ?? virtualRows[0]?.index ?? 0;
  // At the very end the last page may be too short to reach the top of the screen: count it then.
  const atEnd = !hasNextPage && (virtualizer.range?.endIndex ?? 0) >= rows - 1;
  const pageRow = atEnd ? rows - 1 : firstRow;
  const page = Math.min(pages, Math.floor(pageRow / PAGE_SIZE) + 1);

  // Jump to the first result of a page; if it has not loaded yet, load pages until it has.
  const goToPage = async (n: number) => {
    const index = (Math.min(pages, Math.max(1, n)) - 1) * PAGE_SIZE;
    let loaded = items.length;
    let more = hasNextPage;
    while (loaded <= index && more) {
      const next = await fetchNextPage();
      loaded = next.count;
      more = next.hasNextPage;
    }
    // Let the list render the new rows before scrolling to one of them.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    virtualizer.scrollToIndex(Math.min(index, loaded - 1), { align: 'start' });
  };

  return (
    <>
      <div className="sticky top-[4.25rem] z-10 -mx-1 flex items-center justify-between gap-3 bg-surface px-1 pb-2 pt-4">
        <p className="text-sm font-semibold text-ink">
          {total === 1 ? t('search.foundOne') : t('search.found', { count: total })}
        </p>
        {pages > 1 && (
          <nav aria-label={t('search.pageOf', { page, pages })} className="flex items-center gap-1">
            <button
              type="button"
              aria-label={t('search.prevPage')}
              disabled={page <= 1}
              onClick={() => void goToPage(page - 1)}
              className="neu-raised grid size-9 place-items-center rounded-full text-brand-700 disabled:opacity-40"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <span
              className="min-w-20 text-center text-sm font-medium text-ink-muted"
              aria-live="polite"
            >
              {t('search.pageOf', { page, pages })}
            </span>
            <button
              type="button"
              aria-label={t('search.nextPage')}
              disabled={page >= pages}
              onClick={() => void goToPage(page + 1)}
              className="neu-raised grid size-9 place-items-center rounded-full text-brand-700 disabled:opacity-40"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </nav>
        )}
      </div>
      <div ref={listRef} style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
        {virtualRows.map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full pb-4"
            style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
          >
            <DoctorCard
              doctor={items[row.index] as DoctorListItem}
              labels={labels}
              photoHost={photoHost}
            />
          </div>
        ))}
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
  const card = (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <Link href={`/d/${d.id}`} className="flex min-w-0 flex-1 gap-4 rounded-xl hover:opacity-90">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-brand-50 sm:size-20">
          {d.photoUrl ? (
            <Image
              src={mediaSrc(d.photoUrl) ?? d.photoUrl}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={!optimise}
            />
          ) : (
            <UserRound
              className="absolute inset-0 m-auto size-8 text-brand-600 sm:size-10"
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-semibold">{d.name}</p>
          <p className="text-2xs font-semibold text-ink-muted">
            {t('doctorPage.doctorId')}: {doctorReference(d.id)}
          </p>
          <p className="line-clamp-2 text-sm text-ink-muted">
            {d.specialties.map((s) => labels[s] ?? s).join(', ')}
          </p>
          {d.experienceYears ? (
            <p className="text-xs text-ink-muted">
              {t('doctorPage.experience', { years: d.experienceYears })}
            </p>
          ) : null}
          {d.primaryClinic && (
            <p className="flex items-start gap-1 text-sm">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-muted" aria-hidden />
              <span className="line-clamp-2">
                {[d.primaryClinic.name, d.primaryClinic.area].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {d.distanceMeters !== null && (
              <Badge tone="brand">{formatDistance(d.distanceMeters, t)}</Badge>
            )}
            {d.consultFee !== null && (
              <span className="neu-inset inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                {formatRupees(d.consultFee)}
              </span>
            )}
            {d.ratingSummary && d.ratingSummary.count > 0 ? (
              <Badge tone="success">
                <Star className="size-3.5" fill="currentColor" aria-hidden />
                {t('search.rating', {
                  pct: Math.round(d.ratingSummary.recommendPct),
                  count: d.ratingSummary.count,
                })}
              </Badge>
            ) : (
              <Badge tone="brand">{t('doctorPage.newOnDoqto')}</Badge>
            )}
          </div>
        </div>
      </Link>
      <div className="grid grid-cols-2 gap-3 sm:w-52 sm:shrink-0 sm:grid-cols-1">
        <Link
          href={`/d/${d.id}`}
          className={buttonVariants({ size: 'sm', className: 'neu-inset text-brand-700 px-3' })}
        >
          {t('search.viewProfile')}
        </Link>
        <Link
          href={`/appointments/new?doctor=${encodeURIComponent(d.id)}`}
          className={buttonVariants({ size: 'sm', className: 'px-3' })}
        >
          {t('search.book')}
        </Link>
      </div>
    </Card>
  );
  return card;
}
