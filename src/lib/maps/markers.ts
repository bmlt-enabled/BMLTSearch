import { coordinateKey, type LatLng } from '../geo';
import type { RawMeeting } from '../types';

/** One pin, standing for every meeting that shares its address. */
export interface MeetingMarker {
  coordinate: LatLng;
  /** Ids of every meeting at this point — one for a single, many for a venue. */
  ids: string[];
}

export const SINGLE_ICON = 'marker-blue.png';
export const SHARED_ICON = 'marker-red.png';

/**
 * Collapse a meeting list into map pins, one per distinct location.
 *
 * Meeting venues host several meetings a week at the same address, and dropping
 * one pin per meeting stacks them into an unreadable pile. Meetings within about
 * 110 m of each other (three decimal places) become a single red pin carrying
 * all their ids; a lone meeting gets a blue one.
 *
 * The Ionic build did this with a hand-rolled scan that walked the array with a
 * mutable index, incremented it inside a nested `do…while`, and depended on the
 * server having returned co-located meetings adjacently. It read one past the
 * end of the array on the last group and silently dropped the final meeting of
 * every run. Grouping into a map is order-independent and has no boundary case.
 */
export function buildMarkers(meetings: RawMeeting[]): MeetingMarker[] {
  const groups = new Map<string, MeetingMarker>();

  for (const meeting of meetings) {
    const lat = Number.parseFloat(meeting.latitude ?? '');
    const lng = Number.parseFloat(meeting.longitude ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!meeting.id_bigint) continue;

    const key = coordinateKey(lat, lng);
    const existing = groups.get(key);
    if (existing) existing.ids.push(meeting.id_bigint);
    else groups.set(key, { coordinate: { lat, lng }, ids: [meeting.id_bigint] });
  }

  return [...groups.values()];
}

/** Which pin art a marker gets. */
export function iconFor(marker: MeetingMarker): string {
  return marker.ids.length > 1 ? SHARED_ICON : SINGLE_ICON;
}
