import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import type { LatLng } from '../geo';
import { webKey } from './keys';

/**
 * Loading the Maps JS SDK, via Google's own loader.
 *
 * This was hand-rolled at first — inject a script tag, resolve on `onload` —
 * and that is subtly wrong in a way worth recording. Under `loading=async` the
 * file that arrives is only a bootstrap: when `onload` fires, `google.maps`
 * exists but `google.maps.Geocoder` does not, and `google.maps.importLibrary`
 * is not yet defined either. Every caller here wraps its work in a try/catch
 * and reports failure as "no result", so the TypeError that followed was
 * invisible: reverse geocoding silently returned null on a cold page load and
 * worked on a warm one, and the place autocomplete had the same latent race.
 *
 * `@googlemaps/js-api-loader` exists precisely to get this right. It also
 * de-duplicates concurrent loads and hands back typed library objects, so the
 * `any`-typed `google` global this file used to depend on is gone.
 */

let configured = false;

/** `true` when a web key is configured. Callers use this to skip the round trip. */
export function mapsAvailable(): boolean {
  return Boolean(webKey());
}

/**
 * Options have to be set before the first library import, and only take effect
 * once — so the first caller's language is the language for the session. That
 * is acceptable here: changing language re-renders the app but does not reload
 * the SDK, and place names are a small part of the surface.
 */
function configure(language: string): void {
  if (configured) return;
  setOptions({ key: webKey(), v: 'weekly', language });
  configured = true;
}

export async function loadPlaces(language = 'en'): Promise<google.maps.PlacesLibrary> {
  configure(language);
  return importLibrary('places');
}

export async function loadGeocoding(language = 'en'): Promise<google.maps.GeocodingLibrary> {
  configure(language);
  return importLibrary('geocoding');
}

/** A place suggestion, flattened out of the Places response shape. */
export interface PlaceSuggestion {
  description: string;
  placeId: string;
}

/**
 * Autocomplete a partial address.
 *
 * Returns an empty list rather than throwing: an autocomplete that quietly
 * stops suggesting is a far smaller failure than one that breaks the search
 * box, and the caller can always fall back to geocoding the raw text.
 */
export async function suggestPlaces(input: string, language: string, sessionToken?: google.maps.places.AutocompleteSessionToken): Promise<PlaceSuggestion[]> {
  if (!input.trim() || !mapsAvailable()) return [];
  try {
    const { AutocompleteSuggestion } = await loadPlaces(language);
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, language, sessionToken });

    return suggestions
      .map((suggestion) => ({
        description: suggestion.placePrediction?.text?.toString() ?? '',
        placeId: suggestion.placePrediction?.placeId ?? ''
      }))
      .filter((suggestion) => suggestion.description);
  } catch {
    return [];
  }
}

/** Resolve a suggestion to coordinates, or `null` to fall back to geocoding. */
export async function placeLocation(placeId: string, language = 'en'): Promise<LatLng | null> {
  if (!placeId) return null;
  try {
    const { Place } = await loadPlaces(language);
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ['location'] });

    const location = place.location;
    if (!location) return null;
    return { lat: location.lat(), lng: location.lng() };
  } catch {
    return null;
  }
}

/**
 * A session token groups a burst of keystrokes and the lookup that follows into
 * one billable autocomplete session rather than charging per request.
 */
export async function newSessionToken(language = 'en'): Promise<google.maps.places.AutocompleteSessionToken | undefined> {
  try {
    const { AutocompleteSessionToken } = await loadPlaces(language);
    return new AutocompleteSessionToken();
  } catch {
    return undefined;
  }
}
