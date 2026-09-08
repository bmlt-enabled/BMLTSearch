/**
 * Loads Apple MapKit JS. Web only.
 *
 * This is the web replacement for the Google Maps JS SDK loader that used to
 * live in `loader.ts`. On the web the map is a `mapkit.Map` and place search is
 * `mapkit.Search`/`mapkit.Geocoder`, so the browser build no longer needs a
 * Google key at all — only Android still does. iOS and Android render *native*
 * views through their Capacitor plugins and never load this.
 *
 * Authentication is a signed token, not an API key. It is minted in the Apple
 * developer portal (Maps token) and baked into the bundle at build time as
 * `PUBLIC_MAPKIT_TOKEN`, the same build-time pattern the Google keys used.
 * MapKit tokens are meant to be exposed to the browser; the restriction is the
 * origin allowlist on the token, so it must include the production domain
 * (`app.bmlt.app`), `http://localhost:5173` (dev) and `http://localhost:4173`
 * (preview).
 *
 * The promise is memoised: the CDN script installs a single global `mapkit`,
 * `init` may only run once, and every screen wanting a map or a search would
 * otherwise race to configure it.
 */

// `5.x.x` is Apple's own "latest 5.x" alias on the CDN — a real, resolvable
// path, not a placeholder to pin. It tracks patch releases without a redeploy.
const MAPKIT_SRC = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';

const TOKEN = import.meta.env.PUBLIC_MAPKIT_TOKEN ?? '';

/**
 * MapKit reports an *authorisation* failure out of band, exactly as Google did.
 *
 * `init()` returns fine and the map may even start constructing; only when the
 * token is rejected (expired, or this origin is not on its allowlist) does
 * MapKit fire a library-level `error` event and paint its own failure into the
 * container. Registering here lets the map screen surface its own honest error
 * and say what to do about it — regenerate the token, allow this origin.
 */
const authFailureHandlers = new Set<() => void>();

export function onMapsAuthFailure(handler: () => void): () => void {
  authFailureHandlers.add(handler);
  return () => authFailureHandlers.delete(handler);
}

/** `true` when a MapKit token is configured for this build. */
export function mapKitConfigured(): boolean {
  return TOKEN.length > 0;
}

let pending: Promise<void> | null = null;

export function loadMapKit(): Promise<void> {
  if (pending) return pending;
  if (!TOKEN) return Promise.reject(new Error('No MapKit JS token is configured for this build.'));

  const load = new Promise<void>((resolve, reject) => {
    const start = () => {
      try {
        mapkit.init({ authorizationCallback: (done) => done(TOKEN) });
        mapkit.addEventListener('error', () => {
          for (const handler of authFailureHandlers) handler();
        });
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('MapKit init failed'));
      }
    };

    // Already present (a warm navigation, or a second caller): just init.
    if (typeof window !== 'undefined' && window.mapkit) {
      start();
      return;
    }

    const script = document.createElement('script');
    script.src = MAPKIT_SRC;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', start, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load MapKit JS.')), { once: true });
    document.head.append(script);
  });

  pending = load;
  load.catch(() => {
    // Let a later attempt retry rather than caching the rejection forever.
    pending = null;
  });

  return load;
}
