import { Geolocation } from '@capacitor/geolocation';
import { reverseGeocode } from './api/geocode';
import type { LatLng } from './geo';
import { i18n } from './i18n/index.svelte';
import { settings, type SavedLocation } from './stores/settings.svelte';

/**
 * Getting a position to search from.
 *
 * Three screens need this and all three used to inline the same nested chain of
 * storage reads falling back to a device fix. It lives here once, and the two
 * halves are separated on purpose: the coordinates are what a search needs, and
 * the street address is decoration that arrives later over the network. Waiting
 * on the geocoder before searching — which the Ionic build did — meant a
 * geocoding failure produced "Location not found" and no meetings, even though
 * the device fix had succeeded and the search could have run.
 */

export class LocationError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable' | 'timeout') {
    super(`Location unavailable: ${reason}`);
    this.name = 'LocationError';
  }
}

/** A device fix. Throws `LocationError` rather than a platform-specific object. */
export async function currentPosition(timeoutMs = 10_000): Promise<LatLng> {
  try {
    const position = await Geolocation.getCurrentPosition({
      timeout: timeoutMs,
      enableHighAccuracy: false,
      maximumAge: 60_000
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (cause) {
    const message = String((cause as Error)?.message ?? cause).toLowerCase();
    if (message.includes('denied') || message.includes('permission')) throw new LocationError('denied');
    if (message.includes('timeout') || message.includes('timed out')) throw new LocationError('timeout');
    throw new LocationError('unavailable');
  }
}

/**
 * The point to search from: the stored one if we have it, otherwise a fresh fix.
 *
 * `forceRefresh` skips the stored value, which is what the "use my location"
 * control needs.
 */
export async function resolveSearchOrigin(forceRefresh = false): Promise<SavedLocation> {
  if (!forceRefresh && settings.location) return settings.location;

  const point = await currentPosition();
  const saved: SavedLocation = { ...point, address: '' };
  settings.setLocation(saved);

  // Deliberately not awaited: the caller can start searching on the coordinates
  // while the address fills in behind it.
  void describe(point);

  return saved;
}

/** Reverse-geocode in the background and store whatever comes back. */
export async function describe(point: LatLng): Promise<void> {
  const address = await reverseGeocode(point.lat, point.lng, i18n.locale);
  if (address) settings.setAddress(address);
}
