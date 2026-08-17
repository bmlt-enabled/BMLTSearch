import { describe, expect, it } from 'vitest';
import { ALL_DAYS, decorateMeetings, explodeFormats, filterMeetings, groupByDay, isToday, sortMeetings, weekdayOf } from '$lib/meetings/list';
import type { RawMeeting } from '$lib/types';

function meeting(overrides: Partial<RawMeeting> = {}): RawMeeting {
  return {
    id_bigint: '1',
    meeting_name: 'Test Group',
    weekday_tinyint: '2',
    start_time: '19:30:00',
    duration_time: '01:30:00',
    formats: 'O',
    format_shared_id_list: '17',
    ...overrides
  };
}

describe('weekdayOf', () => {
  it('reads the BMLT 1-7 weekday', () => {
    expect(weekdayOf({ weekday_tinyint: '1' })).toBe(1);
    expect(weekdayOf({ weekday_tinyint: '7' })).toBe(7);
  });

  it('falls back to Sunday for out-of-range or missing values', () => {
    expect(weekdayOf({ weekday_tinyint: '0' })).toBe(1);
    expect(weekdayOf({ weekday_tinyint: '9' })).toBe(1);
    expect(weekdayOf({ weekday_tinyint: '' })).toBe(1);
  });
});

describe('isToday', () => {
  it('compares against the reader’s own weekday, offset by one', () => {
    const sunday = new Date('2026-08-16T12:00:00');
    expect(sunday.getDay()).toBe(0);
    expect(isToday(1, sunday)).toBe(true);
    expect(isToday(2, sunday)).toBe(false);
  });
});

describe('explodeFormats', () => {
  it('resolves The aggregator meetings by world format id', () => {
    const names = new Map([['17', 'Open']]);
    expect(explodeFormats(meeting(), names)).toBe('Open.');
  });

  it('ignores the formats key strings — the aggregator resolves by id', () => {
    // Key-string lookup existed only for the Virtual NA root, whose records had
    // no format_shared_id_list. That root is gone; a stray `formats` value must
    // not leak into the line.
    expect(explodeFormats(meeting({ formats: 'VM' }), new Map([['VM', 'Virtual Meeting']]))).toBe('');
  });

  it('omits unresolved format ids rather than printing a number at the reader', () => {
    expect(explodeFormats(meeting(), new Map())).toBe('');
  });

  it('joins several formats into one sentence', () => {
    const names = new Map([
      ['17', 'Open'],
      ['29', 'Wheelchair Accessible']
    ]);
    expect(explodeFormats(meeting({ format_shared_id_list: '17,29' }), names)).toBe('Open. Wheelchair Accessible.');
  });
});

describe('decorateMeetings', () => {
  it('attaches every derived field once', () => {
    const [decorated] = decorateMeetings([meeting()], new Map([['17', 'Open']]));
    expect(decorated.startMinutes).toBe(19 * 60 + 30);
    expect(decorated.startsAtLabel).toBe('19:30 (7:30 PM)');
    expect(decorated.endsAtLabel).toBe('9:00 PM');
    expect(decorated.formatsLabel).toBe('Open.');
    expect(decorated.kind).toBe('in-person');
  });

  it('labels a virtual meeting with its zone', () => {
    const raw = meeting({ time_zone: 'Europe/Dublin', formats: 'VM' });
    expect(decorateMeetings([raw], new Map())[0].startsAtLabel).toContain('Europe/Dublin');
  });

  it('leaves an in-person meeting unlabelled — its time is local to its venue', () => {
    const raw = meeting({ time_zone: 'Europe/Dublin', formats: 'O' });
    expect(decorateMeetings([raw], new Map())[0].startsAtLabel).not.toContain('Europe/Dublin');
  });
});

describe('sortMeetings', () => {
  it('orders by weekday, then time of day', () => {
    const decorated = decorateMeetings(
      [
        meeting({ id_bigint: 'a', weekday_tinyint: '3', start_time: '08:00' }),
        meeting({ id_bigint: 'b', weekday_tinyint: '2', start_time: '20:00' }),
        meeting({ id_bigint: 'c', weekday_tinyint: '2', start_time: '07:00' })
      ],
      new Map()
    );
    expect(sortMeetings(decorated).map((m) => m.id_bigint)).toEqual(['c', 'b', 'a']);
  });

  it('keeps already-passed meetings in place', () => {
    // The Ionic filter sorted on a Date that had been pushed a week ahead for
    // any meeting whose time had passed today, scattering the day's order.
    const decorated = decorateMeetings(
      [meeting({ id_bigint: 'late', weekday_tinyint: '2', start_time: '23:00' }), meeting({ id_bigint: 'early', weekday_tinyint: '2', start_time: '01:00' })],
      new Map()
    );
    expect(sortMeetings(decorated).map((m) => m.id_bigint)).toEqual(['early', 'late']);
  });
});

