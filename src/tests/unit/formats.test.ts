import { CapacitorHttp } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { meetingsByIds, meetingsByServiceBody, meetingsWithinRadius, nearestMeetings, singleNearestMeeting } from '$lib/api/bmlt';
import { clearFormats, formatName, reloadFormats, rememberFormats } from '$lib/api/format-cache';
import { aggregatorFormatNames, resetFormatCaches } from '$lib/api/formats';
import { getMeetingsWithFormats } from '$lib/api/http';
import type { RawFormat, RawMeeting } from '$lib/types';

/*
  Format names without a GetFormats request behind every list.

  Measured in the aggregator's logs, every nearest search was followed by a
  `GetFormats&format_ids=…` of 5 to 6 KB, and again on every launch because the
  names were only held in memory. A list search now brings its formats with it,
  and the names are kept between launches.
*/

vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { get: vi.fn() },
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' }
}));

const get = vi.mocked(CapacitorHttp.get);

function respond(data: unknown, status = 200) {
  get.mockResolvedValue({ data, status, headers: {}, url: 'https://example.test' });
}

function urls(): string[] {
  return get.mock.calls.map((call) => String(call[0]?.url ?? ''));
}

const format = (id: string, name_string: string, key_string = 'X'): RawFormat => ({ id, key_string, name_string });
const listed = [{ id_bigint: '1', format_shared_id_list: '17,33' }] as RawMeeting[];

beforeEach(() => {
  vi.useRealTimers();
  get.mockReset();
  localStorage.clear();
  resetFormatCaches();
});

describe('getMeetingsWithFormats', () => {
  it('unwraps the envelope, including when it arrives as a string', async () => {
    respond({ meetings: [{ id_bigint: '1' }], formats: [{ id: '17' }] });
    await expect(getMeetingsWithFormats('u')).resolves.toEqual({ meetings: [{ id_bigint: '1' }], formats: [{ id: '17' }] });
    respond('{"meetings":[],"formats":[]}');
    await expect(getMeetingsWithFormats('u')).resolves.toEqual({ meetings: [], formats: [] });
  });

  it('takes a bare array as meetings with no formats, and BMLT’s `{}` as nothing', async () => {
    respond([{ id_bigint: '1' }]);
    await expect(getMeetingsWithFormats('u')).resolves.toEqual({ meetings: [{ id_bigint: '1' }], formats: [] });
    respond({});
    await expect(getMeetingsWithFormats('u')).resolves.toEqual({ meetings: [], formats: [] });
  });
});

describe('which searches ask for their formats', () => {
  it('the three that draw a list do, always in English', async () => {
    respond({ meetings: [], formats: [] });
    await nearestMeetings(51.86, -8.46, 10, ['2', '3']);
    await meetingsByIds(['5', '6']);
    await meetingsByServiceBody('1207');
    for (const url of urls()) {
      expect(url).toContain('get_used_formats=1');
      // A translated search strips untranslated format ids off the meetings themselves.
      expect(url).toContain('lang_enum=en');
      // The brackets stay encoded: a literal `[` makes iOS re-encode the whole URL.
      expect(url).not.toMatch(/[[\]]/);
    }
  });

  it('the map search and the single-meeting probe do not', async () => {
    respond([]);
    await meetingsWithinRadius(51.86, -8.46, 25, ['1', '3']);
    await singleNearestMeeting(51.86, -8.46);
    for (const url of urls()) expect(url).not.toContain('get_used_formats');
  });

  it('hands back the meetings and remembers the names that came with them', async () => {
    respond({ meetings: listed, formats: [format('17', 'Open', 'O'), format('33', 'Wheelchair', 'WC')] });
    await expect(nearestMeetings(51.86, -8.46, 10)).resolves.toEqual(listed);
    expect(formatName('17', 'en')).toBe('Open');
    expect(formatName('33', 'en')).toBe('Wheelchair');
  });
});

describe('aggregatorFormatNames', () => {
  it('costs an English reader no request when the search described the ids', async () => {
    rememberFormats([format('17', 'Open'), format('33', 'Wheelchair')], 'en');
    const names = await aggregatorFormatNames(listed, 'en');
    expect(Object.fromEntries(names)).toEqual({ '17': 'Open', '33': 'Wheelchair' });
    expect(get).not.toHaveBeenCalled();
  });

  it('asks once, in the reader’s language only, and lays it over English', async () => {
    rememberFormats([format('17', 'Open'), format('33', 'Wheelchair')], 'en');
    respond([format('17', 'Abierta')]); // 33 has no Spanish row
    const names = await aggregatorFormatNames(listed, 'es');
    expect(Object.fromEntries(names)).toEqual({ '17': 'Abierta', '33': 'Wheelchair' });
    expect(urls()).toHaveLength(1);
    expect(urls()[0]).toContain('lang_enum=es');

    // The untranslated id is not asked about again.
    await aggregatorFormatNames(listed, 'es');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('fetches English for ids no search described', async () => {
    respond([format('17', 'Open')]);
    const names = await aggregatorFormatNames(listed, 'en');
    expect(Object.fromEntries(names)).toEqual({ '17': 'Open' });
    expect(urls()[0]).toContain('lang_enum=en');
  });

  it('retries after a failed fetch instead of remembering the miss', async () => {
    get.mockRejectedValueOnce(new Error('offline'));
    await expect(aggregatorFormatNames(listed, 'en')).rejects.toThrow();
    respond([format('17', 'Open')]);
    await expect(aggregatorFormatNames(listed, 'en')).resolves.toEqual(new Map([['17', 'Open']]));
  });

  it('is empty, with no request, for meetings that carry no formats', async () => {
    await expect(aggregatorFormatNames([{ id_bigint: '1' }] as RawMeeting[], 'en')).resolves.toEqual(new Map());
    expect(get).not.toHaveBeenCalled();
  });
});

describe('names between launches', () => {
  it('survive a restart', () => {
    rememberFormats([format('17', 'Open')], 'en');
    reloadFormats(); // what an app restart does to the in-memory copy
    expect(formatName('17', 'en')).toBe('Open');
  });

  it('are relearned after a week', () => {
    vi.useFakeTimers();
    rememberFormats([format('17', 'Open')], 'en');
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
    reloadFormats();
    expect(formatName('17', 'en')).toBeUndefined();
  });

  it('start empty rather than throwing when storage holds rubbish', () => {
    localStorage.setItem('bmltsearch.formatNames', '{not json');
    reloadFormats();
    expect(formatName('17', 'en')).toBeUndefined();
    expect(rememberFormats([format('17', 'Open')], 'en')).toBe(1);
  });

  it('do not rewrite storage when a search teaches nothing new', () => {
    rememberFormats([format('17', 'Open')], 'en');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    expect(rememberFormats([format('17', 'Open')], 'en')).toBe(0);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
    clearFormats();
  });
});
