// FR-03 로드맵 검증·기본 로드맵(lib/roadmap.mjs) 검사. 사용: npm run test:roadmap
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeName, findCourse, remainingTerms, termPlan, creditLimit, validateRoadmap, buildDefaultRoadmap, planRoadmap, describeRoadmapTask, loadData } from '../lib/roadmap.mjs';

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

// ---- 학기 학점 합계와 추천 이유 (PRD FR-03 완료 기준)
const creditsOf = (term) => term.items.reduce((s, i) => s + (i.credits ?? findCourse(data, i).credits), 0);
t('기본 로드맵: 학기마다 학점 합계와 추천 이유가 있다', () => {
  const r = buildDefaultRoadmap(kim(), data);
  for (const term of r.roadmap.terms) {
    assert.equal(term.credits, creditsOf(term), term.term);
    assert.ok(typeof term.why === 'string' && term.why.length > 5, term.term);
  }
  assert.equal(r.projectedTotal, 136);
});
t('추천 이유: 재수강·1학기 전용 필수과목·교양 슬롯·마지막 학기 문장', () => {
  const [first, last] = buildDefaultRoadmap(kim(), data).roadmap.terms;
  assert.match(first.why, /재수강: 컴퓨터네트워크/);
  assert.match(first.why, /필수 과목: 다학제간캡스톤디자인/);
  assert.match(first.why, /1학기에만 열리는 과목\(컴퓨터네트워크, 다학제간캡스톤디자인\)/);
  assert.match(last.why, /핵심교양 창의 3학점은 과목을 직접 골라 주세요/);
  assert.match(last.why, /이 학기까지 마치면 총 136학점이 돼요/);
  assert.doesNotMatch(first.why, /총 136학점/, '마지막 학기에만 붙는다');
});
t('과목 항목에 kind가 붙는다: 재수강과 필수', () => {
  const first = buildDefaultRoadmap(kim(), data).roadmap.terms[0];
  const kind = (name) => first.items.find((i) => i.name === name)?.kind;
  assert.equal(kind('컴퓨터네트워크'), 'retake');
  assert.equal(kind('다학제간캡스톤디자인'), 'required');
});
t('못 채우면 추천 이유가 모자란 학점을 알려 준다', () => {
  const s = kim({ registeredSemesters: 7, earned: { ...kim().earned, total: 80 } });
  const { roadmap, shortfall } = buildDefaultRoadmap(s, data);
  assert.match(roadmap.terms[0].why, new RegExp(`졸업까지 ${shortfall}학점이 모자라요`));
});

// ---- AI 계획 -> 코드 검증 -> 기본 로드맵 (PRD §8)
// 목업의 계획(김국민 2027-1, 2027-2)과 같은 내용의 AI 응답
const aiPlan = () => ({
  terms: [
    { term: '2027-1', why: '컴퓨터네트워크와 캡스톤은 1학기에만 열려요.', credits: 99, items: ['컴퓨터네트워크', '다학제간캡스톤디자인', '소프트웨어공학', '웹서버컴퓨팅', '소프트웨어의실제', 'SW기술영어Ⅲ', '산업체특강']
      .map((name) => ({ name })).concat([{ slot: '핵심교양 창의', category: '핵심교양', credits: 3 }]) },
    { term: '2027-2', items: ['소프트웨어아키텍처', '정보보호와시스템보안', '소프트웨어융합최신기술', '학부연구참여(UROP)Ⅱ'].map((name) => ({ name }))
      .concat([{ slot: '일반선택', category: '일반선택', credits: 3 }, { slot: '일반선택', category: '일반선택', credits: 3 }]) },
  ],
});
const plan = (askAi, over = {}, extra = {}) => planRoadmap({ student: kim(over), data, askAi, ...extra });

