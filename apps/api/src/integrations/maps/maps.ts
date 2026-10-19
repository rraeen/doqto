import { ProviderInputError } from '../errors';

/** Latitude/longitude in degrees. GeoJSON stores the reverse order: [lng, lat]. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

/** Rough bounding box of India, to catch swapped or mistyped coordinates. */
const INDIA = { minLat: 6, maxLat: 37.5, minLng: 68, maxLng: 97.5 };

export function assertLatLng({ lat, lng }: LatLng): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ProviderInputError('coordinates out of range');
  }
}

export function isInIndia({ lat, lng }: LatLng): boolean {
  return lat >= INDIA.minLat && lat <= INDIA.maxLat && lng >= INDIA.minLng && lng <= INDIA.maxLng;
}

/** For clinics.location (2dsphere index): GeoJSON order is [lng, lat]. */
export function toGeoJsonPoint(point: LatLng): GeoJsonPoint {
  assertLatLng(point);
  return { type: 'Point', coordinates: [round6(point.lng), round6(point.lat)] };
}

export function fromGeoJsonPoint(point: GeoJsonPoint): LatLng {
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

/** About 11 cm precision; more digits only add noise. */
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * "Open in Google Maps" link (Maps URLs API, no key, no cost). With a name the
 * pin is labelled; on Android it opens the Maps app. Used on profile pages and
 * in WhatsApp templates.
 */
export function googleMapsLink(point: LatLng, placeName?: string): string {
  assertLatLng(point);
  const coords = `${round6(point.lat)},${round6(point.lng)}`;
  const query = placeName ? `${placeName} ${coords}` : coords;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Turn-by-turn directions from the patient's current location. */
export function googleMapsDirectionsLink(point: LatLng): string {
  assertLatLng(point);
  return `https://www.google.com/maps/dir/?api=1&destination=${round6(point.lat)},${round6(point.lng)}`;
}

/** Great-circle distance in km, for "2.3 km away" on search results. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
