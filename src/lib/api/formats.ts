import type { RawMeeting } from '../types';
import { tomatoFormats, virtualFormats } from './bmlt';

/**
 * Resolving format ids to readable names.
 *
 * Meetings arrive carrying format *codes* — "O", "VM", "WC" — which mean nothing
 * to a reader. The names live behind a separate `GetFormats` call, so every
 * meeting list needs a second request before it can be shown in full.
 *
 * Names are cached for the process lifetime. They are effectively static (the
 * world format list changes a few times a decade), and without a cache every
 * radius tweak on the search screen refetches the same few dozen strings.
 */

/** Cache key is language-scoped: the same id has a different name per language. */
const tomatoCache = new Map<string, string>();
let virtualCache: Map<string, string> | null = null;

function cacheKey(language: string, id: string): string {
  return `${language}:${id}`;
}

/**
 * Names for every format id used by the given meetings.
 *
 * English is always fetched, and the requested language is then layered over the
 * top. That ordering is deliberate: the translated format lists are incomplete
 * for most languages, and a reader is far better served by an English format
 * name than by a bare numeric id.
 */
export async function tomatoFormatNames(meetings: RawMeeting[], language: string): Promise<Map<string, string>> {
  const wanted = new Set<string>();
  for (const meeting of meetings) {
    for (const id of (meeting.format_shared_id_list ?? '').split(',')) {
      const trimmed = id.trim();
      if (trimmed) wanted.add(trimmed);
    }
  }
  if (wanted.size === 0) return new Map();

  const missing = [...wanted].filter((id) => !tomatoCache.has(cacheKey(language, id)));

  if (missing.length > 0) {
    // English first so it is in place as a fallback, then the target language
    // over it. Both are fetched for the missing ids only.
    const english = await tomatoFormats(missing, 'en');
    for (const format of english) {
      if (format?.id && format.name_string) tomatoCache.set(cacheKey(language, format.id), format.name_string);
    }

    if (language !== 'en') {
      const translated = await tomatoFormats(missing, language);
      for (const format of translated) {
        if (format?.id && format.name_string) tomatoCache.set(cacheKey(language, format.id), format.name_string);
      }
    }
  }

  const names = new Map<string, string>();
  for (const id of wanted) {
    const name = tomatoCache.get(cacheKey(language, id));
    if (name) names.set(id, name);
  }
  return names;
}

/**
 * Virtual NA's format names, keyed by code rather than id.
 *
 * Virtual NA meetings carry only `formats` codes — no `format_shared_id_list` —
 * so the lookup is by `key_string`. The list is small and English-only upstream,
 * so it is fetched whole, once.
 */
export async function virtualFormatNames(): Promise<Map<string, string>> {
  if (virtualCache) return virtualCache;
  const formats = await virtualFormats();
  const names = new Map<string, string>();
  for (const format of formats) {
    if (format?.key_string && format.name_string) names.set(format.key_string.trim().toUpperCase(), format.name_string);
  }
  virtualCache = names;
  return names;
}

/** Test seam — drops both caches. */
export function resetFormatCaches(): void {
  tomatoCache.clear();
  virtualCache = null;
}
