import { isNative, platform } from '../native';
import type { LatLng } from '../geo';
import * as rest from './rest';
import { loadMapKit } from './mapkit';
import { searchAutocomplete as appleAutocomplete, searchResolve as appleResolve } from 'capacitor-plugin-apple-maps';
import type { PlaceSuggestion } from './rest';

export type { PlaceSuggestion };

/**
 * Place autocomplete, routed to whichever mechanism can actually authenticate on
 * this platform.
 *
 * - **iOS** → native MapKit autocomplete (`MKLocalSearchCompleter`) via
 *   capacitor-plugin-apple-maps. No API key, no key restriction — the same
 *   reason iOS renders Apple Maps rather than Google (see provider.ts).
 * - **Web** → Apple MapKit JS (`mapkit.Search`), the same provider that draws
 *   the web map. No Google key in the browser.
 * - **Android** → REST with the platform key and an app-identity header. A
 *   Capacitor webview cannot satisfy an HTTP-referrer restriction; Google says
 *   website restrictions are "not guaranteed to work correctly" unless the page
 *   is served from a site you control, which localhost is not.
 *
 * Callers import only from this module and never branch on platform themselves.
 */

/** True when this platform routes Places through Apple's native search (iOS). */
function usesApplePlaces(): boolean {
  return platform() === 'ios';
}

/**
 * A billing session, grouping a burst of keystrokes and the lookup that follows.
 *
 * Only Google (Android REST) uses it; Apple (iOS) and MapKit JS (web) ignore it.
 * Callers only ever pass it straight back. The union keeps the old Google token
 * type so any caller still typed against it compiles.
 */
export type PlacesSession = string | google.maps.places.AutocompleteSessionToken | undefined;

export async function newSessionToken(): Promise<PlacesSession> {
  if (isNative()) {
    // Any sufficiently unique opaque string; Google only uses it to group
    // requests for billing. Apple ignores it entirely.
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  // MapKit JS needs no session token.
  return undefined;
}

/**
 * A map region to bias native (iOS) and MapKit-JS (web) autocomplete toward the
 * area in view, so a search for "First Church" favours nearby matches while
 * still reaching far ones. Ignored on the Google REST (Android) path, which has
 * its own biasing.
 */
export interface SearchBias {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export async function suggestPlaces(input: string, language: string, session?: PlacesSession, bias?: SearchBias): Promise<PlaceSuggestion[]> {
  if (usesApplePlaces()) {
    // Fail-soft: a dead autocomplete must not break the search box.
    try {
      const { results } = await appleAutocomplete({ query: input, region: bias });
      return results.map((r) => ({
        description: r.subtitle ? `${r.title}, ${r.subtitle}` : r.title,
        placeId: r.id
      }));
    } catch {
      return [];
    }
  }
  if (isNative()) {
    return rest.suggestPlaces(input, language, typeof session === 'string' ? session : undefined);
  }
  return webSuggest(input, language, bias);
}

export async function placeLocation(placeId: string, language = 'en'): Promise<LatLng | null> {
  if (usesApplePlaces()) {
    try {
      const res = await appleResolve({ id: placeId });
      return res.lat != null && res.lng != null ? { lat: res.lat, lng: res.lng } : null;
    } catch {
      return null;
    }
  }
  if (isNative()) return rest.placeLocation(placeId);
  return webResolve(placeId, language);
}

/* -------------------------------------------------------------- web (MapKit) */

/*
  MapKit autocomplete hands back no stable place id to fetch later — a suggestion
  is resolved by handing the *result object* back to `Search.search()`. So the
  last batch of results is cached by the synthetic id we hand out as
  `PlaceSuggestion.placeId`, and `webResolve` looks it up. Cleared and rewritten
  each keystroke, so it never grows; a cache miss falls back to a text search on
  the description, which is also the route's fallback via forwardGeocode.
*/
const mapKitResults = new Map<string, mapkit.SearchAutocompleteResult>();

async function webSuggest(input: string, language: string, bias?: SearchBias): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];
  try {
    await loadMapKit();
    const region = bias
      ? new mapkit.CoordinateRegion(new mapkit.Coordinate(bias.latitude, bias.longitude), new mapkit.CoordinateSpan(bias.latitudeDelta ?? 0.5, bias.longitudeDelta ?? 0.5))
      : undefined;
    const search = new mapkit.Search({ includeAddresses: true, includePointsOfInterest: true, language, region });

    const results = await new Promise<mapkit.SearchAutocompleteResult[]>((resolve) => {
      search.autocomplete(input, (error, data) => resolve(error ? [] : (data?.results ?? [])));
    });

    mapKitResults.clear();
    return results
      .map((result, index) => {
        const id = `mk${index}`;
        mapKitResults.set(id, result);
        return { description: (result.displayLines ?? []).join(', '), placeId: id };
      })
      .filter((suggestion) => suggestion.description);
  } catch {
    return [];
  }
}

async function webResolve(placeId: string, language: string): Promise<LatLng | null> {
  try {
    await loadMapKit();
    const cached = mapKitResults.get(placeId);
    const search = new mapkit.Search({ language });
    const place = await new Promise<mapkit.Place | null>((resolve) => {
      const done = (error: Error | null, data: { places: mapkit.Place[] }) => resolve(error ? null : (data?.places?.[0] ?? null));
      if (cached) search.search(cached, done);
      else resolve(null);
    });
    if (typeof place?.coordinate?.latitude !== 'number' || typeof place.coordinate.longitude !== 'number') return null;
    return { lat: place.coordinate.latitude, lng: place.coordinate.longitude };
  } catch {
    return null;
  }
}
