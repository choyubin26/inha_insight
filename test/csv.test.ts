// Bulk "내 일정" CSV export (web/src/lib/csv.ts). Pure text building, no DOM.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NoticeListItem } from '../src/api/types.ts';
import { buildCsvBulk } from '../web/src/lib/csv.ts';

function notice(id: number, a: Partial<{ deadline: string | null; applicationEnd: string | null; eventDate: string | null }> | null): NoticeListItem {
  return {
    id, sourceNoticeId: String(id), title: `공지 ${id}`, sourceUrl: `https://www.inha.ac.kr/notice/${id}`, sources: [], publishedAt: null, boardCategory: null,
    crawledAt: '', contentUpdatedAt: null, analysisStatus: a ? 'ready' : 'pending',
    analysis: a && ({ deadline: null, applicationEnd: null, eventDate: null, ...a } as any),
  };
}

test('no events at all -> null (nothing to download)', () => {
  assert.equal(buildCsvBulk([notice(1, null)]), null);
});

test('one all-day deadline: header + one row, M/D/YYYY dates, All Day Event = True, no times', () => {
  const csv = buildCsvBulk([notice(1, { deadline: '2026-10-05' })], 'ko');
  const [header, row, trailing] = csv!.split('\r\n');
  assert.equal(header, 'Subject,Start Date,Start Time,End Date,End Time,All Day Event,Description,Location,Private');
  assert.equal(row, '[신청 마감] 공지 1,10/5/2026,,10/5/2026,,True,AI가 공지에서 추출한 날짜예요. 반드시 원문에서 확인하세요. 원문: https://www.inha.ac.kr/notice/1,,False');
  assert.equal(trailing, '');
});

test('a timed event gets 12-hour start/end times and All Day Event = False', () => {
  const csv = buildCsvBulk([notice(2, { eventDate: '2026-10-05T14:30' })], 'ko');
  const row = csv!.split('\r\n')[1];
  assert.ok(row.startsWith('[행사 일정] 공지 2,10/5/2026,2:30 PM,10/5/2026,2:30 PM,False,'), row);
});

test('midnight and noon format correctly (12-hour edge cases)', () => {
  const midnight = buildCsvBulk([notice(3, { eventDate: '2026-01-01T00:15' })], 'ko')!.split('\r\n')[1];
  assert.ok(midnight.includes(',12:15 AM,'), midnight);
  const noon = buildCsvBulk([notice(4, { eventDate: '2026-01-01T12:00' })], 'ko')!.split('\r\n')[1];
  assert.ok(noon.includes(',12:00 PM,'), noon);
});

test('multiple notices and multiple events per notice each get their own row, in order', () => {
  const csv = buildCsvBulk([notice(5, { deadline: '2026-10-05', eventDate: '2026-10-10T09:00' }), notice(6, { deadline: '2026-11-01' })], 'ko')!;
  const rows = csv.split('\r\n').slice(1, -1);
  assert.equal(rows.length, 3);
  assert.ok(rows[0].startsWith('[신청 마감] 공지 5,'));
  assert.ok(rows[1].startsWith('[행사 일정] 공지 5,'));
  assert.ok(rows[2].startsWith('[신청 마감] 공지 6,'));
});

test('English language uses English kind labels', () => {
  const row = buildCsvBulk([notice(7, { deadline: '2026-10-05' })], 'en')!.split('\r\n')[1];
  assert.ok(row.startsWith('[Deadline] 공지 7,'), row);
});
