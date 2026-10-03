// FR-04 일정 모듈(public/schedule.js) 검사. 사용: npm run test:schedule
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
await import(pathToFileURL(join(pub, 'schedule.js')).href);
const { Schedule } = globalThis;
const { events } = JSON.parse(readFileSync(join(pub, 'data', 'calendar.json'), 'utf8'));
const at = (iso) => new Date(`${iso}T12:00:00`);
const ids = (list) => list.map((e) => e.id);
const ALL = { hasCreditShortage: true, hasNextSemesterCourses: true, isGraduatingSemester: true };
const NONE = { hasCreditShortage: false, hasNextSemesterCourses: false, isGraduatingSemester: false };
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

t('trigger none은 어떤 조건에서도 나오지 않는다', () => {
  const out = ids(Schedule.upcoming(events, ALL, at('2026-10-01')));
  for (const e of events.filter((x) => x.trigger === 'none')) assert.ok(!out.includes(e.id), e.id);
});
t('조건이 모두 거짓이면 always만 나온다', () => {
  const out = Schedule.upcoming(events, NONE, at('2026-10-01'));
  assert.ok(out.length > 0 && out.every((e) => e.trigger === 'always'));
});
t('flag별로 해당 trigger 일정만 추가된다', () => {
  const only = (k) => Schedule.upcoming(events, { ...NONE, [k]: true }, at('2026-10-01')).filter((e) => e.trigger !== 'always');
  for (const k of Object.keys(ALL)) {
    const got = only(k);
    assert.ok(got.length > 0, k);
    assert.ok(got.every((e) => e.trigger === k), k);
  }
});
t('끝나는 날은 포함하고 다음 날부터 제외한다', () => {
  assert.ok(ids(Schedule.upcoming(events, ALL, at('2026-12-28'))).includes('grade-publish-2-2026'));
  assert.ok(!ids(Schedule.upcoming(events, ALL, at('2026-12-29'))).includes('grade-publish-2-2026'));
});
t('시작일 순으로 정렬된다', () => {
  const out = Schedule.upcoming(events, ALL, at('2026-10-01'));
  assert.deepEqual(ids(out), ids([...out].sort((a, b) => a.start.localeCompare(b.start))));
});
t('D-day: 시작 전은 양수, 진행 중은 0 이하', () => {
  const e = { start: '2026-11-24', end: '2026-11-26' };
  assert.equal(Schedule.daysLeft(e, at('2026-11-14')), 10);
  assert.equal(Schedule.daysLeft(e, at('2026-11-24')), 0);
  assert.ok(Schedule.daysLeft(e, at('2026-11-25')) < 0);
});
t('.ics 이스케이프: 쉼표, 세미콜론, 역슬래시, 줄바꿈', () => {
  assert.equal(Schedule.escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
});
t('.ics 줄은 75바이트 이하이고 접은 줄은 공백으로 시작한다', () => {
  const folded = Schedule.fold(`SUMMARY:${'가'.repeat(60)}`);
  const enc = new TextEncoder();
  for (const line of folded.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line);
  assert.equal(folded.replace(/\r\n /g, ''), `SUMMARY:${'가'.repeat(60)}`);
});
t('.ics 일정 개수와 날짜: DTEND는 end+1일', () => {
  const list = Schedule.upcoming(events, ALL, at('2026-10-01'));
  const ics = Schedule.buildIcs(list, at('2026-10-01'));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.equal((unfolded.match(/BEGIN:VEVENT/g) ?? []).length, list.length);
  assert.equal((unfolded.match(/END:VEVENT/g) ?? []).length, list.length);
  const one = list.find((e) => e.id === 'grade-publish-2-2026');
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20261215'));
  assert.ok(unfolded.includes('DTEND;VALUE=DATE:20261229'), one.end);
  const day = list.find((e) => e.start === e.end);
  assert.ok(day, '하루짜리 일정');
  const [y, m, d] = day.start.split('-');
  const next = new Date(Date.UTC(+y, +m - 1, +d + 1)).toISOString().slice(0, 10).replaceAll('-', '');
  assert.ok(unfolded.includes(`DTSTART;VALUE=DATE:${y}${m}${d}\r\nDTEND;VALUE=DATE:${next}`));
});
t('.ics UID가 서로 다르고 CRLF 줄바꿈을 쓴다', () => {
  const list = Schedule.upcoming(events, ALL, at('2026-10-01'));
  const ics = Schedule.buildIcs(list, at('2026-10-01'));
  const uids = ics.match(/^UID:.*$/gm);
  assert.equal(new Set(uids).size, uids.length);
  assert.ok(!/[^\r]\n/.test(ics));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
});

console.log(`${n}개 통과`);
