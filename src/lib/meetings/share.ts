import type { Meeting } from '../types';
import { addressLines, hasCoordinates, tidyDelimiter } from './address';

/** A web link that will resolve to this meeting for whoever receives it. */
export function shareUrl(meeting: Meeting): string {
  if (meeting.virtual_meeting_link) return meeting.virtual_meeting_link;
  if (hasCoordinates(meeting)) {
    return `https://www.google.com/maps/search/?api=1&query=${meeting.latitude},${meeting.longitude}`;
  }
  return '';
}

/**
 * The body of a shared meeting.
 *
 * `dayLabel` is passed in already translated — this module stays free of the
 * i18n store so it can be unit-tested without one.
 *
 * The Ionic build wrote `shareText += + meeting.location_text`, where the stray
 * unary plus coerced the venue name to a number: every shared meeting that had
 * one read "NaN" where the venue should be. The lines are assembled properly
 * here, and joined with newlines rather than commas so the result is legible in
 * a text message.
 */
export function shareText(meeting: Meeting, dayLabel: string): string {
  const lines: string[] = [];

  const time = [meeting.startsAtLabel, meeting.endsAtLabel].filter(Boolean).join(' - ');
  lines.push(`${dayLabel} ${time}`.trim());

  lines.push(...addressLines(meeting));

  const extras = [
    meeting.comments,
    meeting.train_lines ? `Train: ${tidyDelimiter(meeting.train_lines)}` : '',
    meeting.bus_lines ? `Bus: ${tidyDelimiter(meeting.bus_lines)}` : '',
    meeting.phone_meeting_number ? `Phone: ${tidyDelimiter(meeting.phone_meeting_number)}` : ''
  ];
  lines.push(...extras.map((line) => line?.trim()).filter((line): line is string => Boolean(line)));

  const url = shareUrl(meeting);
  if (url) lines.push(url);

  return lines.join('\n');
}

/** Title, text, and url for the Web Share / Capacitor Share payload. */
export function sharePayload(meeting: Meeting, dayLabel: string) {
  return {
    title: meeting.meeting_name ?? 'NA Meeting',
    text: shareText(meeting, dayLabel),
    url: shareUrl(meeting)
  };
}
