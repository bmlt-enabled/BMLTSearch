/**
 * Pointing readers at NA Meetings Near Me, the successor app.
 *
 * This app is being retired in favour of that one, and a reader cannot be moved
 * between store listings — they have to install it themselves. So it is offered
 * on every launch (NamnmPopup.svelte, over the home screen) and on every visit
 * to the location search (NamnmBanner.svelte, above the results). Neither
 * remembers being closed. The popup is never shown over search results or the
 * map, so it does not stand between someone and a meeting they are looking for
 * right now.
 */

export const APP_STORE_URL = 'https://apps.apple.com/us/app/na-meetings-near-me/id6803261235';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.na.meetingsnearme';
export const WEB_URL = 'https://nameetingsnearme.app/';

/** Where a reader is sent on each platform. */
export function promoUrl(platform: 'ios' | 'android' | 'web'): string {
  switch (platform) {
    case 'ios':
      return APP_STORE_URL;
    case 'android':
      return PLAY_STORE_URL;
    default:
      return WEB_URL;
  }
}
