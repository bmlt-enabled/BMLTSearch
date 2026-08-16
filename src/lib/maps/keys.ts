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
 * Read through `import.meta.env` rather than `$env/static/public`, which is a
 * hard error when a variable *name* is absent — not merely unset. That made a
 * fresh `git clone && npm run build` fail outright, broke `npm run check` in CI
 * (which runs before the build step supplies the values), and failed the first
 * Cloudflare Pages deploy before the project's environment variables existed.
 * An absent key now degrades to an empty string, which is what every caller
 * already handles: the map screen says it is unconfigured and the rest of the
 * app is unaffected. See `envPrefix` in vite.config.ts.
 */

const WEB = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY_WEB ?? '';
const IOS = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY_IOS ?? '';
const ANDROID = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY_ANDROID ?? '';

/** Key for the Maps JS SDK: autocomplete and geocoding, on every platform. */
export function webKey(): string {
  return WEB;
}

/** Key for `GoogleMap.create` — the native SDK on device, the JS SDK on the web. */
export function mapKey(): string {
  switch (platform()) {
    case 'ios':
      return IOS || WEB;
    case 'android':
      return ANDROID || WEB;
    default:
      return WEB;
  }
}
