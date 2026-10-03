// FR-03 로드맵 검증·기본 로드맵(lib/roadmap.mjs) 검사. 사용: npm run test:roadmap
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeName, findCourse, remainingTerms, termPlan, creditLimit, validateRoadmap, buildDefaultRoadmap, loadData } from '../lib/roadmap.mjs';

const data = await loadData(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data'));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };
const rules = (v) => v.map((x) => x.rule);
const names = (term) => term.items.map((i) => i.name ?? i.slot);

// 목업의 김국민: 6학기 등록(2026-2 수강 중), 컴퓨터네트워크 F, 휴학 2학기. 수강 중 학점을 이수로 센다.
const TAKEN = ['English Conversation Ⅰ', '글쓰기', '소프트웨어적사고', '소프트웨어프로젝트Ⅰ', 'S-TEAM Class', '공학기초수학', 'College English Ⅰ',
  '객체지향프로그래밍', '응용통계학', '유레카프로젝트', '선형대수', '소프트웨어프로젝트Ⅱ', '자료구조', 'C++프로그래밍', '논리회로설계', '웹클라이언트컴퓨팅',
  '이산수학', '컴퓨터구조', '모바일프로그래밍', '데이터과학', '운영체제', '데이터베이스', '프로그래밍언어론', 'SW 기술영어Ⅰ',
  '알고리즘', '컴파일러', '인공지능', '클라우드컴퓨팅', 'SW 기술영어Ⅱ'];
const kim = (over = {}) => ({
  nextTerm: '2027-1', registeredSemesters: 6, taken: TAKEN.map((name) => ({ name })), retake: [{ name: '컴퓨터네트워크' }],
  earned: { 기초교양: 7, 핵심교양: 12, 자유교양: 2, 전공필수: 36, 전공선택: 34, 일반선택: 9, total: 100 },
  prevGpa: 3.4, missingCoreAreas: ['창의'], ...over,
});

t('과목명 정규화: 공학인증·공백·로마숫자', () => {
  assert.equal(normalizeName('글쓰기(공학인증)'), normalizeName('글쓰기'));
  assert.equal(normalizeName('SW 기술영어Ⅰ'), normalizeName('SW기술영어I'));
  assert.notEqual(normalizeName('College English Ⅰ'), normalizeName('College English Ⅱ'));
});
t('과목 찾기: 별칭, 코드 앞 5자리', () => {
  assert.equal(findCourse(data, { name: '클라우드컴퓨팅' }).name, '클라우드컴퓨팅');
  assert.equal(findCourse(data, { name: '빅데이터플랫폼' })?.name, '클라우드컴퓨팅'); // 옛 과목명
  assert.equal(findCourse(data, { code: '1143702', name: '무엇이든' }).name, '소프트웨어적사고'); // 1143704와 앞 5자리 같음
  assert.equal(findCourse(data, { name: 'English Conversation Ⅰ' })?.name, 'English Conversation'); // 별칭은 requirements에 있다
  assert.equal(findCourse(data, { name: '글쓰기(공학인증)' })?.name, '글쓰기');
  assert.equal(findCourse(data, { name: '없는과목' }), null);
});
t('남은 학기: 8 − 등록 학기, 학년은 등록 학기 기준', () => {
  assert.equal(remainingTerms(kim(), data.requirements), 2);
  assert.deepEqual(termPlan(kim(), data.requirements), [{ term: '2027-1', semester: 1, grade: 4 }, { term: '2027-2', semester: 2, grade: 4 }]);
  assert.equal(remainingTerms(kim({ registeredSemesters: 9 }), data.requirements), 0);
  assert.deepEqual(termPlan(kim({ nextTerm: '2026-2', registeredSemesters: 3 }), data.requirements).map((x) => [x.term, x.grade]),
    [['2026-2', 2], ['2027-1', 3], ['2027-2', 3], ['2028-1', 4], ['2028-2', 4]]);
});
t('학점 한도: 19, 직전 3.75 이상이면 첫 학기만 22, 경고 2회면 14', () => {
  const r = data.requirements;
  assert.equal(creditLimit(kim(), r, 0), 19);
  assert.equal(creditLimit(kim({ prevGpa: 3.75 }), r, 0), 22);
  assert.equal(creditLimit(kim({ prevGpa: 3.75 }), r, 1), 19);
  assert.equal(creditLimit(kim({ warningTwice: true, prevGpa: 4 }), r, 0), 14);
});

t('김국민 기본 로드맵: 규칙 위반 없음, 총학점 136 채움', () => {
  const { roadmap, unplaced, shortfall } = buildDefaultRoadmap(kim(), data);
  assert.deepEqual(validateRoadmap(roadmap, kim(), data), []);
  assert.deepEqual(unplaced, []);
  assert.equal(shortfall, 0);
  assert.deepEqual(roadmap.terms.map((x) => x.term), ['2027-1', '2027-2']);
  assert.ok(names(roadmap.terms[0]).includes('컴퓨터네트워크') && names(roadmap.terms[0]).includes('다학제간캡스톤디자인'), '1학기에만 열리는 필수과목');
  assert.ok(!roadmap.terms.some((x) => names(x).includes('사제동행세미나')), 'S-TEAM을 들었으니 택1 그룹 제외');
  assert.ok(roadmap.terms.some((x) => names(x).includes('핵심교양 창의')), '비어 있는 핵심교양 영역');
  const credits = (term) => term.items.reduce((s, i) => s + (i.credits ?? findCourse(data, i).credits), 0);
  assert.equal(roadmap.terms.reduce((s, x) => s + credits(x), 0), 36);
});
t('기본 로드맵은 이미 들은 과목을 넣지 않는다', () => {
  const { roadmap } = buildDefaultRoadmap(kim(), data);
  const all = roadmap.terms.flatMap(names);
  for (const done of TAKEN) {
    const course = findCourse(data, { name: done });
    if (course) assert.ok(!all.includes(course.name), done); // 교양 과목은 교육과정에 없으니 건너뜀
  }
  assert.ok(!all.includes('English Conversation') && !all.includes('College English'), '별칭으로 적힌 기초교양');
});
t('못 채우면 shortfall로 알려 준다 (남은 학기 1개, 80학점)', () => {
  const s = kim({ registeredSemesters: 7, earned: { ...kim().earned, total: 80 } });
  const { roadmap, shortfall } = buildDefaultRoadmap(s, data);
  assert.equal(roadmap.terms.length, 1);
  assert.ok(shortfall >= 56 - 19, String(shortfall));
  assert.deepEqual(validateRoadmap(roadmap, s, data), []);
});
t('놓을 수 있는 학기가 없는 필수과목은 unplaced (남은 학기가 2학기뿐일 때 1학기 전용 과목)', () => {
  const s = kim({ nextTerm: '2027-2', registeredSemesters: 7 });
  const { unplaced } = buildDefaultRoadmap(s, data);
  assert.ok(unplaced.some((u) => u.name === '컴퓨터네트워크'));
  assert.ok(unplaced.some((u) => u.name === '다학제간캡스톤디자인'));
});
t('22학점 첫 학기: 직전 평점 3.75 이상이면 19학점 초과 계획이 통과', () => {
  const road = { terms: [{ term: '2027-1', items: ['컴퓨터네트워크', '다학제간캡스톤디자인', '소프트웨어공학', '웹서버컴퓨팅', '객체지향분석및설계', '네트워크최신기술', '시스템최신기술'].map((name) => ({ name })).concat([{ slot: '일반선택', category: '일반선택', credits: 1 }]) }] };
  assert.deepEqual(rules(validateRoadmap(road, kim({ prevGpa: 3.4 }), data)), ['CREDIT_LIMIT']);
  assert.deepEqual(validateRoadmap(road, kim({ prevGpa: 3.8 }), data), []);
});

const one = (items, term = '2027-1', s = kim()) => validateRoadmap({ terms: [{ term, items }] }, s, data);
t('개설 학기 위반: 1학기 전용 과목을 2학기에', () => {
  const v = validateRoadmap({ terms: [{ term: '2027-1', items: [] }, { term: '2027-2', items: [{ name: '컴퓨터네트워크' }] }] }, kim(), data);
  assert.deepEqual(rules(v), ['OFFERED']);
});
t('수강 학년 위반, 재수강은 상한 면제', () => {
  assert.deepEqual(rules(one([{ name: '수치해석' }])), ['YEARS'], '수치해석은 2학년 과목(1학기 개설)');
  assert.deepEqual(rules(one([{ name: '수치해석' }], '2027-1', kim({ retake: [{ name: '수치해석' }] }))), []);
});
t('이미 이수한 과목과 택1 그룹', () => {
  assert.deepEqual(rules(one([{ name: '자료구조' }])), ['ALREADY_TAKEN']);
  assert.deepEqual(rules(one([{ name: '사제동행세미나' }])), ['ALREADY_TAKEN']);
});
t('로드맵 안 중복, 모르는 과목, 형식 오류', () => {
  assert.deepEqual(rules(one([{ name: '소프트웨어공학' }, { name: '소프트웨어 공학' }])), ['DUPLICATE']);
  assert.deepEqual(rules(one([{ name: '양자컴퓨팅' }])), ['UNKNOWN_COURSE']);
  assert.deepEqual(rules(validateRoadmap({}, kim(), data)), ['FORMAT']);
  assert.deepEqual(rules(one([{ slot: 'x', category: '전공선택', credits: 3 }])), ['SLOT_INVALID']);
  assert.deepEqual(rules(one([{ slot: 'x', category: '일반선택', credits: 0 }])), ['SLOT_INVALID']);
});
t('학기 수, 학기 순서', () => {
  const three = { terms: ['2027-1', '2027-2', '2028-1'].map((term) => ({ term, items: [] })) };
  assert.ok(rules(validateRoadmap(three, kim(), data)).includes('TERM_COUNT'));
  assert.ok(rules(validateRoadmap({ terms: [{ term: '2027-2', items: [] }] }, kim(), data)).includes('TERM_SEQUENCE'));
});
t('학기당 19학점 한도', () => {
  const v = one(['소프트웨어공학', '웹서버컴퓨팅', '객체지향분석및설계', '네트워크최신기술', '시스템최신기술', '컴퓨터그래픽스', '비주얼컴퓨팅최신기술'].map((name) => ({ name })));
  assert.deepEqual(rules(v), ['CREDIT_LIMIT']);
});
t('교양: 학기당 8학점, 재학 중 50학점', () => {
  const slots = (k) => Array.from({ length: k }, (_, i) => ({ slot: `핵심교양${i}`, category: '핵심교양', credits: 3 }));
  assert.deepEqual(rules(one(slots(3))), ['LIBERAL_TERM_CAP']);
  assert.deepEqual(rules(one(slots(2))), []);
  assert.deepEqual(rules(one(slots(2), '2027-1', kim({ earned: { ...kim().earned, 핵심교양: 40 } }))), ['LIBERAL_TOTAL_CAP']);
  assert.deepEqual(rules(one([{ slot: '일반선택', category: '일반선택', credits: 9 }])), [], '일반선택은 교양 상한 대상이 아님');
});

console.log(`${n}개 통과`);
