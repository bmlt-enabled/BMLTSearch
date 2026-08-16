import type { Meeting } from '../types';

/**
 * Strip BMLT's internal field delimiter out of a display value.
 *
 * Some root servers concatenate multi-value fields with a `#@-@#` sentinel and
 * prefix it with the field name, so `bus_lines` arrives looking like
 * `"Bus Lines#@-@#14, 15A"`. Nothing downstream wants to see that.
 */
export function tidyDelimiter(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/(Bus|Train) Lines#@-@#/gi, ' ').trim();
}

/**
 * The meeting's address, in the order it should be read out.
 *
 * Fields are optional and wildly inconsistent between root servers, so this is
 * a filter over whatever happens to be present rather than a fixed template.
 */
export function addressLines(meeting: Meeting): string[] {
  return [
    meeting.location_text,
    meeting.location_street,
    meeting.location_city_subsection,
    meeting.location_neighborhood,
    meeting.location_municipality,
    meeting.location_sub_province,
    meeting.location_province,
    meeting.location_postal_code_1,
    meeting.location_info
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

/** One-line address, for the share sheet and anywhere a list won't fit. */
export function addressSummary(meeting: Meeting): string {
  return addressLines(meeting).join(', ');
}

/** `true` when there are coordinates good enough to point a map at. */
export function hasCoordinates(meeting: Pick<Meeting, 'latitude' | 'longitude'>): boolean {
  const lat = Number.parseFloat(meeting.latitude ?? '');
  const lng = Number.parseFloat(meeting.longitude ?? '');
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}
