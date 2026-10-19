import { DemoGeocoderProvider } from './demo-geocoder.provider';
import {
  distanceKm,
  fromGeoJsonPoint,
  googleMapsDirectionsLink,
  googleMapsLink,
  isInIndia,
  toGeoJsonPoint,
} from './maps';
import { NominatimGeocoderProvider } from './nominatim-geocoder.provider';

const bareilly = { lat: 28.367, lng: 79.4304 };

describe('map helpers', () => {
  it('builds keyless Google Maps links', () => {
    expect(googleMapsLink(bareilly)).toBe(
      'https://www.google.com/maps/search/?api=1&query=28.367%2C79.4304',
    );
    expect(googleMapsLink(bareilly, 'Sharma Clinic & Diagnostics')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Sharma%20Clinic%20%26%20Diagnostics%2028.367%2C79.4304',
    );
    expect(googleMapsDirectionsLink({ lat: 28.36701234, lng: 79.43049876 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=28.367012,79.430499',
    );
  });

  it('converts to and from GeoJSON in [lng, lat] order', () => {
    expect(toGeoJsonPoint(bareilly)).toEqual({ type: 'Point', coordinates: [79.4304, 28.367] });
    expect(fromGeoJsonPoint(toGeoJsonPoint(bareilly))).toEqual(bareilly);
  });

  it('rejects impossible coordinates', () => {
    expect(() => toGeoJsonPoint({ lat: 91, lng: 0 })).toThrow();
    expect(() => googleMapsLink({ lat: Number.NaN, lng: 0 })).toThrow();
  });

  it('spots swapped coordinates with the India box', () => {
    expect(isInIndia(bareilly)).toBe(true);
    expect(isInIndia({ lat: bareilly.lng, lng: bareilly.lat })).toBe(false);
  });

  it('computes distance in km', () => {
    const lucknow = { lat: 26.8467, lng: 80.9462 };
    expect(distanceKm(bareilly, lucknow)).toBeGreaterThan(220);
    expect(distanceKm(bareilly, lucknow)).toBeLessThan(230);
    expect(distanceKm(bareilly, bareilly)).toBe(0);
  });
});

describe('DemoGeocoderProvider', () => {
  it('returns an approximate city centre with no network call', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const r = await new DemoGeocoderProvider().geocode({
      address: 'Civil Lines',
      city: ' Bareilly ',
    });
    expect(r).toEqual([
      { ...bareilly, label: 'Bareilly, Uttar Pradesh (city centre)', precision: 'approximate' },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('returns nothing for unknown cities, so the doctor pins by hand', async () => {
    await expect(new DemoGeocoderProvider().geocode({ city: 'Atlantis' })).resolves.toEqual([]);
  });
});

describe('NominatimGeocoderProvider', () => {
  function setup(responses: Array<{ status?: number; body?: unknown; throws?: boolean }>) {
    const calls: { url: string; init: RequestInit }[] = [];
    const sleeps: number[] = [];
    let clock = 1_000_000;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      const r = responses.shift() ?? { body: [] };
      if (r.throws) throw new Error('network down');
      return new Response(JSON.stringify(r.body ?? []), { status: r.status ?? 200 });
    }) as typeof fetch;
    const geocoder = new NominatimGeocoderProvider(
      'Doqto-test/0.1 (test@doqto.in)',
      fetchImpl,
      () => clock,
      async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    );
    return { geocoder, calls, sleeps };
  }

  it('queries India only with an identifying User-Agent and maps results', async () => {
    const { geocoder, calls } = setup([
      {
        body: [
          {
            lat: '28.3600',
            lon: '79.4200',
            display_name: 'Civil Lines, Bareilly',
            addresstype: 'suburb',
          },
          { lat: '28.3670', lon: '79.4304', display_name: 'Bareilly', addresstype: 'city' },
          { lat: '40.7', lon: '-74.0', display_name: 'Somewhere abroad', addresstype: 'city' },
        ],
      },
    ]);
    const r = await geocoder.geocode({
      address: 'Civil Lines',
      city: 'Bareilly',
      pincode: '243001',
    });
    expect(r).toEqual([
      { lat: 28.36, lng: 79.42, label: 'Civil Lines, Bareilly', precision: 'exact' },
      { lat: 28.367, lng: 79.4304, label: 'Bareilly', precision: 'approximate' },
    ]);
    const url = new URL(calls[0]!.url);
    expect(url.host).toBe('nominatim.openstreetmap.org');
    expect(url.searchParams.get('countrycodes')).toBe('in');
    expect(url.searchParams.get('q')).toBe('Civil Lines, Bareilly, 243001, India');
    expect((calls[0]!.init.headers as Record<string, string>)['User-Agent']).toBe(
      'Doqto-test/0.1 (test@doqto.in)',
    );
  });

  it('spaces requests at least 1.1 s apart and caches repeats', async () => {
    const { geocoder, calls, sleeps } = setup([{ body: [] }, { body: [] }]);
    await geocoder.geocode({ city: 'Bareilly' });
    await geocoder.geocode({ city: 'Lucknow' });
    await geocoder.geocode({ city: 'bareilly' });
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([1100]);
  });

  it('returns no result on HTTP errors or network failure', async () => {
    const { geocoder } = setup([{ status: 429 }, { throws: true }]);
    await expect(geocoder.geocode({ city: 'Agra' })).resolves.toEqual([]);
    await expect(geocoder.geocode({ city: 'Patna' })).resolves.toEqual([]);
  });

  it('validates input', async () => {
    const { geocoder, calls } = setup([]);
    await expect(geocoder.geocode({ city: ' ' })).rejects.toThrow('city');
    await expect(geocoder.geocode({ city: 'Agra', pincode: '12345' })).rejects.toThrow('pincode');
    expect(calls).toHaveLength(0);
  });
});
