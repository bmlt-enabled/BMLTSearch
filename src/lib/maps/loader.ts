import { PUBLIC_GOOGLE_MAPS_KEY } from '$env/static/public';

/**
 * Load the Google Maps JS SDK on demand.
 *
 * The Ionic build put a `<script>` tag for this in index.html, so every screen
 * — the settings page, the about page — paid for the Maps SDK on first paint,
 * and the API key was hard-coded in committed markup. Injecting it here means
 * only the map screen loads it, and the key comes from the environment.
 *
 * Only the `places` library is requested. The original also pulled in `geometry`
 * for a single distance calculation, which now lives in src/lib/geo.ts.
 */

let pending: Promise<void> | null = null;

export function mapsAvailable(): boolean {
  return Boolean(PUBLIC_GOOGLE_MAPS_KEY);
}

export function loadGoogleMaps(language = 'en'): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Maps SDK needs a browser'));
  if (window.google?.maps?.places) return Promise.resolve();
  if (pending) return pending;
  if (!mapsAvailable()) return Promise.reject(new Error('PUBLIC_GOOGLE_MAPS_KEY is not set'));

  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: PUBLIC_GOOGLE_MAPS_KEY,
      libraries: 'places',
      language,
      // `loading=async` is what lets the SDK bootstrap without blocking parse;
      // omitting it logs a performance warning on every load.
      loading: 'async',
      v: 'weekly'
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      // Clear the cached promise so a later retry is not stuck on this failure.
      pending = null;
      reject(new Error('Could not load the Google Maps SDK'));
    };
    script.onload = () => resolve();
    document.head.appendChild(script);
  });

  return pending;
}

/** A place suggestion, flattened out of whichever Places API shape answered. */
export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

/**
 * Autocomplete a partial address.
 *
 * Returns an empty list rather than throwing: an autocomplete that quietly stops
 * suggesting is a much smaller failure than one that breaks the search box, and
 * the caller can always fall back to geocoding the raw text.
 */
export async function suggestPlaces(input: string, language: string, sessionToken?: unknown): Promise<PlaceSuggestion[]> {
  if (!input.trim() || !window.google?.maps?.places) return [];
  try {
    const { AutocompleteSuggestion } = window.google.maps.places;
    const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      language,
      sessionToken
    });

    return (response?.suggestions ?? [])
      .map((suggestion: { placePrediction?: { text?: { toString(): string }; placeId?: string } }) => ({
        description: suggestion.placePrediction?.text?.toString() ?? '',
        placeId: suggestion.placePrediction?.placeId ?? ''
      }))
      .filter((suggestion: PlaceSuggestion) => suggestion.description);
  } catch {
    return [];
  }
}

/** Resolve a suggestion to coordinates, or `null` to fall back to geocoding. */
export async function placeLocation(placeId: string): Promise<{ lat: number; lng: number } | null> {
  if (!placeId || !window.google?.maps?.places) return null;
  try {
    const { Place } = await window.google.maps.importLibrary('places');
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ['location'] });

    const location = place.location;
    if (!location) return null;

    // `location` is a LatLng (accessor methods) on some paths and a plain
    // LatLngLiteral on others, depending on which Places surface answered.
    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** A session token groups keystrokes into one billable autocomplete session. */
export function newSessionToken(): unknown {
  try {
    return new window.google.maps.places.AutocompleteSessionToken();
  } catch {
    return undefined;
  }
}