await (async () => {
  const r = await plan(async () => aiPlan());
  t('AI 계획이 규칙을 지키면 그대로 쓴다 (학점 합계는 코드가 다시 계산)', () => {
    assert.equal(r.source, 'ai');
    assert.deepEqual(r.roadmap.terms.map((x) => x.credits), [19, 17]);
    assert.equal(r.projectedTotal, 136);
    assert.equal(r.shortfall, 0);
    assert.equal(r.fallbackReason, undefined);
  });
  t('AI가 쓴 추천 이유는 쓰고, 비어 있으면 코드가 만든 문장으로 채운다', () => {
    assert.equal(r.roadmap.terms[0].why, '컴퓨터네트워크와 캡스톤은 1학기에만 열려요.');
    assert.match(r.roadmap.terms[1].why, /이 학기까지 마치면 총 136학점이 돼요/);
  });
  t('AI 응답 항목은 교육과정 이름으로 정리되고 kind가 붙는다', () => {
    const items = r.roadmap.terms[0].items;
    assert.equal(items.find((i) => i.name === 'SW기술영어Ⅲ')?.name, 'SW기술영어Ⅲ');
    assert.equal(items.find((i) => i.name === '컴퓨터네트워크').kind, 'retake');
    assert.equal(items.find((i) => i.name === '다학제간캡스톤디자인').kind, 'required');
  });

  const alias = await plan(async () => ({ terms: [{ term: '2027-1', items: [{ name: 'SW 기술영어 Ⅲ' }] }] }));
  t('AI가 표기를 다르게 써도 같은 과목으로 알아본다 (다만 학점이 모자라면 기본 로드맵)', () => {
    assert.equal(alias.source, 'default');
    assert.equal(alias.fallbackReason, 'shortfall');
  });

  const bad = await plan(async () => ({ terms: [{ term: '2027-1', items: [{ name: '자료구조' }, { name: '컴퓨터네트워크' }] }, { term: '2027-2', items: [{ name: '컴퓨터네트워크' }] }] }));
  t('AI 계획이 규칙을 어기면 기본 로드맵으로 바꾸고 이유를 알려 준다', () => {
    assert.equal(bad.source, 'default');
    assert.equal(bad.fallbackReason, 'invalid');
    assert.deepEqual(rules(bad.aiViolations).sort(), ['ALREADY_TAKEN', 'DUPLICATE', 'OFFERED']);
    assert.deepEqual(validateRoadmap(bad.roadmap, kim(), data), []);
    assert.equal(bad.roadmap.terms.length, 2);
  });

  const boom = await plan(async () => { throw new Error('503'); });
  const syncBoom = await plan(() => { throw new Error('동기 예외'); });
  t('AI 호출이 실패하면 기본 로드맵 (비동기·동기 예외 모두)', () => {
    for (const x of [boom, syncBoom]) { assert.equal(x.source, 'default'); assert.equal(x.fallbackReason, 'ai-error'); assert.ok(x.aiError); }
    assert.equal(boom.aiError, '503');
  });

  const slow = await plan(() => new Promise((res) => setTimeout(() => res(aiPlan()), 200)), {}, { timeoutMs: 20 });
  t('AI 응답이 시간 안에 안 오면 기본 로드맵', () => {
    assert.equal(slow.source, 'default');
    assert.equal(slow.fallbackReason, 'ai-error');
    assert.match(slow.aiError, /20ms/);
  });

  const junk = await Promise.all([null, 'text', {}, { terms: 'x' }].map((v) => plan(async () => v)));
  t('AI가 이상한 값을 주면 기본 로드맵', () => {
    for (const x of junk) { assert.equal(x.source, 'default'); assert.equal(x.fallbackReason, 'invalid'); }
  });

  const none = await plan(undefined);
  t('askAi가 없으면 기본 로드맵 (Gemini 키가 없는 환경)', () => {
    assert.equal(none.source, 'default');
    assert.equal(none.fallbackReason, 'no-ai');
    assert.deepEqual(none.roadmap, buildDefaultRoadmap(kim(), data).roadmap);
  });

  const lazy = await plan(async () => ({ terms: [{ term: '2027-1', items: [{ name: '컴퓨터네트워크' }, { name: '다학제간캡스톤디자인' }] }] }));
  t('규칙은 지켰지만 기본 로드맵보다 졸업 학점을 덜 채우면 기본 로드맵 (SHORTFALL)', () => {
    assert.equal(lazy.source, 'default');
    assert.equal(lazy.fallbackReason, 'shortfall');
    assert.deepEqual(rules(lazy.aiViolations), ['SHORTFALL']);
  });

  const tight = { registeredSemesters: 7, earned: { ...kim().earned, total: 80 } };
  const full = await plan(async () => ({ terms: [{ term: '2027-1', items: ['컴퓨터네트워크', '다학제간캡스톤디자인', '소프트웨어공학', '웹서버컴퓨팅', '객체지향분석및설계', '소프트웨어의실제', '산업체특강', 'SW기술영어Ⅲ'].map((name) => ({ name })) }] }), tight);
  t('학점을 못 채우는 학생이라도 AI 계획이 기본 로드맵만큼 채우면 AI 계획을 쓴다', () => {
    assert.equal(buildDefaultRoadmap(kim(tight), data).shortfall, 37);
    assert.equal(full.source, 'ai');
    assert.equal(full.shortfall, 37);
    assert.match(full.roadmap.terms[0].why, /졸업까지 37학점이 모자라요/);
  });

  const nulls = await plan(async () => {
    const p = aiPlan();
    // Gemini 구조화 출력은 선택 필드를 null이나 빈 문자열로 채워 보내기도 한다.
    p.terms.forEach((x) => { x.items = x.items.map((i) => (i.slot ? { name: null, ...i, code: '' } : { slot: null, category: null, credits: null, ...i })); });
    return p;
  });
  t('AI가 빈 칸을 null·빈 문자열로 채워 보내도 정리해서 쓴다', () => {
    assert.equal(nulls.source, 'ai');
    assert.deepEqual(nulls.roadmap.terms.map((x) => x.credits), [19, 17]);
  });
  const odd = await Promise.all([{ terms: [null] }, { terms: [{ term: '2027-1', items: [null, 3] }] }, { terms: [{ term: '2027-1', items: 'x' }] }]
    .map((v) => plan(async () => v)));
  t('학기·항목이 객체가 아니면 예외 없이 기본 로드맵', () => {
    for (const x of odd) { assert.equal(x.source, 'default'); assert.equal(x.fallbackReason, 'invalid'); assert.ok(rules(x.aiViolations).includes('FORMAT')); }
  });
  let seen;
  await plan(async (arg) => { seen = arg; return aiPlan(); });
  t('askAi는 학기 목록과 AI 입력(task)을 받는다', () => {
    assert.deepEqual(seen.terms.map((x) => x.term), ['2027-1', '2027-2']);
    assert.deepEqual(seen.task, describeRoadmapTask(kim(), data));
  });
})();

