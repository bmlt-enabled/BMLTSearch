import { platform } from '../native';

/**
 * Map credentials, per platform. Only **Android** still uses a Google key.
 *
 *              | Map view                     | Autocomplete + geocoding
 *   -----------|------------------------------|--------------------------
 *   Web        | MapKit JS (token)            | MapKit JS (token)
 *   iOS        | native Apple Maps (no key)   | native MapKit + CLGeocoder (no key)
 *   Android    | native SDK, Android key      | REST, Android key + SHA-1
 *
 * Web moved off Google entirely: the map is a `mapkit.Map` and search is
 * `mapkit.Search`, both authenticated by the MapKit token baked in as
 * `PUBLIC_MAPKIT_TOKEN` (see mapkit.ts). iOS renders native Apple Maps and
 * searches with `MKLocalSearchCompleter` and geocodes with `CLGeocoder` (api/geocode.ts), none of which needs a key. That
 * leaves Android as the one platform holding a Google key — a native map view
 * authenticated by package + signing SHA-1, with Places and geocoding over REST
 * with an app-identity header (a Capacitor webview cannot satisfy an HTTP
 * referrer restriction; see rest.ts).
 *
 * Read through `import.meta.env` rather than `$env/static/public`, which is a
 * hard error when a variable *name* is absent — not merely unset. An absent key
 * degrades to an empty string, which every caller already handles. See
 * `envPrefix` in vite.config.ts.
 */

const ANDROID = import.meta.env.PUBLIC_GOOGLE_MAPS_KEY_ANDROID ?? '';

/**
 * Key for `GoogleMap.create` and the Places/Geocoding REST calls — Android only.
 * Empty on web (MapKit JS) and iOS (native Apple Maps), where nothing reads it.
 */
export function mapKey(): string {
  return platform() === 'android' ? ANDROID : '';
}
