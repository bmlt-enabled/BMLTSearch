import type { Meeting, RawMeeting } from '../types';
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
 * Aggregator meetings carry `format_shared_id_list` — world format *ids*, which
 * resolve to a translated name. An id with no name resolved is dropped rather
 * than printed raw: a bare number tells the reader nothing.
 */
export function explodeFormats(meeting: RawMeeting, names: Map<string, string>): string {
  const tokens = (meeting.format_shared_id_list ?? '').split(',');

  const parts: string[] = [];
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    const name = names.get(token);
    if (name) parts.push(name);
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
export function decorateMeetings(raw: RawMeeting[], names: Map<string, string>): Meeting[] {
  return raw.map((meeting) => {
    const startMinutes = toMinutes(meeting.start_time);
    const keys = formatKeys(meeting.formats);
    const kind = meetingKind(keys);
    /*
      The zone suffix belongs to any meeting that does not happen where the
      reader is. An in-person meeting needs none: its start time is local to the
      venue, which is where the reader searched. A virtual meeting's 19:30 is
      meaningless without one.

      This used to key on `source`, so only Virtual NA records were labelled.
      That held while the aggregator meant in-person, and stopped holding the
      moment the venue filter began surfacing the aggregator's ~4,300 virtual
      meetings deliberately — they showed a bare time. Keying on the meeting's
      own kind is what was always meant, and is all that survives now that the
      second root server is gone.

      Only about 37% of the aggregator's virtual records carry a `time_zone` at
      all, against 99% on Virtual NA. The rest fall back to a bare time because
      there is nothing better to show — `startLabel` omits the suffix rather
      than inventing one, and guessing from the meeting's coordinates would be
      confidently wrong, since virtual meetings are precisely the ones whose
      coordinates are arbitrary.
    */
    const happensElsewhere = kind === 'virtual' || kind === 'temp-virtual';
    return {
      ...meeting,
      startMinutes,
      startsAtLabel: startLabel(startMinutes, happensElsewhere ? meeting.time_zone : undefined),
      endsAtLabel: endLabel(startMinutes, meeting.duration_time),
      formatsLabel: explodeFormats(meeting, names),
      formatKeys: keys,
      kind
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
