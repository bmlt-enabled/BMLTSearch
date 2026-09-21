import { distanceKm, type LatLng } from '../geo';
import type { RawMeeting } from '../types';

/**
 * What the map just showed, kept while the reader moves around the app.
 *
 * The map is already careful about asking: it searches once when it opens, then
 * waits for "Search this area". But it kept nothing between visits, so two
 * things repeated, both measured in the aggregator's logs:
 *
 *  - **Opening the map** ran the same search again: same centre, same radius,
 *    seconds apart, every time the reader came back from a meeting or the list.
 *  - **Tapping a pin** fetched that pin's meetings again every time. One reader
 *    fetched the same meeting four times in ten minutes.
 *
 * Same rules as nearest-cache.ts: a few minutes, an exact match on the question,
 * and never consulted for something the reader asked for on purpose — "Search
 * this area", locate and a place pick always go to the server. A pin tap *is*
 * deliberate, but it is the same question with the same answer, and answering it
 * from memory is what makes the sheet open instantly the second time.
 */

const FRESH_FOR_MS = 5 * 60_000;
const SAME_PLACE_KM = 0.05;
/** Enough for a reader comparing a handful of pins; a bound so it cannot grow for a whole session. */
const MAX_PINS = 20;

function fresh(at: number): boolean {
  return Date.now() - at <= FRESH_FOR_MS;
}

function listKey(values: readonly string[] | undefined): string {
  return [...(values ?? [])].sort().join(',');
}

/* ------------------------------------------------------------------- area */

interface Area {
  centre: LatLng;
  radiusKm: number;
  venueTypes: string;
  at: number;
  meetings: RawMeeting[];
}

let area: Area | null = null;

export function rememberArea(centre: LatLng, radiusKm: number, venueTypes: readonly string[] | undefined, meetings: RawMeeting[]): void {
  area = { centre: { lat: centre.lat, lng: centre.lng }, radiusKm, venueTypes: listKey(venueTypes), at: Date.now(), meetings };
}

/** The last area search, if it asked exactly this and is still fresh. */
export function recallArea(centre: LatLng, radiusKm: number, venueTypes: readonly string[] | undefined): RawMeeting[] | null {
  if (!area || !fresh(area.at)) return null;
  if (area.radiusKm !== radiusKm || area.venueTypes !== listKey(venueTypes)) return null;
  if (distanceKm(area.centre, centre) >= SAME_PLACE_KM) return null;
  return area.meetings;
}

/* ------------------------------------------------------------------- pins */

const pins = new Map<string, { at: number; meetings: RawMeeting[] }>();

export function rememberPin(ids: readonly string[], meetings: RawMeeting[]): void {
  // An empty answer is not remembered: it is usually a failed load, and caching
  // it would keep a pin looking empty for five minutes.
  if (!ids.length || !meetings.length) return;
  const key = listKey(ids);
  pins.delete(key); // re-insert so the newest is last
  pins.set(key, { at: Date.now(), meetings });
  while (pins.size > MAX_PINS) pins.delete(pins.keys().next().value as string);
}

/** The meetings behind a pin, if it was opened in the last few minutes. */
export function recallPin(ids: readonly string[]): RawMeeting[] | null {
  const key = listKey(ids);
  const entry = pins.get(key);
  if (!entry) return null;
  if (!fresh(entry.at)) {
    pins.delete(key);
    return null;
  }
  return entry.meetings;
}

export function forgetMap(): void {
  area = null;
  pins.clear();
}
