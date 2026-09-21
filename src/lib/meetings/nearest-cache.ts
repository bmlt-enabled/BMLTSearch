import { distanceKm, type LatLng } from '../geo';
import type { RawMeeting } from '../types';

/**
 * The last nearest-meetings result, kept while the reader moves around the app.
 *
 * The Location Search page holds its results in component state, so they are
 * gone the moment the reader opens the map or a meeting and comes back — and
 * `onMount` searched again. Measured in the aggregator's logs: list, map,
 * meeting, list, map, list in thirty seconds was three identical 33 KB
 * searches, to the last digit of the coordinates. Nothing had changed; the
 * aggregator's data only moves every four hours.
 *
 * This is deliberately one entry and a few minutes. It answers "I just looked
 * at this" and nothing more: a changed range, filter or place misses by
 * construction, and the locate button, the slider, the filter and retry never
 * consult it at all, because those are the reader asking for something new.
 */

const FRESH_FOR_MS = 5 * 60_000;
/** Matches the radius within which a fix is treated as the same place (see location.ts). */
const SAME_PLACE_KM = 0.05;

interface Entry {
  origin: LatLng;
  range: number;
  venueTypes: string;
  at: number;
  meetings: RawMeeting[];
}

let entry: Entry | null = null;

function key(venueTypes: readonly string[] | undefined): string {
  return [...(venueTypes ?? [])].sort().join(',');
}

export function rememberNearest(origin: LatLng, range: number, venueTypes: readonly string[] | undefined, meetings: RawMeeting[]): void {
  entry = { origin: { lat: origin.lat, lng: origin.lng }, range, venueTypes: key(venueTypes), at: Date.now(), meetings };
}

/** The remembered result for this exact question, or `null` if there is none or it has gone stale. */
export function recallNearest(origin: LatLng, range: number, venueTypes: readonly string[] | undefined): RawMeeting[] | null {
  if (!entry) return null;
  if (Date.now() - entry.at > FRESH_FOR_MS) return null;
  if (entry.range !== range || entry.venueTypes !== key(venueTypes)) return null;
  if (distanceKm(entry.origin, origin) >= SAME_PLACE_KM) return null;
  return entry.meetings;
}

export function forgetNearest(): void {
  entry = null;
}
