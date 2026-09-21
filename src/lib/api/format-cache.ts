import type { RawFormat } from '../types';

/**
 * Format names the app has learned, kept between launches.
 *
 * Every list search asks the aggregator for the formats its meetings use
 * (`get_used_formats`, see `searchMeetings` in bmlt.ts) and records them here, so
 * the English name of every id on a list is known by the time it is drawn —
 * without the separate `GetFormats` request that used to follow each search.
 *
 * They are persisted because a phone restarts the app constantly, so "cached for
 * this session" meant "fetched on nearly every launch". Format names change a
 * few times a decade; a week-old copy is as good as a fresh one, and a missing or
 * unreadable copy only costs one request. This module imports nothing from the
 * query layer, so bmlt.ts can fill it and formats.ts can read it without a cycle.
 */

const STORAGE_KEY = 'bmltsearch.formatNames';
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;
/** A bound, so years of travelling cannot grow it without limit. The aggregator has ~1,700 formats per language. */
const MAX_NAMES = 4000;

interface Stored {
  savedAt: number;
  names: Record<string, string>;
}

/** `language:id` -> name. English is the base; other languages hold translations only. */
let names: Map<string, string> | null = null;
let savedAt = 0;

function load(): Map<string, string> {
  if (names) return names;
  names = new Map();
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
    const age = Date.now() - (stored?.savedAt ?? 0);
    if (stored?.names && age >= 0 && age <= KEEP_FOR_MS) {
      names = new Map(Object.entries(stored.names).filter(([, name]) => typeof name === 'string'));
      savedAt = stored.savedAt ?? 0;
    }
  } catch {
    // Disabled or corrupt storage: start empty, the names come back with the next search.
  }
  return names;
}

function save(): void {
  try {
    if (typeof localStorage === 'undefined' || !names) return;
    // The oldest copy's age is what expires the whole set, so a week after the
    // first save everything is relearned rather than kept alive by small additions.
    if (!savedAt) savedAt = Date.now();
    const payload: Stored = { savedAt, names: Object.fromEntries(names) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or disabled storage. The in-memory copy still serves this session.
  }
}

/** Record format rows in one language. Returns how many names were new. */
export function rememberFormats(formats: readonly RawFormat[], language: string): number {
  const known = load();
  let added = 0;
  for (const format of formats) {
    if (!format?.id || !format.name_string) continue;
    const key = `${language}:${format.id}`;
    if (known.get(key) === format.name_string) continue;
    if (!known.has(key) && known.size >= MAX_NAMES) continue;
    known.set(key, format.name_string);
    added++;
  }
  if (added) save();
  return added;
}

export function formatName(id: string, language: string): string | undefined {
  return load().get(`${language}:${id}`);
}

/** Test seam — forgets everything, in memory and in storage. */
export function clearFormats(): void {
  names = new Map();
  savedAt = 0;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Test seam — drops the in-memory copy only, as an app restart does. */
export function reloadFormats(): void {
  names = null;
  savedAt = 0;
}
