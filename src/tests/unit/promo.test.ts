import { describe, expect, it } from 'vitest';
import { APP_STORE_URL, PLAY_STORE_URL, promoUrl, WEB_URL } from '$lib/promo';

/*
  NA Meetings Near Me is offered on every launch and every location search, and
  neither keeps state — so what is left to get wrong is where it sends people.
*/

describe('where a reader is sent', () => {
  it('goes to each platform’s own store, and to the website on the web', () => {
    expect(promoUrl('ios')).toBe(APP_STORE_URL);
    expect(promoUrl('android')).toBe(PLAY_STORE_URL);
    expect(promoUrl('web')).toBe(WEB_URL);
  });
});