const task = describeRoadmapTask(kim(), data);
t('AI 입력: 남은 학기, 채울 학점, 학기별 가능 후보', () => {
  assert.deepEqual(task.terms, [{ term: '2027-1', grade: 4, creditLimit: 19 }, { term: '2027-2', grade: 4, creditLimit: 19 }]);
  assert.deepEqual(task.needs, { totalCredits: 36, majorElectiveCredits: 0, coreLiberalCredits: 3, freeLiberalCredits: 0, missingCoreAreas: ['창의'] });
  assert.deepEqual(task.liberalArts, { perTermMax: 8, totalMax: 50, earned: 21 });
  const by = (name) => task.candidates.find((c) => c.name === name);
  assert.deepEqual(by('컴퓨터네트워크'), { name: '컴퓨터네트워크', credits: 3, required: true, retake: true, eligibleTerms: ['2027-1'] });
  assert.deepEqual(by('컴퓨터구조'), undefined, '이미 들은 과목은 후보가 아니다');
  assert.equal(by('사제동행세미나'), undefined, 'S-TEAM을 들었으니 택1 그룹은 제외');
  assert.deepEqual(by('소프트웨어아키텍처').eligibleTerms, ['2027-2'], '2학기에만 열려요');
  assert.equal(by('수치해석'), undefined, '2학년 과목이라 4학년 후보가 아니다');
  assert.ok(!task.candidates.some((c) => c.name.startsWith('실전프로젝트')), '조건부 과목은 제외');
  assert.ok(task.candidates.every((c) => c.eligibleTerms.length > 0));
});

console.log(`${n}개 통과`);
