/**
 * Meeting clock arithmetic.
 *
 * BMLT gives a meeting as a weekday plus a wall-clock `start_time` and a
 * `duration_time`, both `HH:MM:SS`. Everything the UI needs — the displayed
 * range, the sort key, the hour-filter key — is arithmetic on those wall-clock
 * values. There is no instant involved, so there is no timezone conversion here
 * and no date library.
 *
 * The Ionic build reached for date-fns and date-fns-tz to do this, building a
 * real `Date` for each meeting, pushing it forward a week when the time had
 * already passed today, and then formatting it back down to a wall clock. The
 * round trip served no purpose — the week-ahead bump was invisible in every
 * display, and it actively corrupted the secondary sort in the hour filter,
 * which ordered by that `Date` and so scattered already-passed meetings a week
 * out of position. Sorting on minutes-since-midnight is both simpler and right.
 */

/** Parse `HH:MM` or `HH:MM:SS` into minutes since midnight. */
export function toMinutes(time: string | undefined | null): number {
  if (!time) return 0;
  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number.parseInt(rawHours, 10);
  const minutes = Number.parseInt(rawMinutes ?? '0', 10);
  if (Number.isNaN(hours)) return 0;
  return hours * 60 + (Number.isNaN(minutes) ? 0 : minutes);
}

/** The hour a meeting starts, 0–23. The key the hour-range filter compares. */
export function hourOf(minutes: number): number {
  return Math.floor(normalise(minutes) / 60);
}

/** Wrap into a single day, so a start + duration that crosses midnight reads sanely. */
function normalise(minutes: number): number {
  const day = 24 * 60;
  return ((minutes % day) + day) % day;
}

/** `"7:30 PM"` — the 12-hour half, used on its own for end times. */
export function format12Hour(minutes: number): string {
  const m = normalise(minutes);
  const hours24 = Math.floor(m / 60);
  const mins = m % 60;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** `"19:30"` — the 24-hour half. */
export function format24Hour(minutes: number): string {
  const m = normalise(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * `"19:30 (7:30 PM)"` — both clocks at once, matching the Ionic build's
 * `HH:mm (h:mm a)`. Showing both sidesteps the 12/24-hour preference entirely,
 * which is why the setting for it was never wired up.
 */
export function formatClock(minutes: number): string {
  return `${format24Hour(minutes)} (${format12Hour(minutes)})`;
}

/**
 * The label under a meeting's start time.
 *
 * Virtual meetings carry an IANA `time_zone` and their `start_time` is local to
 * it, so the zone is appended — `"19:30 (7:30 PM) (Europe/Dublin)"`. Without the
 * suffix a reader in another country has no way to know which 19:30 is meant.
 *
 * The Ionic build tried to convert these to a real instant and mangled it: it
 * ran `toZonedTime` on a Date already built from local wall-clock parts and then
 * formatted *that* through `formatInTimeZone`, shifting the time twice. A
 * London meeting at 19:00 displayed to a New York user as 05:00 (Europe/London).
 * Showing the meeting's own wall clock, labelled with its zone, is what the
 * suffix always implied.
 */
export function startLabel(startMinutes: number, timeZone?: string): string {
  const base = formatClock(startMinutes);
  return timeZone ? `${base} (${timeZone})` : base;
}

/** `"9:00 PM"` — start plus duration. Empty when the server sent no duration. */
export function endLabel(startMinutes: number, duration: string | undefined | null): string {
  if (!duration) return '';
  const length = toMinutes(duration);
  if (length <= 0) return '';
  return format12Hour(startMinutes + length);
}
