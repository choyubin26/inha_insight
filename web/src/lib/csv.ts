import type { NoticeListItem } from '@shared/api/types.ts';
import { noticeTitle, translations, type Lang } from './i18n.ts';
import { noticeEvents } from './events.ts';

// Bulk "내 일정" export as a spreadsheet-style CSV, using the classic "Outlook CSV" columns that
// Google Calendar's own bulk import still reads. The .ics export (ics.ts) is the more reliable way
// to get these into a calendar app; this CSV is for opening in a spreadsheet, or for that importer.
// Pure text building only (no DOM) so it can run in tests; downloadCsvBulk (ics.ts) does the saving.

const HEADER = ['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'All Day Event', 'Description', 'Location', 'Private'];

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** "2026-10-16" -> "10/16/2026" (Outlook/Google CSV expects M/D/YYYY, no leading zeros required). */
function mdy(date: string): string {
  const [y, m, d] = [date.slice(0, 4), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
  return `${m}/${d}/${y}`;
}

/** "...T14:05" -> "2:05 PM". No timezone field in this format: assumes the importing calendar is KST, same as the site. */
function hm12(date: string): string {
  const min = date.slice(14, 16);
  let h = Number(date.slice(11, 13));
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

export function buildCsvBulk(notices: NoticeListItem[], lang: Lang = 'ko'): string | null {
  const t = translations[lang];
  const rows: string[][] = [];
  for (const notice of notices) {
    for (const e of noticeEvents(notice)) {
      const timed = e.date.length > 10;
      rows.push([
        `[${t.events[e.kind]}] ${noticeTitle(notice, lang)}`,
        mdy(e.date),
        timed ? hm12(e.date) : '',
        mdy(e.date),
        timed ? hm12(e.date) : '',
        timed ? 'False' : 'True',
        `${t.ics.description} ${t.ics.source}: ${notice.sourceUrl}`,
        '',
        'False',
      ]);
    }
  }
  if (rows.length === 0) return null;
  return [HEADER, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}
