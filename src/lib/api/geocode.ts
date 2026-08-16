import type { LatLng } from '../geo';
import { loadGeocoding, mapsAvailable } from '../maps/loader';

/**
 * Geocoding, used in both directions: turning a device fix into a street address
 * to show the reader where they are searching from, and turning typed text into
 * coordinates when Places autocomplete cannot resolve a suggestion.
 *
 * This goes through the Maps **JS SDK** geocoder rather than the Geocoding web
 * service, and that is not a stylistic choice. The web-service endpoint was
 * being called through `CapacitorHttp`, which on a device issues a *native* HTTP
 * request — no `Referer` header, no bundle identifier, nothing an application
 * restriction can match. A properly restricted key would have been rejected with
 * `REQUEST_DENIED`, and since these calls fail soft the only symptom would have
 * been the address quietly never appearing on the Nearby screen. The SDK
 * geocoder runs inside the webview, so it is referrer-checked exactly like the
 * autocomplete alongside it, and one web key covers both.
 *
 * Both directions still fail soft: a search works without a readable address, so
 * a geocoder outage must never block one.
 */

/** `true` when a web key is configured. Callers use this to skip the round trip. */
export function geocodingAvailable(): boolean {
  return mapsAvailable();
}

async function geocode(request: google.maps.GeocoderRequest, language: string): Promise<google.maps.GeocoderResult[]> {
  if (!geocodingAvailable()) return [];
  const { Geocoder } = await loadGeocoding(language);
  const { results } = await new Geocoder().geocode(request);
  return results ?? [];
}

/** Coordinates → a human-readable address, or `null` if none could be resolved. */
export async function reverseGeocode(lat: number, lng: number, language = 'en'): Promise<string | null> {
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
  try {
    const results = await geocode({ address }, language);
    const location = results[0]?.geometry?.location;
    return location ? { lat: location.lat(), lng: location.lng() } : null;
  } catch {
    return null;
  }
}
