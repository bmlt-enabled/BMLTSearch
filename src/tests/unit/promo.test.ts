import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_STORE_URL,
  BANNER_MAX_DISMISSALS,
  BANNER_SNOOZE_DAYS,
  dismissed,
  NEVER_DISMISSED,
  PLAY_STORE_URL,
  POPUP_SNOOZE_DAYS,
  promoUrl,
  readPromoState,
  recordDismissal,
  shouldShowBanner,
  shouldShowPopup,
  WEB_URL
} from '$lib/promo';

/*
  NA Meetings Near Me is offered two ways. The popup keeps coming back every few
  days; the banner takes no for an answer — one dismissal snoozes it, a second
  ends it.
*/

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 3);

beforeEach(() => {
  localStorage.clear();
});

describe('the popup', () => {
  it('shows to a reader who has never closed it', () => {
    expect(shouldShowPopup(NEVER_DISMISSED, NOW)).toBe(true);
  });

  it('comes back after the snooze, however many times it has been closed', () => {
    let state = NEVER_DISMISSED;
    for (let i = 0; i < 10; i++) {
      const at = NOW + i * POPUP_SNOOZE_DAYS * DAY;
      expect(shouldShowPopup(state, at)).toBe(true);
      state = dismissed(state, at);
      expect(shouldShowPopup(state, at + DAY)).toBe(false);
    }
  });
});

describe('the banner', () => {
  it('shows to a reader who has never closed it', () => {
    expect(shouldShowBanner(NEVER_DISMISSED, NOW)).toBe(true);
  });

  it('stays hidden for the snooze after the first dismissal, then returns', () => {
    const once = dismissed(NEVER_DISMISSED, NOW);
    expect(shouldShowBanner(once, NOW + (BANNER_SNOOZE_DAYS - 1) * DAY)).toBe(false);
    expect(shouldShowBanner(once, NOW + BANNER_SNOOZE_DAYS * DAY)).toBe(true);
  });

  it('never returns after the last dismissal', () => {
    let state = NEVER_DISMISSED;
    for (let i = 0; i < BANNER_MAX_DISMISSALS; i++) state = dismissed(state, NOW);
    expect(shouldShowBanner(state, NOW + 10 * 365 * DAY)).toBe(false);
  });
});

describe('where a reader is sent', () => {
  it('goes to each platform’s own store, and to the website on the web', () => {
    expect(promoUrl('ios')).toBe(APP_STORE_URL);
    expect(promoUrl('android')).toBe(PLAY_STORE_URL);
    expect(promoUrl('web')).toBe(WEB_URL);
  });
});

describe('the stored dismissal', () => {
  it('is recorded per surface', () => {
    recordDismissal('popup', NOW);
    expect(readPromoState('popup')).toEqual({ dismissals: 1, lastDismissed: NOW });
    expect(readPromoState('banner')).toEqual(NEVER_DISMISSED);
  });

  it('reads as never dismissed when absent or corrupt', () => {
    expect(readPromoState('banner')).toEqual(NEVER_DISMISSED);
    localStorage.setItem('bmltsearch.namnmPromo', '{not json');
    expect(readPromoState('banner')).toEqual(NEVER_DISMISSED);
    localStorage.setItem('bmltsearch.namnmPromo', '{"dismissals":"1"}');
    expect(readPromoState('banner')).toEqual(NEVER_DISMISSED);
  });
});
