import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  diagnose, verifyPlan, defaultPlan, planTerms, pickDates, sanitizeCourses, nameKey, termNow, josa,
} from '../public/engine.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8'));
const data = {
  req: load('data/requirements.json'), cur: load('data/curriculum.json'), cats: load('data/categories.json'),
  cal: load('data/calendar.json'), areas: load('data/core_areas.json'),
};
const sample = load('sample/parsed.json').courses;
const ctx = { ordinal: 6, termNow: '2026-2' };
const byId = (r) => Object.fromEntries(r.checks.map((c) => [c.id, c]));
const C = (term, name, credits, category, grade, extra = {}) => ({ term, code: null, name, credits, category, grade, area: null, areaGuess: false, ...extra });

test('샘플 학생: 체크별 상태와 수치가 목업과 같다', () => {
  const r = diagnose(sample, ctx, data);
  const k = byId(r);
  assert.equal(k['CHK-06'].s, 'fail');
  assert.equal(k['CHK-06'].have, 12);
  assert.match(k['CHK-06'].note, /컴퓨터네트워크가 F예요\. 1학기에만 열려서 2027-1학기에 꼭 다시 들어야 해요/);
  for (const id of ['CHK-01', 'CHK-03', 'CHK-05', 'CHK-08']) assert.equal(k[id].s, 'pending', id);
  for (const id of ['CHK-02', 'CHK-04', 'CHK-07']) assert.equal(k[id].s, 'pass', id);
  assert.equal(k['CHK-09'].s, 'skip');
  assert.equal(k['CHK-01'].have, 84);
  assert.equal(k['CHK-05'].have, 57);
  assert.equal(k['CHK-03'].have, 12);
  assert.match(k['CHK-03'].note, /창의 영역/);
  assert.equal(r.checks[0].id, 'CHK-06', '조치 필요가 맨 위');
  assert.equal(r.summary.prog, 16);
  assert.deepEqual(r.summary.fails, ['컴퓨터네트워크']);
});

test('등급 표기 변형 A0/A°/A는 같은 평점이다', () => {
  const g = (grade) => diagnose([C('2023-1', '선형대수', 3, '전공선택', grade)], { ordinal: 1, termNow: '2023-1' }, data).A.gpa;
  assert.equal(g('A0'), 4);
  assert.equal(g('A°'), 4);
  assert.equal(g('A'), 4);
  assert.equal(g('B+'), 3.5);
});

test('P는 학점만, F는 평점만, N은 둘 다 제외', () => {
  const r = diagnose([
    C('2023-1', '선형대수', 3, '전공선택', 'A+'),
    C('2023-1', '수치해석', 3, '전공선택', 'F'),
    C('2023-1', '유레카프로젝트', 1, '전공선택', 'P'),
    C('2023-1', '사제동행세미나', 1, '전공선택', 'N'),
  ], { ordinal: 1, termNow: '2023-1' }, data);
  assert.equal(r.A.counted, 4);
  assert.equal(r.A.gpa, 2.25);
});

test('재수강하면 최근 성적만 남고, 재수강 중인 F는 진행 중이 된다', () => {
  const base = sample.filter((c) => c.name !== '컴퓨터네트워크');
  const retaken = diagnose([...base, C('2026-1', '컴퓨터네트워크', 3, '전공선택', 'F'), C('2027-1', '컴퓨터 네트워크', 3, '전공선택', 'B0')], { ordinal: 7, termNow: '2027-1' }, data);
  assert.equal(retaken.A.eff.filter((r) => r.name.includes('네트워크')).length, 1);
  assert.ok(retaken.A.gpa > diagnose(sample, ctx, data).A.gpa);
  const retaking = diagnose([...base, C('2026-1', '컴퓨터네트워크', 3, '전공선택', 'F'), C('2026-2', '컴퓨터네트워크', 3, '전공선택', '')], ctx, data);
  assert.equal(byId(retaking)['CHK-06'].s, 'pending');
});

test('교양은 50학점까지만 총 학점에 들어간다', () => {
  const many = Array.from({ length: 18 }, (_, i) => C('2023-1', `교양과목${i}`, 3, '자유교양', 'A0'));
  assert.equal(diagnose(many, { ordinal: 1, termNow: '2023-1' }, data).A.counted, 50);
});

test('꼬리표 붙은 과목명과 코드 앞 5자리로 매칭한다', () => {
  assert.equal(nameKey('English Conversation II(ABEEK)'), nameKey('English Conversation Ⅱ'));
  assert.equal(nameKey('글쓰기(공학인증)'), nameKey('글쓰기'));
  const r = diagnose([
    C('2023-1', 'English Conversation II(ABEEK)', 2, '기초교양', 'A0', { code: '036370D' }),
    C('2023-1', '글쓰기(공학인증)', 3, '기초교양', 'A0', { code: '000200D' }),
    C('2023-2', 'College English I', 2, '기초교양', 'A0'),
    C('2023-1', '소프트웨어적사고', 3, '일반선택', 'A0', { code: '1143702' }),
  ], { ordinal: 2, termNow: '2023-2' }, data);
  assert.equal(byId(r)['CHK-02'].s, 'pass');
  assert.equal(r.A.majorEarned, 3, '라벨이 일반선택이어도 목록에 있는 전공 과목은 전공');
});

test('핵심교양 영역은 요람 목록 > AI 추정 순서로 정한다', () => {
  const r = diagnose([
    C('2023-1', '철학의물음들', 3, '핵심교양', 'A0', { area: '창의', areaGuess: true }),
    C('2023-1', '없는교양과목', 3, '핵심교양', 'A0', { area: '창의', areaGuess: true }),
  ], { ordinal: 1, termNow: '2023-1' }, data);
  assert.equal(r.A.areaCredits['인문Ⅰ'], 3);
  assert.equal(r.A.areaCredits['창의'], 3);
  assert.ok(r.A.guessed);
});

