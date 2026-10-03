// 졸업요건·교육과정·학사일정·이수구분 JSON이 서로 맞는지 검사한다.
// 사용: npm run validate:data   (오류가 있으면 종료 코드 1)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function load(name) {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'));
  } catch (e) {
    err(`${name}: 읽거나 파싱할 수 없어요 (${e.message})`);
    return null;
  }
}

const categories = load('categories.json');
const req = load('requirements.json');
const cur = load('curriculum.json');
const cal = load('calendar.json');
if (!categories || !req || !cur || !cal) finish();

const catIds = new Set(categories.categories.map((c) => c.id));
const CODE = /^[0-9]{5,6}[0-9A-Z]?$|^[0-9]{6,7}[0-9A-Z]?$/;
const hasEvidence = (e) => e && typeof e.quote === 'string' && e.quote.trim() && /^https?:\/\//.test(e.url ?? '');

// ---- categories
if (new Set(categories.categories.map((c) => c.id)).size !== categories.categories.length) err('categories: id가 중복돼요');
const gradePoints = categories.grades.points;
for (const g of categories.grades.nonCounting) if (!(g in gradePoints) && !['N', 'NP', 'P'].includes(g)) warn(`categories: nonCounting 성적 ${g}이 points에 없어요`);

// ---- requirements: 근거와 합계
if (!hasEvidence(req.totalCredits.evidence)) err('requirements: totalCredits에 evidence(quote, url)가 없어요');
const mins = Object.fromEntries(req.categoryMins.map((c) => [c.category, c.min]));
for (const c of req.categoryMins) {
  if (!catIds.has(c.category)) err(`requirements: 알 수 없는 이수구분 ${c.category}`);
  if (!hasEvidence(c.evidence)) err(`requirements: ${c.category}에 evidence가 없어요`);
}
for (const s of req.subtotals) {
  const sum = s.categories.reduce((a, c) => a + (mins[c] ?? 0), 0);
  if (sum !== s.min) err(`requirements: ${s.label} 소계 ${s.min} != 하위 합 ${sum}`);
}
const subSum = req.subtotals.reduce((a, s) => a + s.min, 0) + (mins['일반선택'] ?? 0);
if (subSum !== req.totalCredits.min) err(`requirements: 총학점 ${req.totalCredits.min} != 교양+전공+일반선택 ${subSum}`);

// ---- requirements: 필수과목
const items = req.requiredCourses.items;
const groups = new Map(req.requiredCourses.oneOfGroups.map((g) => [g.id, g]));
const codes = items.map((i) => i.code);
if (new Set(codes).size !== codes.length) err('requirements: requiredCourses 코드가 중복돼요');
for (const i of items) {
  if (!CODE.test(i.code)) err(`requirements: 코드 형식이 이상해요 ${i.name} ${i.code}`);
  if (!catIds.has(i.category)) err(`requirements: ${i.name}의 이수구분 ${i.category}이 categories에 없어요`);
  if (i.oneOf && !groups.has(i.oneOf)) err(`requirements: ${i.name}의 oneOf 그룹 ${i.oneOf}이 없어요`);
}
for (const g of groups.values()) {
  for (const m of g.members) if (!codes.includes(m)) err(`requirements: oneOf 그룹 ${g.id}의 구성원 ${m}이 필수과목에 없어요`);
  if (!hasEvidence(g.evidence)) err(`requirements: oneOf 그룹 ${g.id}에 evidence가 없어요`);
}
const independent = items.filter((i) => !i.oneOf);
const requiredCount = independent.length + groups.size;
if (requiredCount !== req.requiredCourses.count) err(`requirements: 필수과목 수 ${requiredCount} != count ${req.requiredCourses.count}`);
let requiredCredits = independent.reduce((a, i) => a + i.credits, 0);
for (const g of groups.values()) {
  requiredCredits += Math.min(...g.members.map((m) => items.find((i) => i.code === m).credits));
}
if (requiredCredits !== mins['전공필수']) err(`requirements: 필수과목 학점 합 ${requiredCredits} != 전공필수 ${mins['전공필수']}`);

if (req.gpa.min == null) warn('requirements: gpa.min이 비어 있어요(졸업 최저 평점 미확인)');
else if (!hasEvidence(req.gpa.evidence)) err('requirements: gpa.min에 evidence가 없어요');
if (!hasEvidence(req.minRegisteredSemesters?.evidence)) err('requirements: minRegisteredSemesters에 evidence가 없어요');
if (!hasEvidence(req.overflowRules?.evidence)) err('requirements: overflowRules에 evidence가 없어요');
if (req.maxCreditsPerSemester.seasonalMax == null) warn('requirements: 계절학기 최대 수강학점이 비어 있어요');
if (!Array.isArray(req.manualCheck) || req.manualCheck.length === 0) err('requirements: manualCheck가 비어 있어요');
for (const m of req.manualCheck) if (!hasEvidence(m.evidence)) err(`requirements: manualCheck ${m.id}에 evidence가 없어요`);

