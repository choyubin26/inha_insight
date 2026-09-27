// Parsing a .ics file imported from another calendar (web/src/lib/icsImport.ts). Pure text in, data out.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importedEventsByDay, parseIcs } from '../web/src/lib/icsImport.ts';

test('parses an all-day event (VALUE=DATE) and a timed event with a TZID (kept as local wall-clock)', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:abc-123@google.com',
    'DTSTART;VALUE=DATE:20261016',
    'SUMMARY:과제 마감',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:def-456@google.com',
    'DTSTART;TZID=Asia/Seoul:20261020T140000',
    'SUMMARY:스터디 모임',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const events = parseIcs(ics);
  assert.deepEqual(events, [
    { uid: 'abc-123@google.com', title: '과제 마감', date: '2026-10-16', allDay: true },
    { uid: 'def-456@google.com', title: '스터디 모임', date: '2026-10-20T14:00', allDay: false },
  ]);
});

test('a UTC ("Z") DTSTART is shifted by a fixed +9h to KST, matching ics.ts export', () => {
  const ics = ['BEGIN:VEVENT', 'UID:z-1', 'DTSTART:20261020T050000Z', 'SUMMARY:Meeting', 'END:VEVENT'].join('\n');
  assert.deepEqual(parseIcs(ics), [{ uid: 'z-1', title: 'Meeting', date: '2026-10-20T14:00', allDay: false }]);
});

test('unfolds RFC 5545 continuation lines and unescapes SUMMARY text', () => {
  const ics = ['BEGIN:VEVENT', 'UID:fold-1', 'DTSTART;VALUE=DATE:20261101', 'SUMMARY:줄바꿈 포함\\, 쉼표\\n둘째 줄이 ', ' 이어짐', 'END:VEVENT'].join('\n');
  assert.deepEqual(parseIcs(ics), [{ uid: 'fold-1', title: '줄바꿈 포함, 쉼표\n둘째 줄이 이어짐', date: '2026-11-01', allDay: true }]);
});

test('an event with no UID gets a stable fallback id; fields outside VEVENT (VTIMEZONE, VCALENDAR) are ignored', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VTIMEZONE',
    'DTSTART:19700101T000000',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20261225',
    'SUMMARY:크리스마스',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n');
  assert.deepEqual(parseIcs(ics), [{ uid: '2026-12-25-크리스마스', title: '크리스마스', date: '2026-12-25', allDay: true }]);
});

test('a VEVENT with no DTSTART, or unparsable text, contributes nothing', () => {
  assert.deepEqual(parseIcs('BEGIN:VEVENT\nUID:x\nSUMMARY:no date\nEND:VEVENT'), []);
  assert.deepEqual(parseIcs('not an ics file at all'), []);
});

test('importedEventsByDay groups by KST day and sorts by time within a day', () => {
  const map = importedEventsByDay([
    { uid: '1', title: 'B', date: '2026-10-20T14:00', allDay: false },
    { uid: '2', title: 'A', date: '2026-10-20T09:00', allDay: false },
    { uid: '3', title: 'C', date: '2026-10-21', allDay: true },
  ]);
  assert.deepEqual(map.get('2026-10-20')!.map((e) => e.uid), ['2', '1']);
  assert.deepEqual(map.get('2026-10-21')!.map((e) => e.uid), ['3']);
});
