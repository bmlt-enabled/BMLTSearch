/**
 * Pointing readers at NA Meetings Near Me, the successor app.
 *
 * This app is on its way to being retired in favour of that one, and a reader
 * cannot be moved between store listings — they have to install it themselves.
 * So it is offered two ways, each with its own rule and its own stored state:
 *
 * - The **popup** opens over the home screen and keeps coming back:
 *   `POPUP_SNOOZE_DAYS` after it was last closed (or acted on), every time.
 *   It is never shown over search results or the map, so it does not stand
 *   between someone and a meeting they are looking for right now.
 * - The **banner** sits above the location search results, never blocks
 *   anything, and takes no for an answer: the first dismissal hides it for
 *   `BANNER_SNOOZE_DAYS`, the second for good.
 *
 * The rules are pure functions of what has been stored, so they are tested
 * without a DOM; the components only read, show and record.
 */

export const APP_STORE_URL = 'https://apps.apple.com/us/app/na-meetings-near-me/id6803261235';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.na.meetingsnearme';
export const WEB_URL = 'https://nameetingsnearme.app/';

export const POPUP_SNOOZE_DAYS = 3;
export const BANNER_SNOOZE_DAYS = 30;
export const BANNER_MAX_DISMISSALS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export type PromoSurface = 'popup' | 'banner';

const STORAGE_KEYS: Record<PromoSurface, string> = {
  popup: 'bmltsearch.namnmPopup',
  banner: 'bmltsearch.namnmPromo'
};

export interface PromoState {
  /** How many times the reader has closed it. */
  dismissals: number;
  /** When they last did, in epoch milliseconds. */
  lastDismissed: number;
}

export const NEVER_DISMISSED: PromoState = { dismissals: 0, lastDismissed: 0 };

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

export function shouldShowPopup(state: PromoState, now: number): boolean {
  if (state.dismissals <= 0) return true;
  return now - state.lastDismissed >= POPUP_SNOOZE_DAYS * DAY_MS;
}

export function shouldShowBanner(state: PromoState, now: number): boolean {
  if (state.dismissals <= 0) return true;
  if (state.dismissals >= BANNER_MAX_DISMISSALS) return false;
  return now - state.lastDismissed >= BANNER_SNOOZE_DAYS * DAY_MS;
}

export function dismissed(state: PromoState, now: number): PromoState {
  return { dismissals: state.dismissals + 1, lastDismissed: now };
}

/** The stored state, or a fresh one when there is none or it is unreadable. */
export function readPromoState(surface: PromoSurface): PromoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[surface]);
    if (!raw) return NEVER_DISMISSED;
    const parsed = JSON.parse(raw) as Partial<PromoState>;
    if (typeof parsed.dismissals === 'number' && typeof parsed.lastDismissed === 'number') {
      return { dismissals: parsed.dismissals, lastDismissed: parsed.lastDismissed };
    }
  } catch {
    // Storage disabled or a corrupt entry — treat it as never dismissed.
  }
  return NEVER_DISMISSED;
}

export function writePromoState(surface: PromoSurface, state: PromoState): void {
  try {
    localStorage.setItem(STORAGE_KEYS[surface], JSON.stringify(state));
  } catch {
    // Not being able to remember the dismissal just means it shows again.
  }
}

/** Record a close (or a tap through to the store) on one surface. */
export function recordDismissal(surface: PromoSurface, now: number = Date.now()): void {
  writePromoState(surface, dismissed(readPromoState(surface), now));
}
