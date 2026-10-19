import type { ProviderInfo } from '../provider-mode';
import type { LatLng } from './maps';

export interface GeocodeQuery {
  /** Street, area or landmark as the doctor typed it. */
  address?: string;
  city: string;
  state?: string;
  /** 6-digit Indian PIN code. */
  pincode?: string;
}

export interface GeocodeResult extends LatLng {
  /** Human-readable match, shown so the doctor can confirm before saving. */
  label: string;
  /** `approximate` for city-level matches: the doctor should drag the pin. */
  precision: 'exact' | 'approximate';
}

/**
 * Turns an address into candidate map pins for the clinic location picker
 * (INT-07). Free options only in Phase 1; the doctor can always place the pin
 * by hand, so an empty result is a normal outcome, not an error.
 */
export interface GeocoderProvider extends ProviderInfo {
  geocode(query: GeocodeQuery): Promise<GeocodeResult[]>;
}
