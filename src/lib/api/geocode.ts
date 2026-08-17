import type { LatLng } from '../geo';
import { isNative } from '../native';
import { loadGeocoding, mapsAvailable } from '../maps/loader';
import { mapKey } from '../maps/keys';
import * as rest from '../maps/rest';

/**
 * Geocoding, used in both directions: turning a device fix into a street address
 * to show the reader where they are searching from, and turning typed text into
 * coordinates when Places autocomplete cannot resolve a suggestion.
 *
 * Two paths, because only one can authenticate on each platform:
 *
 *  - **Native** → the REST endpoint with the platform key and an app-identity
 *    header (see maps/rest.ts). A Capacitor webview cannot satisfy an HTTP
 *    referrer restriction, and Google states website restrictions are "not
 *    guaranteed to work correctly" unless the page is served from a site you
 *    control — localhost is not.
 *  - **Web** → the Maps JS SDK geocoder with the referrer-restricted web key,
 *    where the browser sends a real referrer from a real origin.
 *
 * An earlier version called the REST endpoint through `CapacitorHttp` on every
 * platform without those headers. On device that is a native request carrying no
 * referrer and no bundle identifier, so any properly restricted key rejected it
 * — and because these calls fail soft, the only symptom was the address quietly
 * never appearing.
 *
 * Both directions still fail soft: a search works without a readable address, so
 * a geocoder outage must never block one.
 */

/** `true` when a web key is configured. Callers use this to skip the round trip. */
export function geocodingAvailable(): boolean {
  return isNative() ? Boolean(mapKey()) : mapsAvailable();
}

async function geocode(request: google.maps.GeocoderRequest, language: string): Promise<google.maps.GeocoderResult[]> {
  if (!geocodingAvailable()) return [];
  const { Geocoder } = await loadGeocoding(language);
  const { results } = await new Geocoder().geocode(request);
  return results ?? [];
}

/** Coordinates → a human-readable address, or `null` if none could be resolved. */
export async function reverseGeocode(lat: number, lng: number, language = 'en'): Promise<string | null> {
  if (isNative()) return rest.reverseGeocode(lat, lng, language);
  try {
    const results = await geocode({ location: { lat, lng } }, language);
    return results[0]?.formatted_address ?? null;
  } catch {
    // ZERO_RESULTS rejects rather than returning an empty list.
    return null;
  }
}

/** An address → coordinates, or `null` if it could not be resolved. */
export async function forwardGeocode(address: string, language = 'en'): Promise<LatLng | null> {
  if (!address.trim()) return null;
  if (isNative()) return rest.forwardGeocode(address, language);
  try {
    const results = await geocode({ address }, language);
    const location = results[0]?.geometry?.location;
    return location ? { lat: location.lat(), lng: location.lng() } : null;
  } catch {
    return null;
  }
}
