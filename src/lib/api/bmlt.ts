import type { MeetingSource, RawFormat, RawMeeting, RawServiceBody } from '../types';
import { getJsonArray, query } from './http';

/**
 * The two BMLT root servers this app searches.
 *
 * They are genuinely separate databases, not two views of one. Tomato is the
 * worldwide aggregator and holds in-person and hybrid meetings; Virtual NA holds
 * online-only meetings contributed by service bodies around the world. A meeting
 * appears in one or the other, never both, which is why the app has parallel
 * "regular" and "virtual" paths all the way down to format resolution.
 */
export const TOMATO_ROOT = 'https://aggregator.bmltenabled.org/main_server/client_interface/json/';
export const VIRTUAL_ROOT = 'https://bmlt.virtual-na.org/main_server/client_interface/json/';

/**
 * Identifies this client in root-server request logs. BMLT admins use it to see
 * which apps are hitting them; keep it stable so the traffic stays attributable.
 */
const CALLING_APP = 'bmlt_search_svelte';

function tomato(params: Record<string, string | number | undefined>): string {
  return `${TOMATO_ROOT}?${query({ ...params, callingApp: CALLING_APP })}`;
}

function virtual(params: Record<string, string | number | undefined>): string {
  return `${VIRTUAL_ROOT}?${query({ ...params, callingApp: CALLING_APP })}`;
}

/**
 * The N meetings nearest a point.
 *
 * A *negative* `geo_width_km` is BMLT's "give me the nearest N" mode — the
 * magnitude is a meeting count, not a distance. This is why the search-range
 * setting is labelled in meetings rather than kilometres, and why it is called
 * `count` here: the Ionic build called the same value `radius` throughout, which
 * read as a distance in every call site that touched it.
 */
export function nearestMeetings(lat: number, lng: number, count: number): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    tomato({
      switcher: 'GetSearchResults',
      geo_width_km: -Math.abs(count),
      long_val: lng,
      lat_val: lat,
      sort_keys: 'longitude,latitude'
    })
  );
}

/**
 * Every meeting within a true radius, trimmed to just what the map needs.
 *
 * `data_field_key` keeps the payload to coordinates and an id — a wide map view
 * can match thousands of meetings, and the full records are fetched only for the
 * marker the reader actually taps.
 */
export function meetingsWithinRadius(lat: number, lng: number, radiusKm: number): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    tomato({
      switcher: 'GetSearchResults',
      data_field_key: 'longitude,latitude,id_bigint',
      geo_width_km: Math.abs(radiusKm),
      long_val: lng,
      lat_val: lat,
      sort_keys: 'longitude,latitude'
    })
  );
}

/** The single closest meeting, with its distance. Backs the coverage check. */
export function singleNearestMeeting(lat: number, lng: number): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    tomato({
      switcher: 'GetSearchResults',
      geo_width_km: -1,
      long_val: lng,
      lat_val: lat,
      sort_keys: 'longitude,latitude'
    })
  );
}

/** Full records for specific meeting ids — used when a map marker is tapped. */
export function meetingsByIds(ids: string[]): Promise<RawMeeting[]> {
  if (ids.length === 0) return Promise.resolve([]);
  // `meeting_ids[]` repeats once per id; `query()` cannot express a repeated key,
  // so this one parameter is assembled by hand.
  const repeated = ids.map((id) => `meeting_ids[]=${encodeURIComponent(id)}`).join('&');
  return getJsonArray<RawMeeting>(`${TOMATO_ROOT}?switcher=GetSearchResults&${repeated}&callingApp=${CALLING_APP}`);
}

/** Every meeting belonging to one service body, on the aggregator. */
export function meetingsByServiceBody(serviceBodyId: string): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    tomato({
      switcher: 'GetSearchResults',
      services: serviceBodyId,
      sort_keys: 'weekday_tinyint,start_time'
    })
  );
}

