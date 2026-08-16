/** A point on the earth, in the shape both the Maps SDK and BMLT agree on. */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Great-circle distance in kilometres.
 *
 * The map screen needs this to turn the visible bounds into a search radius. The
 * Ionic build called `google.maps.geometry.spherical.computeDistanceBetween` for
 * it, which meant loading the Maps geometry library and waiting on a global that
 * may not have resolved yet. Haversine is a dozen lines, exact enough at every
 * scale the map operates at, and testable without a browser.
 */
export function distanceKm(from: LatLng, to: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Round a point to ~110 m, the grid used to decide co-location. */
export function coordinateKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/** `true` when the parsed coordinates are usable. */
export function isValidLatLng(point: Partial<LatLng> | null | undefined): point is LatLng {
  if (!point) return false;
  const { lat, lng } = point;
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
