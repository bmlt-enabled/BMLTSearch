import type { RawMeeting } from '../types';
import { aggregatorFormats } from './bmlt';

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
const aggregatorCache = new Map<string, string>();

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
export async function aggregatorFormatNames(meetings: RawMeeting[], language: string): Promise<Map<string, string>> {
  const wanted = new Set<string>();
  for (const meeting of meetings) {
    for (const id of (meeting.format_shared_id_list ?? '').split(',')) {
      const trimmed = id.trim();
      if (trimmed) wanted.add(trimmed);
    }
  }
  if (wanted.size === 0) return new Map();

  const missing = [...wanted].filter((id) => !aggregatorCache.has(cacheKey(language, id)));

  if (missing.length > 0) {
    // English first so it is in place as a fallback, then the target language
    // over it. Both are fetched for the missing ids only.
    const english = await aggregatorFormats(missing, 'en');
    for (const format of english) {
      if (format?.id && format.name_string) aggregatorCache.set(cacheKey(language, format.id), format.name_string);
    }

    if (language !== 'en') {
      const translated = await aggregatorFormats(missing, language);
      for (const format of translated) {
        if (format?.id && format.name_string) aggregatorCache.set(cacheKey(language, format.id), format.name_string);
      }
    }
  }

  const names = new Map<string, string>();
  for (const id of wanted) {
    const name = aggregatorCache.get(cacheKey(language, id));
    if (name) names.set(id, name);
  }
  return names;
}

/** Test seam — drops the cache. */
export function resetFormatCaches(): void {
  aggregatorCache.clear();
}
