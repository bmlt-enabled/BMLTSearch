import { CapacitorHttp } from '@capacitor/core';
import type { LatLng } from '../geo';
import { appIdentityHeaders } from './identity';
import { mapKey } from './keys';

/**
 * Places and Geocoding over their REST endpoints, for the native shells.
 *
 * Why not the JS SDK here: inside a Capacitor webview the SDK can only be
 * authenticated by HTTP referrer, and Google states that website restrictions
 * "are not guaranteed to work correctly" unless the page is served from a site
 * you control. Calling REST with the platform key and an app-identity header
 * instead gives a restriction Google actually enforces — bundle ID on iOS,
 * package plus signing certificate on Android.
 *
 * Why not a native SDK: there isn't one. `@capacitor/google-maps` wraps the Maps
 * SDK only — markers, camera, clustering — with no Places or geocoding surface.
 * The community proposal for a Places plugin (capacitor-community/proposals#111,
 * April 2021) was closed unimplemented, and the request against the Maps plugin
 * (ionic-team/capacitor-google-maps#111, June 2022) is still open and unanswered.
 * Note that these are the same endpoints the JS SDK calls internally: Places API
 * (New) *is* the REST API, and the SDKs are clients for it.
 *
 * `BASE` is a single constant on purpose. Google's strongest recommendation is a
 * proxy server holding the key server-side; adopting that later means pointing
 * these two constants at our own origin and dropping the key and headers, not
 * rewriting the callers.
 */

const PLACES_BASE = 'https://places.googleapis.com/v1';
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode';

/** A place suggestion, flattened out of the Places response shape. */
export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
    };
  }>;
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': mapKey(),
    ...appIdentityHeaders()
  };
}

/** CapacitorHttp hands back parsed JSON on some platforms and a string on others. */
function parse<T>(data: unknown): T | null {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  return (data ?? null) as T | null;
}

/** Autocomplete a partial address. Empty list rather than throwing. */
export async function suggestPlaces(input: string, language: string, sessionToken?: string): Promise<PlaceSuggestion[]> {
  if (!input.trim() || !mapKey()) return [];
  try {
    const response = await CapacitorHttp.post({
      url: `${PLACES_BASE}/places:autocomplete`,
      headers: headers(),
      data: { input, languageCode: language, ...(sessionToken ? { sessionToken } : {}) }
    });
    if (response.status < 200 || response.status >= 300) return [];

    const body = parse<AutocompleteResponse>(response.data);
    return (body?.suggestions ?? [])
      .map((suggestion) => ({
        description: suggestion.placePrediction?.text?.text ?? '',
        placeId: suggestion.placePrediction?.placeId ?? ''
      }))
      .filter((suggestion) => suggestion.description);
  } catch {
    return [];
  }
}

/** Resolve a suggestion to coordinates, or `null` to fall back to geocoding. */
export async function placeLocation(placeId: string): Promise<LatLng | null> {
  if (!placeId || !mapKey()) return null;
  try {
    const response = await CapacitorHttp.get({
      url: `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?fields=location`,
      headers: headers()
    });
    if (response.status < 200 || response.status >= 300) return null;

    // Note the field names: Places (New) returns latitude/longitude, not lat/lng.
    const body = parse<{ location?: { latitude?: number; longitude?: number } }>(response.data);
    const { latitude, longitude } = body?.location ?? {};
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { lat: latitude as number, lng: longitude as number };
  } catch {
    return null;
  }
}

interface GeocodeResponse {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
}

async function geocode(query: string, language: string): Promise<GeocodeResponse | null> {
  try {
    const response = await CapacitorHttp.get({
      url: `${GEOCODE_BASE}/json?${query}&language=${encodeURIComponent(language)}&key=${encodeURIComponent(mapKey())}`,
      headers: appIdentityHeaders()
    });
    if (response.status < 200 || response.status >= 300) return null;
    return parse<GeocodeResponse>(response.data);
  } catch {
    return null;
  }
}

/** Coordinates → a human-readable address, or `null`. */
export async function reverseGeocode(lat: number, lng: number, language: string): Promise<string | null> {
  if (!mapKey()) return null;
  const body = await geocode(`latlng=${lat},${lng}`, language);
  return body?.results?.[0]?.formatted_address ?? null;
}

/** An address → coordinates, or `null`. */
export async function forwardGeocode(address: string, language: string): Promise<LatLng | null> {
  if (!address.trim() || !mapKey()) return null;
  const body = await geocode(`address=${encodeURIComponent(address)}`, language);
  const location = body?.results?.[0]?.geometry?.location;
  if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) return null;
  return { lat: location!.lat as number, lng: location!.lng as number };
}
