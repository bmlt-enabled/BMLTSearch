/**
 * Shapes returned by the BMLT `client_interface/json` endpoints.
 *
 * Every scalar arrives as a string, including the numeric ones — `GetSearchResults`
 * serialises straight out of MySQL. The types below say `string` where the wire
 * says string, and conversion happens at the point of use rather than in a
 * blanket normalisation pass, so it stays obvious which fields are parsed.
 */

/** 1 = Sunday … 7 = Saturday, as BMLT numbers the week. */
export type WeekdayIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A meeting exactly as the root server sends it. */
export interface RawMeeting {
  id_bigint: string;
  meeting_name?: string;
  weekday_tinyint: string;
  start_time: string;
  duration_time?: string;
  time_zone?: string;

  latitude?: string;
  longitude?: string;

  location_text?: string;
  location_street?: string;
  location_city_subsection?: string;
  location_neighborhood?: string;
  location_municipality?: string;
  location_sub_province?: string;
  location_province?: string;
  location_postal_code_1?: string;
  location_info?: string;

  comments?: string;
  train_lines?: string;
  bus_lines?: string;

  /** Comma-separated format *key strings*, e.g. "O,VM,HY". */
  formats?: string;
  /** Comma-separated world format *ids*, used to resolve translated names. */
  format_shared_id_list?: string;

  virtual_meeting_link?: string;
  virtual_meeting_additional_info?: string;
  phone_meeting_number?: string;

  contact_name_1?: string;
  contact_phone_1?: string;
  contact_email_1?: string;

  service_body_bigint?: string;

  /** Present only on radius searches. */
  distance_in_miles?: string;
  distance_in_km?: string;
}

/**
 * A meeting after the derived display fields have been attached.
 *
 * The Ionic build mutated the raw objects in place and scattered the derivation
 * across a component, a service, and two lifecycle hooks. Here it happens once,
 * in `decorateMeetings`, and the extra fields are part of the type — so nothing
 * downstream has to guess whether `startsAtLabel` has been computed yet.
 */
export interface Meeting extends RawMeeting {
  /** Minutes since midnight, meeting-local. The sort and filter key. */
  startMinutes: number;
  /** e.g. `"19:30 (7:30 PM)"`, with the IANA zone appended for virtual meetings. */
  startsAtLabel: string;
  /** e.g. `"9:00 PM"`. Empty when the server gave no duration. */
  endsAtLabel: string;
  /** Human-readable format names, e.g. `"Open. Wheelchair Accessible."` */
  formatsLabel: string;
  /** Format key strings split out of `formats`. */
  formatKeys: string[];
  kind: MeetingKind;
}

/**
 * How a meeting should be presented, derived from its format keys.
 *
 * - `in-person`  — no virtual component
 * - `virtual`    — VM, online only
 * - `hybrid`     — HY, both at once
 * - `temp-closed`— TC, the physical location is shut
 * - `temp-virtual` — TC + VM, shut but meeting online in the meantime
 */
export type MeetingKind = 'in-person' | 'virtual' | 'hybrid' | 'temp-closed' | 'temp-virtual';

/** Which root server a list came from. They differ in how formats resolve. */
export type MeetingSource = 'tomato' | 'virtual';

/** A service body (region, area, group) from `GetServiceBodies`. */
export interface RawServiceBody {
  id: string;
  parent_id: string;
  name: string;
  description?: string;
  type?: string;
  url?: string;
  helpline?: string;
  world_id?: string;
}

/** A service body with its children resolved into a tree. */
export interface ServiceBodyNode {
  id: string;
  name: string;
  children: ServiceBodyNode[];
}

/** A format definition from `GetFormats`. */
export interface RawFormat {
  id: string;
  key_string: string;
  name_string: string;
  description_string?: string;
  lang?: string;
  world_id?: string;
}
