import { ProviderInputError } from '../errors';
import type { GeocodeQuery, GeocodeResult, GeocoderProvider } from './geocoder.provider';
import { isInIndia } from './maps';

type Fetch = typeof fetch;

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
/** Nominatim usage policy: at most 1 request per second, identifying User-Agent. */
const MIN_INTERVAL_MS = 1100;
const CACHE_MAX = 500;

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
}

/**
 * Live geocoder on OpenStreetMap Nominatim: free, no key, India only. Volume
 * is tiny (clinic setup), well inside the usage policy; requests are spaced
 * at least 1.1 s apart and results cached in memory. The gate and cache are
 * per process: fine on one Render instance; with several, move both to Mongo. Any failure returns no
 * result, so the doctor falls back to placing the pin by hand.
 */
export class NominatimGeocoderProvider implements GeocoderProvider {
  readonly providerName = 'nominatim';
  readonly mode = 'live' as const;
  private readonly cache = new Map<string, GeocodeResult[]>();
  private nextSlot = 0;

  constructor(
    private readonly userAgent: string,
    private readonly fetchImpl: Fetch = (...args) => fetch(...args),
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {}

  async geocode(query: GeocodeQuery): Promise<GeocodeResult[]> {
    if (!query.city.trim()) throw new ProviderInputError('city is required');
    if (query.pincode !== undefined && !/^[1-9]\d{5}$/.test(query.pincode)) {
      throw new ProviderInputError('pincode must be 6 digits');
    }
    const q = [query.address, query.city, query.state, query.pincode, 'India']
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(', ');
    const cached = this.cache.get(q.toLowerCase());
    if (cached) return cached;

    await this.waitForSlot();
    const url = `${ENDPOINT}?${new URLSearchParams({ q, format: 'jsonv2', countrycodes: 'in', limit: '5', addressdetails: '0' })}`;
    let hits: NominatimHit[];
    try {
      const res = await this.fetchImpl(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      hits = (await res.json()) as NominatimHit[];
    } catch {
      return [];
    }

    const results = (Array.isArray(hits) ? hits : [])
      .map((h) => ({
        lat: Number(h.lat),
        lng: Number(h.lon),
        label: h.display_name,
        precision: isCityLevel(h.addresstype) ? ('approximate' as const) : ('exact' as const),
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && isInIndia(r));

    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(q.toLowerCase(), results);
    return results;
  }

  private async waitForSlot(): Promise<void> {
    const now = this.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + MIN_INTERVAL_MS;
    if (slot > now) await this.sleep(slot - now);
  }
}

const isCityLevel = (type: string | undefined): boolean =>
  [
    'city',
    'town',
    'village',
    'county',
    'state_district',
    'state',
    'postcode',
    'municipality',
  ].includes(type ?? '');
