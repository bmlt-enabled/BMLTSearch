import { isNative, platform } from '../native';
import type { LatLng } from '../geo';
import * as rest from './rest';
import * as sdk from './loader';
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
 * - **Android** → REST with the platform key and an app-identity header. A
 *   Capacitor webview cannot satisfy an HTTP-referrer restriction; Google says
 *   website restrictions are "not guaranteed to work correctly" unless the page
 *   is served from a site you control, which localhost is not.
 * - **Web** → the Places JS SDK with the referrer-restricted web key, where the
 *   browser sends a real referrer from a real origin and the restriction works
 *   as designed.
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
 * The paths represent it differently: REST wants an opaque string, the SDK wants
 * its own token object, and Apple needs none at all. Callers only ever pass it
 * straight back.
 */
export type PlacesSession = string | google.maps.places.AutocompleteSessionToken | undefined;

export async function newSessionToken(language = 'en'): Promise<PlacesSession> {
  if (isNative()) {
    // Any sufficiently unique opaque string; Google only uses it to group
    // requests for billing. Apple ignores it entirely.
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return sdk.newSessionToken(language);
}

/**
 * A map region to bias native (iOS) autocomplete toward the area in view, so a
 * search for "First Church" favours nearby matches while still reaching far
 * ones. Ignored on the Google paths, which have their own biasing.
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
  return sdk.suggestPlaces(input, language, typeof session === 'string' ? undefined : session);
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
  return sdk.placeLocation(placeId, language);
}