// ---- curriculum
const names = cur.courses.map((c) => c.name);
if (new Set(names).size !== names.length) err('curriculum: 과목명이 중복돼요');
const curCodes = cur.courses.map((c) => c.code).filter(Boolean);
if (new Set(curCodes).size !== curCodes.length) err('curriculum: 코드가 중복돼요');
for (const c of cur.courses) {
  const w = `curriculum: ${c.name}`;
  if (!catIds.has(c.category)) err(`${w}의 이수구분 ${c.category}이 categories에 없어요`);
  if (!Number.isInteger(c.credits) || c.credits < 1) err(`${w}의 학점이 이상해요`);
  if (![1, 2, 3, 4].includes(c.year)) err(`${w}의 학년이 이상해요`);
  if (![1, 2, null].includes(c.semester)) err(`${w}의 학기가 이상해요`);
  if (c.code != null && !CODE.test(c.code)) err(`${w}의 코드 형식이 이상해요 ${c.code}`);
  if (c.status !== 'verified') err(`${w}의 status가 verified가 아니에요`);
  if (!['table', 'smartmentor'].includes(c.creditsSource)) err(`${w}의 creditsSource가 이상해요`);
  if (!['1', '2', 'all'].includes(c.offered)) err(`${w}의 offered가 이상해요 (${c.offered})`);
  if (!Array.isArray(c.years) || c.years.length !== 2 || c.years[0] > c.years[1] || c.years.some((y) => ![1, 2, 3, 4].includes(y))) err(`${w}의 years가 이상해요`);
}
for (const i of items) {
  const c = cur.courses.find((x) => x.code === i.code);
  if (!c) { err(`curriculum: 필수과목 ${i.name}(${i.code})이 교육과정표에 없어요`); continue; }
  for (const k of ['name', 'credits', 'year', 'semester']) {
    if (c[k] !== i[k]) err(`curriculum: 필수과목 ${i.name}의 ${k}가 requirements와 달라요 (${c[k]} vs ${i[k]})`);
  }
  if (!c.required) err(`curriculum: ${i.name}에 required:true가 없어요`);
}
for (const c of cur.courses.filter((x) => x.required && x.category === '전공필수')) {
  if (!items.some((i) => i.code === c.code)) err(`curriculum: ${c.name}은 required인데 requirements에 없어요`);
}
// 필수과목의 졸업요건표 학기와 개설 학기가 어긋나면 알린다(오류는 아님: 현재 개설은 다를 수 있다)
for (const i of items) {
  const c = cur.courses.find((x) => x.code === i.code);
  if (c && c.offered !== 'all' && c.offered !== String(i.semester)) warn(`curriculum: 필수과목 ${c.name}은 졸업요건표 ${i.semester}학기인데 개설은 ${c.offered}학기예요`);
}
const noCode = cur.courses.filter((c) => c.code == null);
warn(`curriculum: 전체 ${cur.courses.length}개, 학수번호를 모르는 과목 ${noCode.length}개`);

// ---- calendar
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => ISO.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const triggers = new Set(Object.keys(cal.triggers));
const ids = cal.events.map((e) => e.id);
if (new Set(ids).size !== ids.length) err('calendar: id가 중복돼요');
for (const e of cal.events) {
  const w = `calendar: ${e.id}`;
  if (!e.title?.trim()) err(`${w}에 title이 없어요`);
  if (!validDate(e.start) || !validDate(e.end)) err(`${w}의 날짜 형식이 이상해요 (${e.start} ~ ${e.end})`);
  else if (e.start > e.end) err(`${w}의 시작일이 종료일보다 늦어요`);
  if (!triggers.has(e.trigger)) err(`${w}의 trigger ${e.trigger}가 triggers에 없어요`);
  if (!e.reason?.trim()) err(`${w}에 reason이 없어요`);
}
const shown = cal.events.filter((e) => e.trigger !== 'none');
if (shown.length === 0) err('calendar: 표시할 일정이 하나도 없어요');
const today = new Date().toISOString().slice(0, 10);
const upcoming = shown.filter((e) => e.end >= today);
if (upcoming.length === 0) warn(`calendar: 오늘(${today}) 이후에 끝나는 표시 일정이 없어요. FR-04 화면이 비어요`);
for (const t of ['hasCreditShortage', 'hasNextSemesterCourses', 'always']) {
  if (!upcoming.some((e) => e.trigger === t)) warn(`calendar: 오늘 이후 ${t} 일정이 없어요`);
}

finish();

function finish() {
  for (const w of warnings) console.log(`⚠️  ${w}`);
  for (const e of errors) console.log(`❌ ${e}`);
  if (errors.length) {
    console.log(`\n오류 ${errors.length}개`);
    process.exit(1);
  }
  console.log(`✅ 데이터 검증 통과 (경고 ${warnings.length}개)`);
}
