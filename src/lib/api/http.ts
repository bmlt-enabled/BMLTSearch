import { CapacitorHttp } from '@capacitor/core';

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

/** GET and parse a JSON body of any shape. Throws `BmltError` on transport or status failure. */
export async function getJson<T>(url: string): Promise<T> {
  let response;
  try {
    response = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } });
  } catch (cause) {
    throw new BmltError(`Request failed: ${String(cause)}`, 0, url);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new BmltError(`Request returned ${response.status}`, response.status, url);
  }

  if (typeof response.data === 'string') {
    try {
      return JSON.parse(response.data) as T;
    } catch {
      throw new BmltError('Response body is not JSON', response.status, url);
    }
  }
  return response.data as T;
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
    response = await CapacitorHttp.get({ url, headers: { Accept: 'application/json' } });
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
