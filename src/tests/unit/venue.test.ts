import { describe, expect, it } from 'vitest';
import { isMeetingMode, MAP_VENUE_TYPES, MEETING_MODES, venueTypesParam } from '$lib/meetings/venue';

describe('venueTypesParam', () => {
  /**
   * Hybrid (3) is on both sides on purpose. Nobody searches for a hybrid
   * meeting; they want a room or a link, and a hybrid meeting is both — so it
   * must never be a thing you can accidentally filter out.
   */
  it('includes hybrid in whichever mode is asked for', () => {
    expect(venueTypesParam(['in-person'])).toEqual(['1', '3']);
    expect(venueTypesParam(['online'])).toEqual(['2', '3']);
  });

  it('sends no filter when both modes are selected', () => {
    // Filtering to everything is the same result set as not filtering, and the
    // aggregator only honours venue_types alongside a scope — so the request
    // should look exactly as it did before this feature existed.
    expect(venueTypesParam([...MEETING_MODES])).toBeUndefined();
  });

  /**
   * A reader who has switched both off has not asked for an empty screen, and an
   * empty result would be indistinguishable from "there is nothing near you" —
   * the one wrong answer this app must not give.
   */
  it('sends no filter when neither mode is selected, rather than matching nothing', () => {
    expect(venueTypesParam([])).toBeUndefined();
  });

  it('ignores order and duplicates', () => {
    expect(venueTypesParam(['online', 'in-person'])).toBeUndefined();
    expect(venueTypesParam(['online', 'online'])).toEqual(['2', '3']);
  });

  it('never emits a bare venue type, so hybrid is never stranded', () => {
    for (const mode of MEETING_MODES) {
      const value = venueTypesParam([mode]);
      expect(value).toBeDefined();
      expect(value).toContain('3');
    }
  });

  /**
   * A list, never a joined string. The aggregator accepts `venue_types=1,3` and
   * then filters on `1` alone — 74 in-person meetings back, the one hybrid
   * silently gone. Only `venue_types[]` repeated per value filters on all of
   * them, so anything that flattens this to a comma string reintroduces the bug.
   */
  it('returns values separately rather than pre-joined', () => {
    for (const mode of MEETING_MODES) {
      const value = venueTypesParam([mode]);
      expect(Array.isArray(value)).toBe(true);
      expect(value).toHaveLength(2);
      for (const entry of value!) expect(entry).not.toContain(',');
    }
  });
});

describe('isMeetingMode', () => {
  it('accepts the two shipped modes and rejects anything else', () => {
    expect(isMeetingMode('in-person')).toBe(true);
    expect(isMeetingMode('online')).toBe(true);
    // Guards the persisted setting: a stale or hand-edited localStorage entry
    // must not put a junk value into a query string.
    expect(isMeetingMode('hybrid')).toBe(false);
    expect(isMeetingMode('')).toBe(false);
  });
});

describe('MAP_VENUE_TYPES', () => {
  /**
   * A pin asserts the meeting is there, and for an online meeting that is false:
   * BMLT requires coordinates on every record, so online groups sit at a home
   * town or somewhere arbitrary. `hasDirections()` already refuses to route to
   * them; drawing a pin is the same claim, quieter.
   */
  it('excludes virtual, so the map never pins a meeting that happens nowhere', () => {
    expect(MAP_VENUE_TYPES).not.toContain('2');
  });

  it('includes hybrid — it has a real room, and the map is how you find it', () => {
    expect(MAP_VENUE_TYPES).toContain('1');
    expect(MAP_VENUE_TYPES).toContain('3');
  });

  it('matches what the in-person filter asks for', () => {
    // Same set, arrived at two ways. If these ever diverge, the map and the
    // list's "in person" filter would disagree about what in-person means.
    expect([...MAP_VENUE_TYPES]).toEqual(venueTypesParam(['in-person']));
  });
});