describe('groupByDay', () => {
  it('buckets by weekday and drops empty days', () => {
    const decorated = decorateMeetings([meeting({ weekday_tinyint: '2' }), meeting({ id_bigint: '2', weekday_tinyint: '5' })], new Map());
    const groups = groupByDay(decorated);
    expect(groups.map((group) => group.weekday)).toEqual([2, 5]);
    expect(groups[0].labelKey).toBe('MONDAY');
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('filterMeetings', () => {
  const decorated = decorateMeetings(
    [
      meeting({ id_bigint: 'mon-morning', weekday_tinyint: '2', start_time: '07:00' }),
      meeting({ id_bigint: 'mon-evening', weekday_tinyint: '2', start_time: '19:30' }),
      meeting({ id_bigint: 'fri-evening', weekday_tinyint: '6', start_time: '20:00' })
    ],
    new Map()
  );

  it('passes everything through with the default range', () => {
    expect(filterMeetings(decorated, { weekday: ALL_DAYS, fromHour: 0, toHour: 23 })).toHaveLength(3);
  });

  it('filters by weekday', () => {
    const result = filterMeetings(decorated, { weekday: 2, fromHour: 0, toHour: 23 });
    expect(result.map((m) => m.id_bigint)).toEqual(['mon-morning', 'mon-evening']);
  });

  it('filters by hour, inclusive at both ends', () => {
    const result = filterMeetings(decorated, { weekday: ALL_DAYS, fromHour: 19, toHour: 20 });
    expect(result.map((m) => m.id_bigint)).toEqual(['mon-evening', 'fri-evening']);
  });

  it('keeps a meeting at 19:30 when the upper bound is hour 19', () => {
    const result = filterMeetings(decorated, { weekday: ALL_DAYS, fromHour: 19, toHour: 19 });
    expect(result.map((m) => m.id_bigint)).toEqual(['mon-evening']);
  });

  it('combines both filters', () => {
    expect(filterMeetings(decorated, { weekday: 6, fromHour: 0, toHour: 12 })).toHaveLength(0);
  });
});

describe('the timezone suffix follows the meeting, not the server', () => {
  const raw = (over = {}) => [{ id_bigint: '1', meeting_name: 'M', weekday_tinyint: '2', start_time: '19:30:00', formats: 'VM', time_zone: 'Europe/Dublin', ...over }] as never;

  /**
   * The venue filter surfaces the aggregator's ~4,300 virtual meetings on
   * purpose. They arrive with source 'aggregator', and gating the suffix on source
   * left them showing a bare "19:30" — which 19:30 being exactly the question a
   * reader in another country cannot answer.
   */
  it('labels an aggregator virtual meeting with its zone', () => {
    const [m] = decorateMeetings(raw(), new Map());
    expect(m.startsAtLabel).toContain('Europe/Dublin');
  });

  it('leaves an in-person meeting unlabelled — its time is local to its venue', () => {
    const [m] = decorateMeetings(raw({ formats: 'O' }), new Map());
    expect(m.startsAtLabel).not.toContain('Europe/Dublin');
  });

  /**
   * 63% of the aggregator's virtual records have no time_zone. A bare time is
   * the honest answer; deriving one from the meeting's coordinates would be
   * confidently wrong, since virtual meetings are exactly the records whose
   * coordinates are arbitrary.
   */
  it('falls back to a bare time when the record carries no zone', () => {
    const [m] = decorateMeetings(raw({ time_zone: undefined }), new Map());
    // The label always carries a 12-hour gloss — "19:30 (7:30 PM)" — so the
    // check is for an IANA zone specifically, not for parentheses.
    expect(m.startsAtLabel).not.toMatch(/\([A-Za-z]+\/[A-Za-z_]+\)/);
  });
});
