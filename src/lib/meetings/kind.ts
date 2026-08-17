import type { MeetingKind } from '../types';

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
 * No relevant keys means in person. That is safe on the aggregator, where VM is
 * the established convention for an online meeting and its absence is
 * meaningful. It was *not* safe on the Virtual NA root, whose records routinely
 * carried no VM key at all — defaulting those to in-person put a Directions
 * button on meetings that happen nowhere. That root is no longer queried, which
 * is what lets this collapse back to a single rule.
 */
export function meetingKind(keys: string[]): MeetingKind {
  const has = (key: string) => keys.includes(key);
  if (has('TC')) return has('VM') ? 'temp-virtual' : 'temp-closed';
  if (has('HY')) return 'hybrid';
  if (has('VM')) return 'virtual';
  return 'in-person';
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
 * Translation key for a meeting's kind badge, or null when there is nothing
 * worth saying.
 *
 * Only in-person gets no badge: it is the default reading of a meeting with an
 * address, so labelling it adds noise to every card on the aggregator.
 *
 * Virtual and hybrid were originally left unlabelled too, on the reasoning that
 * they announce themselves through the buttons they offer — a join link, a
 * dial-in, directions or not. They do not. A virtual meeting still carries
 * coordinates, so it still gets a map pin, and BMLT requires a latitude and
 * longitude on every record whether or not the meeting happens anywhere: an
 * online-only group is routinely pinned to its home town, or to somewhere
 * arbitrary. Reading a pin next to a card whose only distinguishing feature is
 * the *absence* of a Directions button asks the reader to notice something that
 * is not there. The badge says it outright.
 */
export function kindLabelKey(kind: MeetingKind): string | null {
  switch (kind) {
    case 'temp-closed':
      return 'TEMPCLOSED';
    case 'temp-virtual':
      return 'TEMP_CLOSED';
    case 'virtual':
      return 'VIRTUAL';
    case 'hybrid':
      return 'HYBRID';
    default:
      return null;
  }
}

/**
 * Which badge treatment a kind gets. Separate from the label so the component
 * does not re-derive meaning from a translation key.
 *
 * `warning` is the red one and is reserved for the two closed states — the
 * cases where turning up in person would waste someone's evening. Virtual and
 * hybrid are neutral information, not a caution, and colouring them red would
 * dilute the one badge that needs to be alarming.
 */
export function kindBadgeTone(kind: MeetingKind): 'warning' | 'virtual' | 'hybrid' | null {
  switch (kind) {
    case 'temp-closed':
    case 'temp-virtual':
      return 'warning';
    case 'virtual':
      return 'virtual';
    case 'hybrid':
      return 'hybrid';
    default:
      return null;
  }
}
