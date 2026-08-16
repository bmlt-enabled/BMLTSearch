import type { Meeting, MeetingSource, RawMeeting } from '../types';
import { formatKeys, meetingKind } from './kind';
import { endLabel, hourOf, startLabel, toMinutes } from './time';

/** Translation keys for BMLT weekdays, indexed by `weekday_tinyint - 1`. */
export const WEEKDAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/** Tailwind background classes for the weekday accents, same order. */
export const WEEKDAY_COLORS = ['bg-sunday', 'bg-monday', 'bg-tuesday', 'bg-wednesday', 'bg-thursday', 'bg-friday', 'bg-saturday'] as const;

/** A day's worth of meetings, ready to render as one accordion section. */
export interface DayGroup {
  /** 1 = Sunday … 7 = Saturday. */
  weekday: number;
  labelKey: string;
  meetings: Meeting[];
}

/** Clamp whatever the server sent into 1–7, defaulting to Sunday. */
export function weekdayOf(meeting: Pick<RawMeeting, 'weekday_tinyint'>): number {
  const day = Number.parseInt(meeting.weekday_tinyint ?? '', 10);
  return day >= 1 && day <= 7 ? day : 1;
}

/** `true` when the weekday is today in the reader's own timezone. */
export function isToday(weekday: number, now: Date = new Date()): boolean {
  return weekday === now.getDay() + 1;
}

/**
 * Turn a format name lookup into the "Open. Wheelchair Accessible." line.
 *
 * The two root servers key formats differently, which is why `source` is needed:
 * Tomato meetings carry `format_shared_id_list` (world format *ids*, resolvable
 * to a translated name), while Virtual NA meetings carry only the `formats` key
 * strings. An unresolved virtual key falls back to the key itself so the reader
 * still sees something, which is what the Ionic build did.
 */
export function explodeFormats(meeting: RawMeeting, names: Map<string, string>, source: MeetingSource): string {
  const tokens = source === 'tomato' ? (meeting.format_shared_id_list ?? '').split(',') : formatKeys(meeting.formats);

  const parts: string[] = [];
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    const name = names.get(token);
    if (name) parts.push(name);
    else if (source === 'virtual') parts.push(token);
  }
  return parts.map((part) => `${part}.`).join(' ');
}

/**
 * Attach every derived display field a meeting needs, once.
 *
 * Call this the moment a list arrives. Everything downstream — sorting,
 * filtering, the card, the share sheet — reads the decorated fields and never
 * re-parses `start_time`.
 */
export function decorateMeetings(raw: RawMeeting[], names: Map<string, string>, source: MeetingSource): Meeting[] {
  return raw.map((meeting) => {
    const startMinutes = toMinutes(meeting.start_time);
    const keys = formatKeys(meeting.formats);
    return {
      ...meeting,
      startMinutes,
      // Only virtual meetings get the zone suffix. Tomato's in-person records
      // have no reliable `time_zone`, and their start time is always local to
      // wherever the meeting physically is — which is where the reader is
      // standing if they searched by radius.
      startsAtLabel: startLabel(startMinutes, source === 'virtual' ? meeting.time_zone : undefined),
      endsAtLabel: endLabel(startMinutes, meeting.duration_time),
      formatsLabel: explodeFormats(meeting, names, source),
      formatKeys: keys,
      kind: meetingKind(keys, source)
    };
  });
}

/** Sort in place by weekday, then start time, then name. */
export function sortMeetings(meetings: Meeting[]): Meeting[] {
  return meetings.sort((a, b) => weekdayOf(a) - weekdayOf(b) || a.startMinutes - b.startMinutes || (a.meeting_name ?? '').localeCompare(b.meeting_name ?? ''));
}

/** Bucket into one group per weekday, dropping days with nothing in them. */
export function groupByDay(meetings: Meeting[]): DayGroup[] {
  const byDay = new Map<number, Meeting[]>();
  for (const meeting of meetings) {
    const day = weekdayOf(meeting);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(meeting);
    else byDay.set(day, [meeting]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekday, list]) => ({
      weekday,
      labelKey: WEEKDAY_KEYS[weekday - 1],
      meetings: sortMeetings(list)
    }));
}

export interface MeetingFilter {
  /** 0 means every day; otherwise 1 = Sunday … 7 = Saturday. */
  weekday: number;
  /** Inclusive start hour, 0–23. */
  fromHour: number;
  /** Inclusive end hour, 0–23. A meeting at 23:45 still matches `toHour: 23`. */
  toHour: number;
}

export const ALL_DAYS = 0;

/** Apply the day and hour-range filters the meeting list header exposes. */
export function filterMeetings(meetings: Meeting[], filter: MeetingFilter): Meeting[] {
  return meetings.filter((meeting) => {
    if (filter.weekday !== ALL_DAYS && weekdayOf(meeting) !== filter.weekday) return false;
    const hour = hourOf(meeting.startMinutes);
    return hour >= filter.fromHour && hour <= filter.toHour;
  });
}
