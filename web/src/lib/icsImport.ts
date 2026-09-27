// Parsing a .ics file the student exported from another calendar (e.g. Google Calendar's
// Settings → Import & export → Export), so those events can show up on this site's calendar too.
// Best-effort RFC 5545 subset: enough for what real calendar exports produce, not a full parser.
// Pure text in, data out — no DOM — so the file-picking UI (CalendarPage) and storage
// (lib/importedEvents.tsx) can stay separate and this part can be unit-tested.

export interface ImportedEvent {
  /** Stable id from the source file (UID), used to de-dupe re-imports. */
  uid: string;
  title: string;
  /** YYYY-MM-DD or YYYY-MM-DDTHH:mm, KST wall-clock (matches how the rest of the app stores dates). */
  date: string;
  allDay: boolean;
}

/** RFC 5545 line unfolding: a line starting with a space or tab continues the previous line. */
function unfold(text: string): string[] {
  const raw = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  return lines;
}

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/**
 * "20261016" -> an all-day date. "20261016T140000" -> local wall-clock time (works for a
 * TZID=Asia/Seoul export, which is what a Korean student's calendar produces). "20261016T050000Z"
 * (UTC) is shifted by the same fixed +9h the rest of the app uses for KST, no timezone database.
 */
function parseDate(value: string): { date: string; allDay: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { date: `${y}-${mo}-${d}`, allDay: true };
  if (z) {
    const t = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    t.setUTCHours(t.getUTCHours() + 9);
    return { date: t.toISOString().slice(0, 16), allDay: false };
  }
  return { date: `${y}-${mo}-${d}T${h}:${mi}`, allDay: false };
}

/**
 * Every VEVENT with a usable DTSTART. Recurring events (RRULE) are imported as a single
 * occurrence at their DTSTART — good enough for one-off deadlines and events, not a full
 * recurrence expansion.
 */
export function parseIcs(text: string): ImportedEvent[] {
  const events: ImportedEvent[] = [];
  let cur: { uid?: string; summary?: string; dtstart?: string } | null = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.dtstart) {
        const parsed = parseDate(cur.dtstart);
        if (parsed) {
          const title = unescape(cur.summary ?? '');
          events.push({ uid: cur.uid || `${parsed.date}-${title}`, title, date: parsed.date, allDay: parsed.allDay });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue; // ignore VCALENDAR/VTIMEZONE fields outside a VEVENT
    const i = line.indexOf(':');
    if (i < 0) continue;
    const name = line.slice(0, i).split(';', 1)[0];
    const value = line.slice(i + 1);
    if (name === 'UID') cur.uid = value.trim();
    else if (name === 'SUMMARY') cur.summary = value;
    else if (name === 'DTSTART') cur.dtstart = value;
  }
  return events;
}

/** Imported events keyed by KST day; sorted by time within a day. */
export function importedEventsByDay(events: ImportedEvent[]): Map<string, ImportedEvent[]> {
  const map = new Map<string, ImportedEvent[]>();
  for (const e of events) {
    const k = e.date.slice(0, 10);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}
