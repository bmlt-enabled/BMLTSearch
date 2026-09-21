import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetMap, recallArea, recallPin, rememberArea, rememberPin } from '$lib/meetings/map-cache';
import type { RawMeeting } from '$lib/types';

/*
  Reopening the map, or tapping a pin again, must not download the same answer
  twice — and must never serve an answer to a different question.
*/

const SF = { lat: 37.785834, lng: -122.406417 };
/** About 11 m away: the same opening view. */
const SF_AGAIN = { lat: 37.785934, lng: -122.406417 };
const OAKLAND = { lat: 37.8044, lng: -122.2712 };
const pinsOnMap = [{ id_bigint: '1' }, { id_bigint: '2' }] as RawMeeting[];
const onePin = [{ id_bigint: '85774', meeting_name: 'Nooner' }] as RawMeeting[];

beforeEach(() => {
  vi.useRealTimers();
  forgetMap();
});

describe('the last area search', () => {
  it('answers the same view again', () => {
    expect(recallArea(SF, 28, ['1', '3'])).toBeNull();
    rememberArea(SF, 28, ['1', '3'], pinsOnMap);
    expect(recallArea(SF, 28, ['1', '3'])).toBe(pinsOnMap);
    expect(recallArea(SF_AGAIN, 28, ['3', '1'])).toBe(pinsOnMap);
  });

  it('misses for another radius, filter or place', () => {
    rememberArea(SF, 28, ['1', '3'], pinsOnMap);
    expect(recallArea(SF, 12, ['1', '3'])).toBeNull();
    expect(recallArea(SF, 28, ['2'])).toBeNull();
    expect(recallArea(OAKLAND, 28, ['1', '3'])).toBeNull();
  });

  it('goes stale after five minutes', () => {
    vi.useFakeTimers();
    rememberArea(SF, 28, ['1', '3'], pinsOnMap);
    vi.advanceTimersByTime(6 * 60_000);
    expect(recallArea(SF, 28, ['1', '3'])).toBeNull();
  });
});

describe('the meetings behind a pin', () => {
  it('answers the same pin again, whatever order its ids arrive in', () => {
    expect(recallPin(['2', '1'])).toBeNull();
    rememberPin(['1', '2'], pinsOnMap);
    expect(recallPin(['2', '1'])).toBe(pinsOnMap);
    expect(recallPin(['1'])).toBeNull();
  });

  it('does not remember an empty answer, which is usually a failed load', () => {
    rememberPin(['85774'], []);
    expect(recallPin(['85774'])).toBeNull();
  });

  it('goes stale after five minutes', () => {
    vi.useFakeTimers();
    rememberPin(['85774'], onePin);
    vi.advanceTimersByTime(4 * 60_000);
    expect(recallPin(['85774'])).toBe(onePin);
    vi.advanceTimersByTime(2 * 60_000);
    expect(recallPin(['85774'])).toBeNull();
  });

  it('keeps the most recent twenty and drops the oldest', () => {
    for (let i = 1; i <= 21; i++) rememberPin([String(i)], [{ id_bigint: String(i) }] as RawMeeting[]);
    expect(recallPin(['1'])).toBeNull();
    expect(recallPin(['2'])).not.toBeNull();
    expect(recallPin(['21'])).not.toBeNull();
  });

  it('opening a pin again keeps it from being the one dropped', () => {
    for (let i = 1; i <= 20; i++) rememberPin([String(i)], [{ id_bigint: String(i) }] as RawMeeting[]);
    rememberPin(['1'], [{ id_bigint: '1' }] as RawMeeting[]); // opened again: now the newest
    rememberPin(['21'], [{ id_bigint: '21' }] as RawMeeting[]);
    expect(recallPin(['1'])).not.toBeNull();
    expect(recallPin(['2'])).toBeNull();
  });
});
