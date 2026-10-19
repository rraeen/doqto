import type { GeocodeQuery, GeocodeResult, GeocoderProvider } from './geocoder.provider';

/** City centres for demo data and offline development. */
const CITY_CENTRES: Record<string, { lat: number; lng: number; state: string }> = {
  agra: { lat: 27.1767, lng: 78.0081, state: 'Uttar Pradesh' },
  ajmer: { lat: 26.4499, lng: 74.6399, state: 'Rajasthan' },
  aligarh: { lat: 27.8974, lng: 78.088, state: 'Uttar Pradesh' },
  bareilly: { lat: 28.367, lng: 79.4304, state: 'Uttar Pradesh' },
  bhopal: { lat: 23.2599, lng: 77.4126, state: 'Madhya Pradesh' },
  dehradun: { lat: 30.3165, lng: 78.0322, state: 'Uttarakhand' },
  gorakhpur: { lat: 26.7606, lng: 83.3732, state: 'Uttar Pradesh' },
  gwalior: { lat: 26.2183, lng: 78.1828, state: 'Madhya Pradesh' },
  indore: { lat: 22.7196, lng: 75.8577, state: 'Madhya Pradesh' },
  jaipur: { lat: 26.9124, lng: 75.7873, state: 'Rajasthan' },
  kanpur: { lat: 26.4499, lng: 80.3319, state: 'Uttar Pradesh' },
  lucknow: { lat: 26.8467, lng: 80.9462, state: 'Uttar Pradesh' },
  meerut: { lat: 28.9845, lng: 77.7064, state: 'Uttar Pradesh' },
  moradabad: { lat: 28.8386, lng: 78.7733, state: 'Uttar Pradesh' },
  patna: { lat: 25.5941, lng: 85.1376, state: 'Bihar' },
  varanasi: { lat: 25.3176, lng: 82.9739, state: 'Uttar Pradesh' },
};

/**
 * Demo mode: no network. Matches the city against a fixed table and returns
 * its centre as an approximate pin; unknown cities return no result, and the
 * doctor places the pin by hand, as they can in live mode.
 */
export class DemoGeocoderProvider implements GeocoderProvider {
  readonly providerName = 'demo-geocoder';
  readonly mode = 'demo' as const;

  async geocode(query: GeocodeQuery): Promise<GeocodeResult[]> {
    const key = query.city.trim().toLowerCase();
    const city = CITY_CENTRES[key];
    if (!city) return [];
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    return [
      {
        lat: city.lat,
        lng: city.lng,
        label: `${name}, ${city.state} (city centre)`,
        precision: 'approximate',
      },
    ];
  }
}
