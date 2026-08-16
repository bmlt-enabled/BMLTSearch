import { PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public';
import type { LatLng } from '../geo';
import { getJson, query } from './http';

/**
 * Google Geocoding, used in both directions: turning a device fix into a street
 * address to show the reader where they are searching from, and turning a typed
 * address into coordinates when the Places autocomplete cannot resolve one.
 *
 * The key is a build-time public var — see .env.example for why that is fine and
 * what actually protects it. Both calls fail soft: a search still works without
 * a readable address, so a geocoder outage should never block one.
 */

interface GeocodeResponse {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
}

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/** `true` when a key is configured. Callers use this to skip the round trip. */
export function geocodingAvailable(): boolean {
  return Boolean(PUBLIC_GOOGLE_MAPS_KEY);
}

/** Coordinates → a human-readable address, or `null` if none could be resolved. */
export async function reverseGeocode(lat: number, lng: number, language = 'en'): Promise<string | null> {
  if (!geocodingAvailable()) return null;
  try {
    const response = await getJson<GeocodeResponse>(`${ENDPOINT}?${query({ latlng: `${lat},${lng}`, language, key: PUBLIC_GOOGLE_MAPS_KEY })}`);
    return response.results?.[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}

/** An address → coordinates, or `null` if it could not be resolved. */
export async function forwardGeocode(address: string, language = 'en'): Promise<LatLng | null> {
  if (!geocodingAvailable() || !address.trim()) return null;
  try {
    const response = await getJson<GeocodeResponse>(`${ENDPOINT}?${query({ address, language, key: PUBLIC_GOOGLE_MAPS_KEY })}`);
    const location = response.results?.[0]?.geometry?.location;
    if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') return null;
    return { lat: location.lat, lng: location.lng };
  } catch {
    return null;
  }
}
