/**
 * Venue filtering for the two geographic searches.
 *
 * BMLT records a `venue_type` per meeting — 1 in person, 2 virtual, 3 hybrid —
 * and `GetSearchResults` accepts a comma-separated `venue_types` filter over it.
 *
 * The filter this exposes is *not* those three values. Nobody sets out to find a
 * hybrid meeting; they want somewhere to go or somewhere to log in, and a hybrid
 * meeting is both. So the choice offered is in person or online, and hybrid
 * belongs to whichever one is asked for — it is never a thing you can filter to
 * on its own, and never a thing you can accidentally filter out.
 *
 *   in person → venue_types[]=1&venue_types[]=3
 *   online    → venue_types[]=2&venue_types[]=3
 *
 * The repetition is not stylistic. The aggregator accepts a comma-separated
 * `venue_types=1,3` without complaint and then filters on `1` alone, silently
 * discarding every hybrid meeting — precisely the meetings this filter exists to
 * keep. Only the repeated `venue_types[]` form is honoured in full, which is why
 * this returns a list rather than a string.
 *
 * This matters more than it looks. The aggregator holds about 4,300 virtual and
 * 950 hybrid meetings, and they were already coming back from Near Me and map
 * searches unfiltered, pinned at whatever coordinates their group registered.
 * That is why an online-only meeting can appear on the map in a town it has no
 * relationship with. The filter turns those from something you stumble across
 * into something you can ask for — or exclude, when only a room will do.
 *
 * Deliberately not offered on the Virtual NA browse screen: that root holds
 * online meetings exclusively, so there is nothing to filter.
 */

export const MEETING_MODES = ['in-person', 'online'] as const;
export type MeetingMode = (typeof MEETING_MODES)[number];

/** Translation key per mode, in the order the filter renders them. */
export const MODE_LABEL_KEYS: Record<MeetingMode, string> = {
  'in-person': 'IN_PERSON',
  online: 'VIRTUAL'
};

export function isMeetingMode(value: string): value is MeetingMode {
  return (MEETING_MODES as readonly string[]).includes(value);
}

/**
 * The `venue_types[]` values, or `undefined` when the request should carry no
 * filter at all.
 *
 * Both modes and neither mode collapse to the same thing — an unfiltered search —
 * for the same reason: the server should see the query it would have seen before
 * this feature existed.
 *
 * "Neither" is the interesting one. A reader who has switched both off has not
 * asked for an empty screen, and an empty result here would be
 * indistinguishable from "there is nothing near you", which is the one wrong
 * answer this app must not give. So it shows everything rather than nothing.
 */
export function venueTypesParam(modes: readonly MeetingMode[]): string[] | undefined {
  const inPerson = modes.includes('in-person');
  const online = modes.includes('online');
  if (inPerson === online) return undefined;
  // 3 is hybrid, and it is on both sides on purpose.
  return inPerson ? ['1', '3'] : ['2', '3'];
}
