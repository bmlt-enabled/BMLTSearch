import { Geolocation } from '@capacitor/geolocation';
import { reverseGeocode } from './api/geocode';
import { distanceKm, type LatLng } from './geo';
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

/**
 * How far a fix has to move before its address is worth asking for again.
 *
 * A phone refines its position for a few seconds after "locate": the same tap
 * was seen producing four fixes within twenty seconds, metres apart. Each one
 * used to blank the address and ask the geocoder again, and Apple's `CLGeocoder`
 * throttles exactly that pattern — after which the address stays blank. An
 * address does not change within 50 m, so inside that radius the one we have is
 * kept and nothing is asked.
 */
const SAME_PLACE_KM = 0.05;
/** A failed or in-flight lookup for the same place is not repeated sooner than this. */
const RETRY_AFTER_MS = 30_000;

let lastAttempt: { point: LatLng; at: number } | null = null;

function samePlace(a: LatLng, b: LatLng): boolean {
  return distanceKm(a, b) < SAME_PLACE_KM;
}

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
  if (!forceRefresh && settings.location) {
    const saved = settings.location;
    // A stored fix can legitimately have no address: the map screen saves bare
    // coordinates, and an earlier geocoder failure leaves the field blank. Fill
    // it in now rather than leaving the search permanently unlabelled. Not
    // awaited — the coordinates are all the search itself needs.
    if (!saved.address) void describe(saved);
    return saved;
  }

  const point = await currentPosition();
  // A refined fix of the same place keeps the address it already has, rather
  // than blanking it and asking again.
  const previous = settings.location;
  const address = previous?.address && samePlace(previous, point) ? previous.address : '';
  const saved: SavedLocation = { ...point, address };
  settings.setLocation(saved);
  if (address) return saved;

  // Deliberately not awaited: the caller can start searching on the coordinates
  // while the address fills in behind it.
  void describe(point);

  return saved;
}

/** Reverse-geocode in the background and store whatever comes back. */
export async function describe(point: LatLng): Promise<void> {
  const now = Date.now();
  // Covers both a lookup still in flight and one that just failed: every search
  // calls this while the address is blank, and they come in bursts.
  if (lastAttempt && samePlace(lastAttempt.point, point) && now - lastAttempt.at < RETRY_AFTER_MS) return;
  lastAttempt = { point: { lat: point.lat, lng: point.lng }, at: now };

  const address = await reverseGeocode(point.lat, point.lng, i18n.locale);
  // The reader may have moved the search somewhere else while this was out; an
  // address must never be attached to a place it does not describe.
  const current = settings.location;
  if (address && current && samePlace(current, point)) settings.setAddress(address);
}

/** Test seam — forgets the last lookup. */
export function resetDescribe(): void {
  lastAttempt = null;
}
