import { isNative } from '../native';
import type { LatLng } from '../geo';
import * as rest from './rest';
import * as sdk from './loader';
import type { PlaceSuggestion } from './rest';

export type { PlaceSuggestion };

/**
 * Place autocomplete, routed to whichever mechanism can actually authenticate on
 * this platform.
 *
 * - **Native** → REST with the platform key and an app-identity header. A
 *   Capacitor webview cannot satisfy an HTTP-referrer restriction; Google says
 *   website restrictions are "not guaranteed to work correctly" unless the page
 *   is served from a site you control, which localhost is not.
 * - **Web** → the Places JS SDK with the referrer-restricted web key, where the
 *   browser sends a real referrer from a real origin and the restriction works
 *   as designed.
 *
 * Same product either way — Places API (New) is the REST API and the JS SDK is a
 * client for it — so the two paths return the same shapes.
 */

/**
 * A billing session, grouping a burst of keystrokes and the lookup that follows.
 *
 * The two paths represent it differently: REST wants an opaque string, the SDK
 * wants its own token object. Callers only ever pass it straight back.
 */
export type PlacesSession = string | google.maps.places.AutocompleteSessionToken | undefined;

export async function newSessionToken(language = 'en'): Promise<PlacesSession> {
  if (isNative()) {
    // Any sufficiently unique opaque string; Google only uses it to group
    // requests for billing.
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return sdk.newSessionToken(language);
}

export async function suggestPlaces(input: string, language: string, session?: PlacesSession): Promise<PlaceSuggestion[]> {
  if (isNative()) {
    return rest.suggestPlaces(input, language, typeof session === 'string' ? session : undefined);
  }
  return sdk.suggestPlaces(input, language, typeof session === 'string' ? undefined : session);
}

export async function placeLocation(placeId: string, language = 'en'): Promise<LatLng | null> {
  if (isNative()) return rest.placeLocation(placeId);
  return sdk.placeLocation(placeId, language);
}
