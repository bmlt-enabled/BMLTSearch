import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetNearest, recallNearest, rememberNearest } from '$lib/meetings/nearest-cache';
import type { RawMeeting } from '$lib/types';

/*
  Reopening the Location Search page must not download the same answer again,
  and must never serve an answer to a different question.
*/

const SF = { lat: 37.785834, lng: -122.406417 };
/** About 11 m away: the same place. */
const SF_REFINED = { lat: 37.785934, lng: -122.406417 };
const OAKLAND = { lat: 37.8044, lng: -122.2712 };
const meetings = [{ id_bigint: '1' }, { id_bigint: '2' }] as RawMeeting[];

beforeEach(() => {
  vi.useRealTimers();
  forgetNearest();
});

describe('the last nearest-meetings result', () => {
  it('is nothing until something has been remembered', () => {
    expect(recallNearest(SF, 25, ['1', '3'])).toBeNull();
  });

  it('answers the same question again, from the same place or metres away', () => {
    rememberNearest(SF, 25, ['1', '3'], meetings);
    expect(recallNearest(SF, 25, ['1', '3'])).toBe(meetings);
    expect(recallNearest(SF_REFINED, 25, ['1', '3'])).toBe(meetings);
  });

  it('does not care what order the venue types came in', () => {
    rememberNearest(SF, 25, ['3', '1'], meetings);
    expect(recallNearest(SF, 25, ['1', '3'])).toBe(meetings);
  });

  it('misses when the range, the filter or the place is different', () => {
    rememberNearest(SF, 25, ['1', '3'], meetings);
    expect(recallNearest(SF, 10, ['1', '3'])).toBeNull();
    expect(recallNearest(SF, 25, ['2', '3'])).toBeNull();
    expect(recallNearest(SF, 25, undefined)).toBeNull();
    expect(recallNearest(OAKLAND, 25, ['1', '3'])).toBeNull();
  });

  it('goes stale after five minutes', () => {
    vi.useFakeTimers();
    rememberNearest(SF, 25, ['1', '3'], meetings);
    vi.advanceTimersByTime(4 * 60_000);
    expect(recallNearest(SF, 25, ['1', '3'])).toBe(meetings);
    vi.advanceTimersByTime(2 * 60_000);
    expect(recallNearest(SF, 25, ['1', '3'])).toBeNull();
  });

  it('keeps only the latest question', () => {
    rememberNearest(SF, 25, ['1', '3'], meetings);
    rememberNearest(OAKLAND, 25, ['1', '3'], []);
    expect(recallNearest(SF, 25, ['1', '3'])).toBeNull();
    expect(recallNearest(OAKLAND, 25, ['1', '3'])).toEqual([]);
  });
});
