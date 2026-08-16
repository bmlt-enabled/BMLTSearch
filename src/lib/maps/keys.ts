import { PUBLIC_GOOGLE_MAPS_KEY_ANDROID, PUBLIC_GOOGLE_MAPS_KEY_IOS, PUBLIC_GOOGLE_MAPS_KEY_WEB } from '$env/static/public';
import { platform } from '../native';

/**
 * Three Google Maps keys, because Google allows a key exactly one *application*
 * restriction — Websites, or iOS apps, or Android apps, never a combination. An
 * app that runs on all three platforms therefore needs one key per platform, and
 * the awkward part is that a single native session uses two of them at once.
 *
 * Inside the iOS and Android shells:
 *
 *   - The map itself is a **native** view (`GoogleMap.create` → Maps SDK for
 *     iOS/Android), authenticated by bundle ID or package + signing SHA-1. That
 *     needs the platform key.
 *   - Place autocomplete and geocoding are **JavaScript** running in the webview,
 *     so they are referrer-checked like any web page — the origin is
 *     `capacitor://localhost` on iOS and `https://localhost` on Android. Those
 *     need the web key, with both origins listed in its referrer allowlist.
 *
 * So `webKey()` is used on every platform, and `mapKey()` varies.
 *
 * All three variables must exist at build time — `$env/static/public` fails the
 * build on a missing name rather than a missing value — but any of them may be
 * empty if you are not building for that platform.
 */

/** Key for the Maps JS SDK: autocomplete and geocoding, on every platform. */
export function webKey(): string {
  return PUBLIC_GOOGLE_MAPS_KEY_WEB;
}

/** Key for `GoogleMap.create` — the native SDK on device, the JS SDK on the web. */
export function mapKey(): string {
  switch (platform()) {
    case 'ios':
      return PUBLIC_GOOGLE_MAPS_KEY_IOS || PUBLIC_GOOGLE_MAPS_KEY_WEB;
    case 'android':
      return PUBLIC_GOOGLE_MAPS_KEY_ANDROID || PUBLIC_GOOGLE_MAPS_KEY_WEB;
    default:
      return PUBLIC_GOOGLE_MAPS_KEY_WEB;
  }
}
