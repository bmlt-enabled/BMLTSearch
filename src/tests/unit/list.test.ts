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
  it('resolves Tomato meetings by world format id', () => {
    const names = new Map([['17', 'Open']]);
    expect(explodeFormats(meeting(), names, 'tomato')).toBe('Open.');
  });

  it('resolves Virtual NA meetings by format code', () => {
    const names = new Map([['VM', 'Virtual Meeting']]);
    expect(explodeFormats(meeting({ formats: 'VM' }), names, 'virtual')).toBe('Virtual Meeting.');
  });

  it('falls back to the raw code for an unknown virtual format', () => {
    expect(explodeFormats(meeting({ formats: 'ZZ' }), new Map(), 'virtual')).toBe('ZZ.');
  });

  it('omits unresolved Tomato ids rather than printing a number at the reader', () => {
    expect(explodeFormats(meeting(), new Map(), 'tomato')).toBe('');
  });

  it('joins several formats into one sentence', () => {
    const names = new Map([
      ['17', 'Open'],
      ['29', 'Wheelchair Accessible']
    ]);
    expect(explodeFormats(meeting({ format_shared_id_list: '17,29' }), names, 'tomato')).toBe('Open. Wheelchair Accessible.');
  });
});

describe('decorateMeetings', () => {
  it('attaches every derived field once', () => {
    const [decorated] = decorateMeetings([meeting()], new Map([['17', 'Open']]), 'tomato');
    expect(decorated.startMinutes).toBe(19 * 60 + 30);
    expect(decorated.startsAtLabel).toBe('19:30 (7:30 PM)');
    expect(decorated.endsAtLabel).toBe('9:00 PM');
    expect(decorated.formatsLabel).toBe('Open.');
    expect(decorated.kind).toBe('in-person');
  });

  it('labels virtual meetings with their zone but not Tomato ones', () => {
    const raw = meeting({ time_zone: 'Europe/Dublin' });
    expect(decorateMeetings([raw], new Map(), 'virtual')[0].startsAtLabel).toContain('Europe/Dublin');
    // Tomato records carry no dependable zone, and their start time is local to
    // wherever the meeting physically is.
    expect(decorateMeetings([raw], new Map(), 'tomato')[0].startsAtLabel).not.toContain('Europe/Dublin');
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
      new Map(),
      'tomato'
    );
    expect(sortMeetings(decorated).map((m) => m.id_bigint)).toEqual(['c', 'b', 'a']);
  });

  it('keeps already-passed meetings in place', () => {
    // The Ionic filter sorted on a Date that had been pushed a week ahead for
    // any meeting whose time had passed today, scattering the day's order.
    const decorated = decorateMeetings(
      [meeting({ id_bigint: 'late', weekday_tinyint: '2', start_time: '23:00' }), meeting({ id_bigint: 'early', weekday_tinyint: '2', start_time: '01:00' })],
      new Map(),
      'tomato'
    );
    expect(sortMeetings(decorated).map((m) => m.id_bigint)).toEqual(['early', 'late']);
  });
});

describe('groupByDay', () => {
  it('buckets by weekday and drops empty days', () => {
    const decorated = decorateMeetings([meeting({ weekday_tinyint: '2' }), meeting({ id_bigint: '2', weekday_tinyint: '5' })], new Map(), 'tomato');
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
    new Map(),
    'tomato'
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
