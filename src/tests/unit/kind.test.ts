import { describe, expect, it } from 'vitest';
import { formatKeys, hasDirections, kindLabelKey, meetingKind } from '$lib/meetings/kind';

describe('formatKeys', () => {
  it('splits, trims, and upper-cases', () => {
    expect(formatKeys('o, vm ,HY')).toEqual(['O', 'VM', 'HY']);
  });

  it('is empty for a meeting with no formats', () => {
    expect(formatKeys('')).toEqual([]);
    expect(formatKeys(undefined)).toEqual([]);
  });

  it('matches whole keys, so a key merely containing VM is not virtual', () => {
    // The Ionic build tested `formats.includes('VM')` against the joined string.
    expect(meetingKind(formatKeys('VMX'))).toBe('in-person');
  });
});

describe('meetingKind', () => {
  it('is in-person with no relevant keys', () => {
    expect(meetingKind([])).toBe('in-person');
    expect(meetingKind(['O', 'WC'])).toBe('in-person');
  });

  it('is virtual for VM alone', () => {
    expect(meetingKind(['VM'])).toBe('virtual');
  });

  it('is hybrid for HY', () => {
    expect(meetingKind(['HY'])).toBe('hybrid');
    expect(meetingKind(['VM', 'HY'])).toBe('hybrid');
  });

  it('is temp-closed for TC', () => {
    expect(meetingKind(['TC'])).toBe('temp-closed');
  });

  it('is temp-virtual when a closed location has moved online', () => {
    expect(meetingKind(['TC', 'VM'])).toBe('temp-virtual');
  });

  it('still classifies TC combined with HY', () => {
    // The Ionic build's branch chain had no case for this and returned '',
    // rendering a card with neither an address nor a directions button.
    expect(meetingKind(['TC', 'HY'])).toBe('temp-closed');
    expect(meetingKind(['TC', 'HY', 'VM'])).toBe('temp-virtual');
  });

  it('treats a keyless meeting from the Virtual NA root as virtual', () => {
    // That root hosts online meetings exclusively and its records mostly carry
    // no VM key. Defaulting them to in-person put a Directions button on
    // meetings that happen nowhere.
    expect(meetingKind([], 'virtual')).toBe('virtual');
    expect(meetingKind(['O'], 'virtual')).toBe('virtual');
  });

  it('still treats a keyless aggregator meeting as in person', () => {
    expect(meetingKind([], 'tomato')).toBe('in-person');
  });

  it('lets an explicit key override the source default', () => {
    expect(meetingKind(['HY'], 'virtual')).toBe('hybrid');
    expect(meetingKind(['TC'], 'virtual')).toBe('temp-closed');
  });
});

describe('presentation helpers', () => {
  it('never offers directions to an online or closed meeting', () => {
    expect(hasDirections('virtual')).toBe(false);
    expect(hasDirections('temp-closed')).toBe(false);
    expect(hasDirections('temp-virtual')).toBe(false);
    expect(hasDirections('in-person')).toBe(true);
    expect(hasDirections('hybrid')).toBe(true);
  });

  it('badges only the closed states', () => {
    expect(kindLabelKey('temp-closed')).toBe('TEMPCLOSED');
    expect(kindLabelKey('temp-virtual')).toBe('TEMP_CLOSED');
    expect(kindLabelKey('in-person')).toBeNull();
    expect(kindLabelKey('hybrid')).toBeNull();
  });
});