/**
 * Whether a service body holds meetings of its own, ignoring its children.
 *
 * `services` matches exactly the bodies named — BMLT only walks down the tree
 * when `recursive=1` is passed — so this answers precisely the question the tree
 * needs: would tapping this body list anything? A region that exists only to
 * contain areas comes back empty, which is why its row used to open a blank
 * list.
 *
 * `data_field_key` trims the response to one field per meeting, so the probe is
 * cheap: a region with nothing of its own is two bytes on the wire, and the
 * largest area in the aggregator is about four kilobytes. That is what makes it
 * affordable to ask on expand rather than prefetching the whole picture — the
 * one request that answers it for every body at once (`GetFieldValues` on
 * `service_body_bigint`) is 463 KB and the root servers do not gzip.
 */
export function serviceBodyHasOwnMeetings(serviceBodyId: string, source: MeetingSource): Promise<boolean> {
  const build = source === 'virtual' ? virtual : tomato;
  return getJsonArray<{ id_bigint: string }>(
    build({
      switcher: 'GetSearchResults',
      services: serviceBodyId,
      data_field_key: 'id_bigint'
    })
  ).then((rows) => rows.length > 0);
}

/** Every meeting belonging to one service body, on Virtual NA. */
export function virtualMeetingsByServiceBody(serviceBodyId: string): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    virtual({
      switcher: 'GetSearchResults',
      services: serviceBodyId,
      sort_keys: 'weekday_tinyint,start_time'
    })
  );
}

/**
 * The whole Virtual NA meeting list.
 *
 * `services[]=4` with `recursive=1` is the root of the Virtual NA service body
 * tree, so this is genuinely everything. The explicit `data_field_key` is what
 * keeps a list this large to a workable size.
 */
export function allVirtualMeetings(): Promise<RawMeeting[]> {
  const fields = [
    'location_postal_code_1',
    'duration_time',
    'start_time',
    'time_zone',
    'weekday_tinyint',
    'service_body_bigint',
    'longitude',
    'latitude',
    'location_province',
    'location_municipality',
    'location_street',
    'location_info',
    'location_text',
    'location_neighborhood',
    'formats',
    'format_shared_id_list',
    'comments',
    'meeting_name',
    'location_sub_province',
    'worldid_mixed',
    'root_server_uri',
    'id_bigint',
    'formatted_address',
    'formatted_location_info',
    'formatted_comments',
    'contact_name_1',
    'contact_phone_1',
    'contact_email_1',
    'contact_name_2',
    'contact_phone_2',
    'contact_email_2',
    'virtual_meeting_link',
    'phone_meeting_number'
  ].join(',');

  return getJsonArray<RawMeeting>(`${VIRTUAL_ROOT}?switcher=GetSearchResults&data_field_key=${fields}&services[]=4&recursive=1&sort_keys=start_time&callingApp=${CALLING_APP}`);
}

/** The aggregator's full service body list, flat. */
export function tomatoServiceBodies(): Promise<RawServiceBody[]> {
  return getJsonArray<RawServiceBody>(tomato({ switcher: 'GetServiceBodies' }));
}

/** Virtual NA's full service body list, flat. */
export function virtualServiceBodies(): Promise<RawServiceBody[]> {
  return getJsonArray<RawServiceBody>(virtual({ switcher: 'GetServiceBodies' }));
}

/** Named world formats for a specific set of ids, in one language. */
export function tomatoFormats(ids: string[], language: string): Promise<RawFormat[]> {
  return getJsonArray<RawFormat>(
    tomato({
      switcher: 'GetFormats',
      show_all: 1,
      format_ids: ids.join(','),
      lang_enum: language
    })
  );
}

/** Virtual NA's complete format list. Small enough to fetch whole. */
export function virtualFormats(): Promise<RawFormat[]> {
  return getJsonArray<RawFormat>(virtual({ switcher: 'GetFormats', lang_enum: 'en' }));
}
