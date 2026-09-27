import type { NoticeListItem } from '@shared/api/types.ts';
import { noticeTitle, translations, type Lang, type Translations } from './i18n.ts';
import { noticeEvents, type NoticeEvent } from './events.ts';
import { buildCsvBulk } from './csv.ts';

// "캘린더에 추가": a standard .ics file that Google / Apple / Outlook calendars import.
// No account or backend needed. KST has no DST, so timed events convert to UTC with a fixed +9h.

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** RFC 5545 line folding at 75 octets (UTF-8 aware, so Korean isn't split mid-character). */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (d: string) => d.slice(0, 10).replaceAll('-', '');
function nextDay(d: string) {
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10).replaceAll('-', '');
}
function kstToUtc(d: string, addHours = 0) {
  const t = new Date(`${d.slice(0, 16)}:00+09:00`);
  t.setUTCHours(t.getUTCHours() + addHours);
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** One VEVENT block for a single notice event; shared by the single-notice and bulk exports. */
function veventBlock(notice: NoticeListItem, e: NoticeEvent, stamp: string, t: Translations, lang: Lang): string[] {
  const timed = e.date.length > 10;
  return [
    'BEGIN:VEVENT',
    `UID:inha-notice-${notice.sourceNoticeId}-${e.kind}@inha-notices`,
    `DTSTAMP:${stamp}`,
    ...(timed ? [`DTSTART:${kstToUtc(e.date)}`, `DTEND:${kstToUtc(e.date, 1)}`] : [`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${nextDay(e.date)}`]),
    `SUMMARY:${escape(`[${t.events[e.kind]}] ${noticeTitle(notice, lang)}`)}`,
    `DESCRIPTION:${escape(`${t.ics.description}\n${t.ics.source}: ${notice.sourceUrl}`)}`,
    `URL:${notice.sourceUrl}`,
    'END:VEVENT',
  ];
}

function wrapCalendar(pairs: { notice: NoticeListItem; e: NoticeEvent }[], lang: Lang): string {
  const t = translations[lang];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Inha Insight//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const { notice, e } of pairs) lines.push(...veventBlock(notice, e, stamp, t, lang));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function buildIcs(notice: NoticeListItem, lang: Lang = 'ko'): string | null {
  const events = noticeEvents(notice);
  if (events.length === 0) return null;
  return wrapCalendar(events.map((e) => ({ notice, e })), lang);
}

/** One .ics with every event from every given notice (e.g. all of "내 일정"), one VCALENDAR. */
export function buildIcsMulti(notices: NoticeListItem[], lang: Lang = 'ko'): string | null {
  const pairs = notices.flatMap((notice) => noticeEvents(notice).map((e) => ({ notice, e })));
  if (pairs.length === 0) return null;
  return wrapCalendar(pairs, lang);
}

function downloadBlob(content: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadIcs(notice: NoticeListItem, lang: Lang = 'ko'): boolean {
  const ics = buildIcs(notice, lang);
  if (!ics) return false;
  downloadBlob(ics, 'text/calendar;charset=utf-8', `inha-notice-${notice.sourceNoticeId}.ics`);
  return true;
}

/** Bulk "내 일정" export as one .ics — the reliable way to bring it into Google/Apple/Outlook calendars. */
export function downloadIcsMulti(notices: NoticeListItem[], lang: Lang = 'ko', filename = 'inha-my-events.ics'): boolean {
  const ics = buildIcsMulti(notices, lang);
  if (!ics) return false;
  downloadBlob(ics, 'text/calendar;charset=utf-8', filename);
  return true;
}

/** Bulk "내 일정" export as a CSV (spreadsheets, or Google Calendar's classic CSV import). */
export function downloadCsvBulk(notices: NoticeListItem[], lang: Lang = 'ko', filename = 'inha-my-events.csv'): boolean {
  const csv = buildCsvBulk(notices, lang);
  if (!csv) return false;
  // UTF-8 BOM so Excel opens Korean text correctly.
  downloadBlob(`\uFEFF${csv}`, 'text/csv;charset=utf-8', filename);
  return true;
}
