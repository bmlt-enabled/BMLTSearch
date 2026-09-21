import type { RawFormat, RawMeeting, RawServiceBody } from '../types';
import { rememberFormats } from './format-cache';
import { getJsonArray, getMeetingsWithFormats, query } from './http';

/**
 * The BMLT root server this app searches.
 *
 * The aggregator is the worldwide root server. It carries venue types, so it holds
 * in-person, hybrid and online meetings alike — which is why there is one root
 * here rather than the two this app used to keep. Online meetings are reached by
 * the venue filter on the geographic searches (`meetings/venue.ts`) rather than
 * by a separate screen against a separate database.
 */
export const AGGREGATOR_ROOT = 'https://aggregator.bmltenabled.org/main_server/client_interface/json/';

/**
 * Identifies this client in root-server request logs. BMLT admins use it to see
 * which apps are hitting them; keep it stable so the traffic stays attributable.
 */
const CALLING_APP = 'bmlt_search_svelte';

function aggregator(params: Record<string, string | number | undefined>): string {
  return `${AGGREGATOR_ROOT}?${query({ ...params, callingApp: CALLING_APP })}`;
}

/**
 * Run a `GetSearchResults` query whose results will be listed, and learn the
 * formats its meetings use.
 *
 * `get_used_formats=1` makes the server send those formats alongside the
 * meetings. It costs the server nothing — it loads them for every search anyway,
 * to fill in each meeting's format fields — and it replaces the separate
 * `GetFormats` request that used to follow every list.
 *
 * `lang_enum` is pinned to `en`, which is also the server's default, and must
 * stay that way whatever language the reader uses: on a search, `lang_enum` also
 * filters each meeting's own `format_shared_id_list` down to the formats that
 * have a row in that language. Measured on the live aggregator, a US meeting
 * keeps all its format ids in `en` and none at all in `ja`. English is the widest
 * single choice (94% of format ids); translated names are layered on afterwards
 * by `aggregatorFormatNames`.
 *
 * Only for searches that draw a list. The map search stays trimmed to
 * coordinates and ids, and the one-meeting probes show no formats.
 */
async function searchMeetings(url: string): Promise<RawMeeting[]> {
  const { meetings, formats } = await getMeetingsWithFormats<RawMeeting, RawFormat>(`${url}&get_used_formats=1&lang_enum=en`);
  rememberFormats(formats, 'en');
  return meetings;
}

/**
 * `venue_types[]` repeated once per value, appended to an already-built URL.
 *
 * `query()` cannot express a repeated key, and the comma-separated alternative
 * is not merely inelegant — the aggregator accepts `venue_types=1,3` and then
 * filters on `1` alone, silently dropping every hybrid meeting. This is the only
 * form that filters on all the values given.
 *
 * The brackets are written `%5B%5D`, and that is load-bearing on iOS. A literal
 * `[` is not a legal query character, and since iOS 17 `URL(string:)` — which
 * is what CapacitorHttp hands our URL to — no longer rejects such a string: it
 * percent-encodes the *whole* thing, `%` included. One `venue_types[]=1`
 * therefore turned every `%2C` elsewhere in the URL into `%252C`, the
 * aggregator saw `data_field_key` and `sort_keys` naming one unknown field
 * each, ignored them, and sent full unsorted records to every iPhone. The
 * request still "worked", so nothing in the app revealed it. PHP decodes the
 * key, so the server sees the same `venue_types[]` either way.
 * `shouldEncodeUrlParams: false` does not help: it only governs a separate
 * `params` object, which is never passed here.
 */
function venueTypesQuery(values: readonly string[] | undefined): string {
  if (!values?.length) return '';
  return values.map((value) => `&venue_types%5B%5D=${encodeURIComponent(value)}`).join('');
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
export function nearestMeetings(lat: number, lng: number, count: number, venueTypes?: readonly string[]): Promise<RawMeeting[]> {
  return searchMeetings(
    aggregator({
      switcher: 'GetSearchResults',
      geo_width_km: -Math.abs(count),
      long_val: lng,
      lat_val: lat,
      sort_keys: 'longitude,latitude'
    }) + venueTypesQuery(venueTypes)
  );
}

/**
 * Every meeting within a true radius, trimmed to just what the map needs.
 *
 * `data_field_key` keeps the payload to coordinates and an id — a wide map view
 * can match thousands of meetings, and the full records are fetched only for the
 * marker the reader actually taps.
 */
export function meetingsWithinRadius(lat: number, lng: number, radiusKm: number, venueTypes?: readonly string[]): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    aggregator({
      switcher: 'GetSearchResults',
      data_field_key: 'longitude,latitude,id_bigint',
      geo_width_km: Math.abs(radiusKm),
      long_val: lng,
      lat_val: lat,
      sort_keys: 'longitude,latitude'
    }) + venueTypesQuery(venueTypes)
  );
}

/** The single closest meeting, with its distance. Backs the coverage check. */
export function singleNearestMeeting(lat: number, lng: number): Promise<RawMeeting[]> {
  return getJsonArray<RawMeeting>(
    aggregator({
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
  // so this one parameter is assembled by hand. Brackets encoded for the same
  // reason as `venueTypesQuery()`: a literal `[` makes iOS re-encode the whole URL.
  const repeated = ids.map((id) => `meeting_ids%5B%5D=${encodeURIComponent(id)}`).join('&');
  return searchMeetings(`${AGGREGATOR_ROOT}?switcher=GetSearchResults&${repeated}&callingApp=${CALLING_APP}`);
}

/** Every meeting belonging to one service body, on the aggregator. */
export function meetingsByServiceBody(serviceBodyId: string): Promise<RawMeeting[]> {
  return searchMeetings(
    aggregator({
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
export function serviceBodyHasOwnMeetings(serviceBodyId: string): Promise<boolean> {
  return getJsonArray<{ id_bigint: string }>(
    aggregator({
      switcher: 'GetSearchResults',
      services: serviceBodyId,
      data_field_key: 'id_bigint'
    })
  ).then((rows) => rows.length > 0);
}

/** The aggregator's full service body list, flat. */
export function aggregatorServiceBodies(): Promise<RawServiceBody[]> {
  return getJsonArray<RawServiceBody>(aggregator({ switcher: 'GetServiceBodies' }));
}

/** Named world formats for a specific set of ids, in one language. */
export function aggregatorFormats(ids: string[], language: string): Promise<RawFormat[]> {
  return getJsonArray<RawFormat>(
    aggregator({
      switcher: 'GetFormats',
      show_all: 1,
      format_ids: ids.join(','),
      lang_enum: language
    })
  );
}
