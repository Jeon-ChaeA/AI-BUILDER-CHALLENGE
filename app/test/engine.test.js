import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AREAS as E_AREAS } from '../public/engine.js';
import {
  diagnose, verifyPlan, vagueTerms, defaultPlan, planTerms, pickDates, sanitizeCourses, nameKey, termNow, josa, tidyPlan, consultFacts,
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

test('tidyPlan은 AI 계획의 과목명·학점을 교육과정에 맞추고 재수강을 표시한다', () => {
  const plan = tidyPlan([{ term: '2027-1', why: 'x', courses: [
    { name: '컴퓨터 네트워크', credits: 2, category: '전공필수' },
    { name: '핵심교양 (창의)', credits: 3, category: '핵심교양', area: '창의', generic: true },
    { name: '모르는과목', credits: 3, category: '전공선택' },
    { name: '일반선택', credits: 3, category: '일반선택', generic: true },
    { name: '일반선택', credits: 1, category: '일반선택', generic: true },
  ] }, 'garbage'], sample, ctx, data);
  assert.equal(plan[0].courses.filter((c) => c.category === '일반선택').length, 1);
  assert.equal(plan[0].courses.find((c) => c.category === '일반선택').credits, 4);
  assert.deepEqual(plan[0].courses[0], { name: '컴퓨터네트워크', credits: 3, category: '전공선택', kind: 'retake' });
  assert.equal(plan[0].courses[1].generic, true);
  assert.equal(plan[0].courses[2].name, '모르는과목');
  assert.deepEqual(plan[1], { term: '', why: '', courses: [] });
});

test('vagueTerms는 고를 전공 과목이 남았는데 일반선택 빈칸이 큰 학기를 짚는다', () => {
  const blank = (credits) => [{ term: '2027-1', why: '', courses: [{ name: '일반선택', credits, category: '일반선택', generic: true }] }];
  assert.equal(vagueTerms(blank(6), sample, ctx, data).length, 0);
  const v = vagueTerms(blank(14), sample, ctx, data);
  assert.equal(v.length, 1);
  assert.match(v[0], /2027-1: 일반선택 빈칸이 14학점/);
  assert.deepEqual(vagueTerms(defaultPlan(sample, ctx, data), sample, ctx, data), []); // 기본 계획은 지적받지 않는다
});

test('consultFacts는 진단에서 확인할 사실만 뽑는다', () => {
  const plan = defaultPlan(sample, ctx, data);
  const facts = consultFacts(sample, ctx, data, plan);
  const ids = facts.map((f) => f.id);
  for (const id of ['retake:컴퓨터네트워크', 'globalEnglish', 'competency', 'majorTrack', 'thesis']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('area'), '샘플의 핵심교양은 모두 요람 목록에 있다');
  assert.match(facts.find((f) => f.id === 'retake:컴퓨터네트워크').fact, /2026-1학기에 F/);
  assert.match(facts.find((f) => f.id === 'thesis').fact, /2027-1학기/);
  const guessed = consultFacts([C('2023-1', '없는교양과목', 3, '핵심교양', 'A0', { area: '창의', areaGuess: true })], { ordinal: 1, termNow: '2023-1' }, data);
  assert.match(guessed.find((f) => f.id === 'area').fact, /없는교양과목\(창의로 추정\)/);
});

test('리뷰 회귀: 띄어 쓴 "수강 중"도 수강 중으로 보고 계획한다', () => {
  const spaced = sample.map((c) => (c.grade === '' ? { ...c, grade: '수강 중' } : c));
  assert.deepEqual(planTerms(spaced, ctx, data), ['2027-1', '2027-2']);
  const plan = defaultPlan(spaced, ctx, data);
  assert.deepEqual(verifyPlan(plan, spaced, ctx, data), []);
  assert.ok(!plan.flatMap((p) => p.courses).some((c) => c.name === '알고리즘'));
});

test('리뷰 회귀: 읽지 못한 성적은 CHK-01에서 알린다', () => {
  const odd = sample.map((c) => (c.name === '선형대수' ? { ...c, grade: 'A-' } : c));
  const k = byId(diagnose(odd, ctx, data));
  assert.equal(k['CHK-01'].have, 81);
  assert.match(k['CHK-01'].note, /성적을 읽지 못한 1과목\(선형대수\)/);
});

test('리뷰 회귀: S-TEAM Class와 사제동행세미나는 따로 세고 합쳐 4학점까지', () => {
  const s = (term, name, code) => C(term, name, 1, '전공선택', 'P', { code });
  const two = diagnose([s('2023-1', 'S-TEAM Class', '0367203'), s('2024-1', '사제동행세미나', '0367202')], { ordinal: 3, termNow: '2024-1' }, data);
  assert.equal(two.A.counted, 2);
  const five = diagnose([s('2023-1', 'S-TEAM Class', '0367203'), ...['2023-2', '2024-1', '2024-2', '2025-1'].map((t) => s(t, '사제동행세미나', '0367202'))], { ordinal: 5, termNow: '2025-1' }, data);
  assert.equal(five.A.counted, 4);
  assert.equal(byId(five)['CHK-06'].have, 1);
});

test('리뷰 회귀: verifyPlan은 학기 건너뛰기와 0 이하 학점 빈칸을 잡는다', () => {
  const plan = defaultPlan(sample, ctx, data);
  const skip = structuredClone(plan); skip[1].term = '2028-2';
  assert.ok(verifyPlan(skip, sample, ctx, data).some((e) => /빠짐없이/.test(e)));
  const neg = structuredClone(plan); neg[0].courses.push({ name: '일반선택', credits: -7, category: '일반선택', generic: true });
  assert.ok(verifyPlan(neg, sample, ctx, data).some((e) => /1 이상/.test(e)));
});

test('무작위 이수내역 300개: 대체 계획은 항상 검증을 통과한다', () => {
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const pool = data.cur.courses.filter((c) => c.category !== '기초교양');
  const grades = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D0', 'F', 'P'];
  const fails = [];
  for (let n = 0; n < 300; n++) {
    const ordinal = 1 + rnd(8);
    const courses = [];
    let t = '2023-1';
    for (let o = 1; o <= ordinal; o++) {
      for (let k = 0; k < 4 + rnd(4); k++) {
        const c = pool[rnd(pool.length)];
        courses.push(C(t, c.name, c.credits, '전공선택', o === ordinal ? '' : grades[rnd(grades.length)]));
      }
      courses.push(C(t, `교양${o}`, 3, ['핵심교양', '자유교양', '일반선택'][rnd(3)], o === ordinal ? '' : 'A0', { area: E_AREAS[rnd(5)], areaGuess: true }));
      if (o < ordinal) t = t.endsWith('-1') ? t.replace('-1', '-2') : `${+t.slice(0, 4) + 1}-1`;
    }
    const c2 = { ordinal, termNow: t };
    const plan = defaultPlan(courses, c2, data);
    const errs = verifyPlan(plan, courses, c2, data);
    if (errs.length) fails.push({ n, ordinal, errs: errs.slice(0, 2) });
  }
  assert.deepEqual(fails.slice(0, 3), []);
});

test('AI가 등급 글자를 깨뜨리면 평점 숫자로 되살린다', () => {
  const out = sanitizeCourses([
    { term: '2023-1', name: '자료구조', credits: 3, category: '전공선택', grade: 'B뼈', points: 3.5 },
    { term: '2023-1', name: '선형대수', credits: 3, category: '전공선택', grade: '??', points: 0 },
    { term: '2023-1', name: '수치해석', credits: 3, category: '전공선택', grade: 'A0', points: 3.5 },
  ], data.cats);
  assert.deepEqual(out.map((c) => c.grade), ['B+', '??', 'A0']);
});
