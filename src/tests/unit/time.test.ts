import { describe, expect, it } from 'vitest';
import { endLabel, format12Hour, format24Hour, formatClock, hourOf, startLabel, toMinutes } from '$lib/meetings/time';

describe('toMinutes', () => {
  it('parses the HH:MM:SS the root servers send', () => {
    expect(toMinutes('19:30:00')).toBe(19 * 60 + 30);
  });

  it('parses HH:MM', () => {
    expect(toMinutes('07:05')).toBe(7 * 60 + 5);
  });

  it('treats midnight as zero rather than as missing', () => {
    expect(toMinutes('00:00:00')).toBe(0);
  });

  it('falls back to midnight for junk, so a bad record still sorts', () => {
    expect(toMinutes('')).toBe(0);
    expect(toMinutes(undefined)).toBe(0);
    expect(toMinutes('not a time')).toBe(0);
  });
});

describe('hourOf', () => {
  it('is the hour the filter compares against', () => {
    expect(hourOf(toMinutes('19:30'))).toBe(19);
    expect(hourOf(toMinutes('00:15'))).toBe(0);
    expect(hourOf(toMinutes('23:59'))).toBe(23);
  });
});

describe('formatting', () => {
  it('renders both clocks, as the Ionic build did', () => {
    expect(formatClock(toMinutes('19:30'))).toBe('19:30 (7:30 PM)');
  });

  it('uses 12 rather than 0 for noon and midnight', () => {
    expect(format12Hour(0)).toBe('12:00 AM');
    expect(format12Hour(12 * 60)).toBe('12:00 PM');
  });

  it('zero-pads the 24-hour clock', () => {
    expect(format24Hour(toMinutes('07:05'))).toBe('07:05');
  });
});

describe('startLabel', () => {
  it('appends the zone for virtual meetings, so 19:30 is unambiguous', () => {
    expect(startLabel(toMinutes('19:30'), 'Europe/Dublin')).toBe('19:30 (7:30 PM) (Europe/Dublin)');
  });

  it('omits the zone when there is none', () => {
    expect(startLabel(toMinutes('19:30'))).toBe('19:30 (7:30 PM)');
  });

  it('shows the meeting-local wall clock, not a converted instant', () => {
    // The Ionic build ran the value through toZonedTime and then
    // formatInTimeZone, shifting it twice — a 19:00 London meeting displayed as
    // 05:00 to a New York reader. The label must be the time a local would say.
    expect(startLabel(toMinutes('19:00'), 'Europe/London')).toContain('19:00');
  });
});

describe('endLabel', () => {
  it('adds the duration to the start', () => {
    expect(endLabel(toMinutes('19:30'), '01:30:00')).toBe('9:00 PM');
  });

  it('wraps past midnight rather than reading 25:00', () => {
    expect(endLabel(toMinutes('23:30'), '02:00:00')).toBe('1:30 AM');
  });

  it('is empty when the server sent no duration', () => {
    expect(endLabel(toMinutes('19:30'), undefined)).toBe('');
    expect(endLabel(toMinutes('19:30'), '00:00')).toBe('');
  });
});
