import type { LatLng } from '../geo';
import { isNative } from '../native';
import { loadMapKit, mapKitConfigured } from '../maps/mapkit';
import { mapKey } from '../maps/keys';
import * as rest from '../maps/rest';

/**
 * Geocoding, used in both directions: turning a device fix into a street address
 * to show the reader where they are searching from, and turning typed text into
 * coordinates when place autocomplete cannot resolve a suggestion.
 *
 * Two paths, because only one can authenticate on each platform:
 *
 *  - **Native** → the Google REST endpoint with the platform key and an
 *    app-identity header (see maps/rest.ts). A Capacitor webview cannot satisfy
 *    an HTTP referrer restriction, and Google states website restrictions are
 *    "not guaranteed to work correctly" unless the page is served from a site you
 *    control — localhost is not.
 *  - **Web** → Apple MapKit JS `Geocoder`, authenticated by the MapKit token, the
 *    same provider that draws the web map and runs its place search. No Google
 *    key in the browser.
 *
 * Both directions fail soft: a search works without a readable address, so a
 * geocoder outage must never block one.
 */

/** `true` when geocoding can authenticate on this platform. */
export function geocodingAvailable(): boolean {
  return isNative() ? Boolean(mapKey()) : mapKitConfigured();
}

/** Coordinates → a human-readable address, or `null` if none could be resolved. */
export async function reverseGeocode(lat: number, lng: number, language = 'en'): Promise<string | null> {
  if (isNative()) return rest.reverseGeocode(lat, lng, language);
  try {
    await loadMapKit();
    const geocoder = new mapkit.Geocoder({ getsUserLocation: false, language });
    return await new Promise<string | null>((resolve) => {
      geocoder.reverseLookup(new mapkit.Coordinate(lat, lng), (error, data) => {
        const place = error ? null : (data?.results?.[0] ?? null);
        resolve(place?.formattedAddress ?? place?.name ?? null);
      });
    });
  } catch {
    return null;
  }
}

/** An address → coordinates, or `null` if it could not be resolved. */
export async function forwardGeocode(address: string, language = 'en'): Promise<LatLng | null> {
  if (!address.trim()) return null;
  if (isNative()) return rest.forwardGeocode(address, language);
  try {
    await loadMapKit();
    const geocoder = new mapkit.Geocoder({ getsUserLocation: false, language });
    return await new Promise<LatLng | null>((resolve) => {
      geocoder.lookup(address, (error, data) => {
        const place = error ? null : (data?.results?.[0] ?? null);
        const coordinate = place?.coordinate;
        resolve(coordinate ? { lat: coordinate.latitude, lng: coordinate.longitude } : null);
      });
    });
  } catch {
    return null;
  }
}