test('샘플의 대체 계획은 검증을 통과하고 컴퓨터네트워크 재수강과 캡스톤을 1학기에 넣는다', () => {
  const plan = defaultPlan(sample, ctx, data);
  assert.deepEqual(plan.map((p) => p.term), ['2027-1', '2027-2']);
  assert.deepEqual(verifyPlan(plan, sample, ctx, data), []);
  const t1 = plan[0].courses.map((c) => c.name);
  assert.ok(t1.includes('컴퓨터네트워크') && t1.includes('다학제간캡스톤디자인'));
  assert.equal(plan[0].courses.find((c) => c.name === '컴퓨터네트워크').kind, 'retake');
});

test('verifyPlan이 위반을 각각 잡는다', () => {
  const ok = defaultPlan(sample, ctx, data);
  const clone = () => structuredClone(ok);
  const has = (plan, re) => verifyPlan(plan, sample, ctx, data).some((e) => re.test(e));
  let p = clone(); p[0].courses.push({ name: '산업체특강', credits: 1, category: '전공선택' }, { name: '웹서버컴퓨팅', credits: 3, category: '전공선택' }, { name: '소프트웨어공학', credits: 3, category: '전공선택' });
  assert.ok(has(p, /19학점을 넘어요/));
  p = clone(); p[0].courses.push({ name: '운영체제', credits: 3, category: '전공선택' });
  assert.ok(has(p, /이미 이수한 과목/));
  p = clone(); p[1].courses.push({ name: '알고리즘', credits: 3, category: '전공선택' });
  assert.ok(has(p, /지금 듣고 있는 과목/));
  p = clone(); p[1].courses.push({ name: '없는과목', credits: 3, category: '전공선택' });
  assert.ok(has(p, /교육과정에 없는 과목/));
  p = clone(); p[1].courses.push({ name: '다학제간캡스톤디자인', credits: 3, category: '전공선택' });
  assert.ok(has(p, /1학기에만 열리는 과목/));
  p = clone(); p[0].courses.push({ name: '전공 아무거나', credits: 3, category: '전공선택', generic: true });
  assert.ok(has(p, /실제 과목명으로/));
  p = clone(); p[0].courses = p[0].courses.filter((c) => c.name !== '컴퓨터네트워크');
  assert.ok(has(p, /필수 지정 과목 요건이 부족/));
});

test('요건을 다 채운 학생은 계획 학기가 없고 학위수여식 일정이 나온다', () => {
  const plan = defaultPlan(sample, ctx, data);
  const all = [...sample.map((c) => (c.grade === '' ? { ...c, grade: 'A0' } : c))];
  for (const p of plan) for (const c of p.courses) all.push(C(p.term, c.name, c.credits, c.category, 'A0', { area: c.area ?? null, generic: !!c.generic }));
  const done = { ordinal: 8, termNow: '2027-2' };
  assert.deepEqual(planTerms(all, done, data), []);
  const diag = diagnose(all, done, data);
  assert.ok(diag.checks.filter((c) => c.s !== 'skip').every((c) => c.s === 'pass'));
  const dates = pickDates({ diag, plan: [], courses: all, ctx: done, data, today: new Date('2026-10-03T09:00:00') });
  assert.ok(dates.some((d) => d.title.includes('학위수여식')));
});

test('일정: 지난 것은 빼고, 다음 학기 수강신청에 재수강 과목을 적는다', () => {
  const diag = diagnose(sample, ctx, data);
  const plan = defaultPlan(sample, ctx, data);
  const dates = pickDates({ diag, plan, courses: sample, ctx, data, today: new Date('2026-12-20T09:00:00') });
  assert.ok(dates.every((d) => d.end >= '2026-12-20'));
  assert.ok(!dates.some((d) => d.title.includes('학위수여식')));
  const enroll = dates.find((d) => d.id === 'enroll-2027-1');
  assert.match(enroll.why, /컴퓨터네트워크 재수강/);
  assert.equal(enroll.link, 'act');
});

test('sanitizeCourses는 잘못된 행을 거르고 값을 정리한다', () => {
  const out = sanitizeCourses([
    { term: '2023-1', name: ' 자료구조 ', credits: '3', category: '전선', grade: ' A0 ', code: '0156405' },
    { term: '2023-1', name: '', credits: 3, category: '전공선택', grade: 'A0' },
    { term: '2023', name: '학기없음', credits: 3, category: '전공선택', grade: 'A0' },
    { term: '2023-1', name: '학점이상', credits: 'abc', category: '전공선택', grade: 'A0' },
    { term: '2023-여름', name: '계절', credits: 3, category: '이상한구분', grade: 'B0', area: '창의' },
    { term: '2023-2', name: '교양', credits: 3, category: '핵심교양', grade: 'B0', area: '창의', areaGuess: true },
    null,
  ], data.cats);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { term: '2023-1', code: '0156405', name: '자료구조', credits: 3, category: '전공선택', grade: 'A0', area: null, areaGuess: false });
  assert.equal(out[1].category, '일반선택');
  assert.equal(out[1].area, null);
  assert.equal(out[2].area, '창의');
  assert.equal(sanitizeCourses('nope', data.cats).length, 0);
});

test('학기와 조사 도우미', () => {
  assert.equal(termNow(new Date('2026-10-03')), '2026-2');
  assert.equal(termNow(new Date('2027-01-10')), '2026-2');
  assert.equal(termNow(new Date('2027-03-02')), '2027-1');
  assert.equal(josa('컴퓨터네트워크', '이/가'), '컴퓨터네트워크가');
  assert.equal(josa('알고리즘', '을/를'), '알고리즘을');
});
