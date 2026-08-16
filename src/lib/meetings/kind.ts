import type { MeetingKind, MeetingSource } from '../types';

/**
 * Split BMLT's comma-separated `formats` field into individual key strings.
 *
 * The Ionic build tested these with `formats.includes('VM')` — a substring match
 * against the whole joined string, which would also fire on any future key that
 * merely contains "VM". Matching against the split list is exact and behaves
 * identically for every key in the current world list.
 */
export function formatKeys(formats: string | undefined | null): string[] {
  if (!formats) return [];
  return formats
    .split(',')
    .map((key) => key.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Classify a meeting from its format keys.
 *
 * Three keys carry presentation meaning:
 *   VM — virtual meeting
 *   HY — hybrid, in person and online at once
 *   TC — temporarily closed, the physical location is shut
 *
 * TC dominates: once the location is shut, whether it was hybrid is no longer
 * the useful thing to say. TC alongside VM means the group is meeting online in
 * the meantime, which is the case worth calling out separately.
 *
 * The Ionic build enumerated the VM/TC/HY combinations one by one and left the
 * TC+HY corner unhandled, falling through to an empty string. A meeting with
 * both keys then rendered with neither its address block nor its directions
 * button — a blank card. Leading with TC closes that gap.
 *
 * `source` decides what "no relevant keys" means, and it matters a great deal.
 * bmlt.virtual-na.org hosts online meetings exclusively, and its records
 * routinely carry no VM key — that key is a worldwide-aggregator convention.
 * Defaulting those to in-person put a Directions button on meetings that
 * happen nowhere, pointed at whatever nominal coordinates the group had
 * registered. On the aggregator, no keys genuinely does mean in person.
 */
export function meetingKind(keys: string[], source: MeetingSource = 'tomato'): MeetingKind {
  const has = (key: string) => keys.includes(key);
  if (has('TC')) return has('VM') ? 'temp-virtual' : 'temp-closed';
  if (has('HY')) return 'hybrid';
  if (has('VM')) return 'virtual';
  return source === 'virtual' ? 'virtual' : 'in-person';
}

/**
 * Whether to offer a directions button.
 *
 * The one thing that must never be wrong: sending someone across town to a
 * meeting that is online, or to a location that is temporarily shut.
 */
export function hasDirections(kind: MeetingKind): boolean {
  return kind === 'in-person' || kind === 'hybrid';
}

/**
 * Translation key for the warning badge on a meeting whose location is shut.
 *
 * Only the two closed states get a badge. Hybrid and virtual meetings announce
 * themselves through the buttons they offer — a join link, a dial-in, directions
 * or not — which is how the Ionic build distinguished them, and it avoids
 * inventing labels that none of the nine translation files carry.
 */
export function kindLabelKey(kind: MeetingKind): string | null {
  switch (kind) {
    case 'temp-closed':
      return 'TEMPCLOSED';
    case 'temp-virtual':
      return 'TEMP_CLOSED';
    default:
      return null;
  }
}
