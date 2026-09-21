import type { RawMeeting } from '../types';
import { aggregatorFormats } from './bmlt';
import { clearFormats, formatName, rememberFormats } from './format-cache';

/**
 * Resolving format ids to readable names.
 *
 * Meetings arrive carrying format *codes* — "O", "VM", "WC" — which mean nothing
 * to a reader. Every list search brings the English names of its formats back
 * with it (`get_used_formats`, see `searchMeetings` in bmlt.ts), and the names are
 * kept between launches (format-cache.ts), so an English reader costs no
 * `GetFormats` request at all. Another language costs one, for ids it has not
 * asked about before.
 */

/** `language:id` pairs already asked for, so an id with no translation is not asked about again this session. */
const asked = new Set<string>();

/**
 * Names for every format id used by the given meetings.
 *
 * English is the base and the requested language is layered over the top. That
 * ordering is deliberate: the translated format lists are incomplete for most
 * languages, and a reader is far better served by an English format name than by
 * a bare numeric id.
 *
 * English normally arrived with the search. It is fetched here only for ids no
 * search has described. A failed fetch is not remembered as asked, so a later
 * list retries; the rejection still reaches the caller, as it always has.
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

  // English first so it is in place as a fallback, then the target language.
  for (const lang of language === 'en' ? ['en'] : ['en', language]) {
    const missing = [...wanted].filter((id) => !formatName(id, lang) && !asked.has(`${lang}:${id}`));
    if (missing.length === 0) continue;
    rememberFormats(await aggregatorFormats(missing, lang), lang);
    for (const id of missing) asked.add(`${lang}:${id}`);
  }

  const names = new Map<string, string>();
  for (const id of wanted) {
    const name = formatName(id, language) ?? formatName(id, 'en');
    if (name) names.set(id, name);
  }
  return names;
}

/** Test seam — drops the cache. */
export function resetFormatCaches(): void {
  clearFormats();
  asked.clear();
}
