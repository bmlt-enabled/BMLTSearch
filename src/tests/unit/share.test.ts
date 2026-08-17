import { describe, expect, it } from 'vitest';
import { addressLines, addressSummary, hasCoordinates, tidyDelimiter } from '$lib/meetings/address';
import { decorateMeetings } from '$lib/meetings/list';
import { sharePayload, shareText, shareUrl } from '$lib/meetings/share';
import type { Meeting, RawMeeting } from '$lib/types';

function decorate(raw: Partial<RawMeeting>): Meeting {
  return decorateMeetings(
    [
      {
        id_bigint: '1',
        meeting_name: 'Sunrise Group',
        weekday_tinyint: '2',
        start_time: '19:30',
        duration_time: '01:30',
        ...raw
      }
    ],
    new Map()
  )[0];
}

describe('tidyDelimiter', () => {
  it('strips the BMLT multi-value sentinel', () => {
    expect(tidyDelimiter('Bus Lines#@-@#14, 15A')).toBe('14, 15A');
    expect(tidyDelimiter('Train Lines#@-@#Northern')).toBe('Northern');
  });

  it('leaves an ordinary value alone', () => {
    expect(tidyDelimiter('555-0100')).toBe('555-0100');
    expect(tidyDelimiter(undefined)).toBe('');
  });
});

describe('addressLines', () => {
  it('keeps only the fields that are present, in reading order', () => {
    const meeting = decorate({ location_text: 'St Mary’s Hall', location_street: '12 Bridge St', location_municipality: 'Cork' });
    expect(addressLines(meeting)).toEqual(['St Mary’s Hall', '12 Bridge St', 'Cork']);
  });

  it('is empty when the record carries no address at all', () => {
    expect(addressLines(decorate({}))).toEqual([]);
  });

  it('joins to one line for the share sheet', () => {
    const meeting = decorate({ location_text: 'Hall', location_municipality: 'Cork' });
    expect(addressSummary(meeting)).toBe('Hall, Cork');
  });
});

describe('hasCoordinates', () => {
  it('rejects the null island and unparseable values', () => {
    expect(hasCoordinates({ latitude: '0', longitude: '0' })).toBe(false);
    expect(hasCoordinates({ latitude: '', longitude: '' })).toBe(false);
    expect(hasCoordinates({ latitude: '51.5', longitude: '-0.12' })).toBe(true);
  });
});

describe('shareUrl', () => {
  it('prefers the join link for an online meeting', () => {
    expect(shareUrl(decorate({ virtual_meeting_link: 'https://zoom.us/j/1' }))).toBe('https://zoom.us/j/1');
  });

  it('falls back to a maps link when there are coordinates', () => {
    expect(shareUrl(decorate({ latitude: '51.5', longitude: '-0.12' }))).toContain('query=51.5,-0.12');
  });

  it('is empty when there is nothing to link to', () => {
    expect(shareUrl(decorate({}))).toBe('');
  });
});

describe('shareText', () => {
  it('leads with the day and time range', () => {
    expect(shareText(decorate({}), 'Monday')).toMatch(/^Monday 19:30 \(7:30 PM\) - 9:00 PM/);
  });

  it('includes the venue name rather than NaN', () => {
    // `shareText += + meeting.location_text` in the Ionic build coerced the
    // venue to a number, so every shared meeting with one read "NaN".
    const text = shareText(decorate({ location_text: 'St Mary’s Hall' }), 'Monday');
    expect(text).toContain('St Mary’s Hall');
    expect(text).not.toContain('NaN');
  });

  it('tidies the delimiter out of transit lines', () => {
    const text = shareText(decorate({ bus_lines: 'Bus Lines#@-@#14' }), 'Monday');
    expect(text).toContain('Bus: 14');
    expect(text).not.toContain('#@-@#');
  });

  it('ends with a link when there is one', () => {
    const text = shareText(decorate({ virtual_meeting_link: 'https://zoom.us/j/1' }), 'Monday');
    expect(text.trim().endsWith('https://zoom.us/j/1')).toBe(true);
  });
});

describe('sharePayload', () => {
  it('titles the share with the meeting name', () => {
    expect(sharePayload(decorate({}), 'Monday').title).toBe('Sunrise Group');
  });

  it('falls back to a generic title for an unnamed meeting', () => {
    expect(sharePayload(decorate({ meeting_name: undefined }), 'Monday').title).toBe('NA Meeting');
  });
});
