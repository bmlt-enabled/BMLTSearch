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
 *   - Place autocomplete and geocoding go over **REST** (`rest.ts`), signed with
 *     that same platform key and authenticated by an app-identity header rather
 *     than a referrer, because a Capacitor webview cannot satisfy an HTTP
 *     referrer restriction.
 *
 * So on device *both* uses take the platform key, and the web key is web-only:
 * `webKey()` has exactly one caller, the JS SDK loader, and `places.ts` reaches
 * the SDK only on its `!isNative()` branch. An earlier version of this app did
 * run autocomplete through the JS SDK inside the shell, which is why the web
 * key's referrer list may still carry `capacitor://localhost` and
 * `https://localhost` — those are dead and can be removed.
 *
 * The web key is also per-environment: a localhost-restricted key in local
 * `.env`, an `app.bmlt.app`-restricted key in the Cloudflare Pages build. Same
 * variable, different value; no code branches on it.
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
