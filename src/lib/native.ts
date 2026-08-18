import { Capacitor } from '@capacitor/core';

// Capacitor-only concerns, kept behind guards so the same bundle runs on the web
// untouched. Every import here is dynamic — pulling the native plugins into the
// web bundle would ship code that can never run.

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function platform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

/** Status bar + splash. Safe to call on web, where it does nothing. */
export async function initNativeShell(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Light content: the app bar behind the status bar is BMLT blue.
    await StatusBar.setStyle({ style: Style.Light });
    if (platform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0a61ad' });
    }
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    // A missing plugin shouldn't take the app down — chrome is cosmetic.
  }
}

/**
 * Open a URL outside the app.
 *
 * On native this is `@capacitor/browser`, which is *not* the app's own webview:
 * it is SFSafariViewController on iOS and a Chrome Custom Tab on Android — the
 * system browser rendered over the app, with its own close button and its own
 * cookie jar. The reader keeps their place in the meeting list, which is why it
 * is preferred over throwing them out to the browser app entirely.
 *
 * Only `http(s)` goes there. `mailto:`, `tel:`, `geo:` and the rest are handled
 * by a different app, and handing one to `Browser.open()` leaves an empty
 * browser sheet on screen while that app launches behind it — the same failure
 * `dial()` documents below. Those go to the system handler instead.
 */
export async function openExternal(url: string): Promise<void> {
  if (!url) return;

  if (!/^https?:/i.test(url)) {
    window.open(url, '_self');
    return;
  }

  if (!isNative()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Place a call.
 *
 * `tel:` must go to the system handler, not the in-app browser — routing it
 * through `Browser.open` leaves an empty webview on screen behind the dialler.
 */
export function dial(phoneNumber: string): void {
  const digits = phoneNumber.replace(/[^\d+*#,;]/g, '');
  if (!digits) return;
  window.open(`tel:${digits}`, '_self');
}

/**
 * Open turn-by-turn directions in whatever the platform's map app is.
 *
 * Each platform gets its native scheme so the handoff goes straight to Maps or
 * Google Maps rather than bouncing through a web page first.
 */
export async function openDirections(lat: string | number, lng: string | number): Promise<void> {
  const web = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  switch (platform()) {
    case 'ios':
      window.open(`maps://?daddr=${lat},${lng}`, '_self');
      return;
    case 'android':
      window.open(`geo:${lat},${lng}?q=${lat},${lng}`, '_self');
      return;
    default:
      await openExternal(web);
  }
}

/** `true` when a native share sheet is available. */
export async function canShare(): Promise<boolean> {
  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      return (await Share.canShare()).value;
    } catch {
      return false;
    }
  }
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Hand a meeting to the platform share sheet. */
export async function share(payload: { title: string; text: string; url: string }): Promise<void> {
  if (isNative()) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ ...payload, dialogTitle: payload.title });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    // A share with an empty url is rejected by some browsers, so it is omitted
    // rather than sent blank.
    await navigator.share(payload.url ? payload : { title: payload.title, text: payload.text });
  }
}
