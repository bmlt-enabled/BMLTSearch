import { CapacitorHttp } from '@capacitor/core';

import { isNative, platform } from '../native';

/**
 * The one way this app talks to a BMLT root server.
 *
 * `CapacitorHttp` rather than `fetch`, because the root servers do not send
 * permissive CORS headers. In the browser that is survivable — the deployed web
 * build is same-origin-proxied at the CDN — but inside a native webview an
 * ordinary `fetch` is blocked outright. CapacitorHttp routes the request through
 * the native networking stack, where CORS does not apply. On the web it falls
 * back to `fetch` on its own, so this single path works everywhere.
 */

/** Thrown for any non-2xx response, so callers can tell "empty" from "broken". */
export class BmltError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string
  ) {
    super(message);
    this.name = 'BmltError';
  }
}

/*
  A custom User-Agent, sent to the root server on native only.

  On the web `User-Agent` is a forbidden header — `fetch` drops it — so there is
  nothing to set there and no reason to try. On a device the request goes
  through the native HTTP stack, which honors it, and it is the one place a root
  server would otherwise see only a stock `CFNetwork`/`Dalvik` string. This names
  the app, its release version and the OS, so a server's operators can tell this
  traffic apart from a browser's. `__APP_VERSION__` is the git tag the build
  shipped under — see vite.config.ts.
*/
export function userAgent(os: 'ios' | 'android' | 'web'): string {
  const name = os === 'ios' ? 'iOS' : os === 'android' ? 'Android' : 'native';
  return `BMLTSearch/${__APP_VERSION__} (${name})`;
}

function headers(): Record<string, string> {
  return isNative() ? { Accept: 'application/json', 'User-Agent': userAgent(platform()) } : { Accept: 'application/json' };
}

/**
 * GET a BMLT endpoint and hand back a parsed array.
 *
 * Two wire quirks are absorbed here rather than at each call site:
 *
 *  - An empty result set comes back as the object `{}`, not `[]`. Every caller
 *    in the Ionic build re-discovered this and half of them stringified the
 *    response to test for it.
 *  - Depending on platform and response headers, CapacitorHttp sometimes hands
 *    back the raw body as a string instead of parsed JSON.
 */
export async function getJsonArray<T>(url: string): Promise<T[]> {
  let response;
  try {
    response = await CapacitorHttp.get({ url, headers: headers() });
  } catch (cause) {
    throw new BmltError(`Request failed: ${String(cause)}`, 0, url);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new BmltError(`Root server returned ${response.status}`, response.status, url);
  }

  let data: unknown = response.data;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return [];
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new BmltError('Root server returned a body that is not JSON', response.status, url);
    }
  }

  if (Array.isArray(data)) return data as T[];
  // `{}` — BMLT's empty result set. Anything else non-array is a shape we do not
  // understand, and an empty list is a safer answer than a crash mid-search.
  return [];
}

/** Build a query string, dropping empty values and encoding the rest. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${encodeURIComponent(String(value))}`);
  }
  return parts.join('&');
}
