// FR-03 로드맵 검증, 기본 로드맵, 그리고 AI 계획을 검증해 쓰는 planRoadmap.
// 이 파일은 Gemini를 직접 부르지 않는다. AI 호출은 planRoadmap에 함수(askAi)로 받는다.
// 규칙의 근거는 docs/DATA.md의 "로드맵" 절과 requirements.json이다.
//
// 학생(student):
//   nextTerm            '2027-1'  로드맵이 시작하는 학기
//   registeredSemesters 6         nextTerm 이전에 등록한 학기 수(수강 중인 학기 포함, 휴학 제외)
//   taken               [{name, code?}]  이미 이수했거나 수강 중인 과목. F·N은 넣지 않는다
//   retake              [{name, code?}]  F 등으로 다시 들어야 하는 과목(수강 학년 상한을 적용하지 않는다)
//   earned              {기초교양, 핵심교양, 자유교양, 전공필수, 전공선택, 일반선택, total}  이수 학점(수강 중 포함)
//   prevGpa             3.8       직전 학기 평점(첫 학기 한도 22 판단용). 모르면 생략
//   warningTwice        false     성적경고 연속 2회
//   missingCoreAreas    ['창의']  비어 있는 핵심교양 영역(기본 로드맵의 슬롯 이름용). 생략 가능
//
// 로드맵(roadmap): { terms: [{ term: '2027-1', items: [...], why?: '추천 이유' }] }
//   과목 항목  { name, code? }  학점은 curriculum.json 값을 쓴다
//   슬롯 항목  { slot, category: '핵심교양'|'자유교양'|'일반선택', credits }  과목 목록이 없는 칸
// 마무리한 로드맵(finalizeRoadmap, buildDefaultRoadmap, planRoadmap의 결과)은 학기마다
//   credits(학점 합계, 코드가 계산)와 why(추천 이유)가 있고, 과목 항목에 kind('required'|'retake')가 붙는다.

const ROMAN = { 'Ⅰ': 'i', 'Ⅱ': 'ii', 'Ⅲ': 'iii', 'Ⅳ': 'iv', 'Ⅴ': 'v' };
const SLOT_CATEGORIES = ['핵심교양', '자유교양', '일반선택'];

// 과목명 비교용 정규화: (공학인증)·(ABEEK) 제거, 공백 제거, 로마숫자 통일, 소문자.
export function normalizeName(s) {
  return String(s ?? '')
    .replace(/\((공학인증|ABEEK)\)/gi, '')
    .replace(/[ⅠⅡⅢⅣⅤ]/g, (ch) => ROMAN[ch])
    .replace(/\s+/g, '')
    .toLowerCase();
}

const prefix = (code, n) => (code ? String(code).slice(0, n) : null);

// 교육과정에서 과목을 찾는다. 코드 앞 5자리가 같으면 같은 과목, 코드가 없으면 과목명·별칭으로 비교한다.
export function findCourse(data, { name, code } = {}) {
  const n = data.requirements.requiredCourses.codeMatchPrefixLength ?? 5;
  if (code) {
    const hit = data.curriculum.courses.find((c) => c.code && prefix(c.code, n) === prefix(code, n));
    if (hit) return hit;
  }
  const key = normalizeName(name);
  if (!key) return null;
  return data.curriculum.courses.find((c) => nameKeys(data, c).has(key)) ?? null;
}

// 과목 하나가 가질 수 있는 정규화된 이름 모음: curriculum의 name·aliases + requirements(필수·기초교양)에 적힌 별칭.
const keyCache = new WeakMap();
function nameKeys(data, course) {
  let byCourse = keyCache.get(data);
  if (!byCourse) keyCache.set(data, (byCourse = new Map()));
  if (!byCourse.has(course)) {
    const extra = [...data.requirements.requiredCourses.items, ...data.requirements.foundationLiberalArts.items]
      .filter((x) => normalizeName(x.name) === normalizeName(course.name))
      .flatMap((x) => x.aliases ?? []);
    byCourse.set(course, new Set([course.name, ...(course.aliases ?? []), ...extra].map(normalizeName)));
  }
  return byCourse.get(course);
}

const parseTerm = (t) => {
  const m = /^(\d{4})-([12])$/.exec(t ?? '');
  return m ? { year: +m[1], semester: +m[2] } : null;
};
const nextTermOf = ({ year, semester }) => (semester === 1 ? { year, semester: 2 } : { year: year + 1, semester: 1 });
const fmt = ({ year, semester }) => `${year}-${semester}`;

// 남은 정규 학기 = 8 − 등록 학기. 휴학은 등록 학기가 아니므로 registeredSemesters에 들어 있지 않다.
export function remainingTerms(student, requirements) {
  return Math.max(0, requirements.minRegisteredSemesters.min - student.registeredSemesters);
}

// 로드맵의 i번째(0부터) 학기 목록: [{ term, semester, grade }]
export function termPlan(student, requirements) {
  const out = [];
  let t = parseTerm(student.nextTerm);
  for (let i = 0; i < remainingTerms(student, requirements); i++) {
    out.push({ term: fmt(t), semester: t.semester, grade: Math.ceil((student.registeredSemesters + i + 1) / 2) });
    t = nextTermOf(t);
  }
  return out;
}

// 학기 수강학점 한도. 22학점(초과 신청)은 직전 학기 평점을 아는 첫 학기에만 적용한다.
export function creditLimit(student, requirements, index) {
  const m = requirements.maxCreditsPerSemester;
  if (student.warningTwice) return m.restricted.max;
  if (index === 0 && student.prevGpa >= m.bonus.ifPreviousGpaAtLeast) return m.bonus.max;
  return m.base;
}

// 교육과정 과목이 해당 학기에 들을 수 있는지. 반환값은 막는 이유(rule) 또는 null.
function blocker(course, tp, retaking) {
  if (course.offered !== 'all' && course.offered !== String(tp.semester)) return 'OFFERED';
  const [min, max] = course.years;
  const waived = retaking || course.required; // 재수강·필수는 학년 상한을 풀어 준다
  if (tp.grade < min || (!waived && tp.grade > max)) return 'YEARS';
  return null;
}

function takenSets(student, data) {
  const courses = new Set();
  const groups = new Set();
  for (const t of student.taken ?? []) {
    const c = findCourse(data, t);
    if (!c) continue;
    courses.add(c);
    if (c.oneOf) groups.add(c.oneOf);
  }
  const retake = new Set((student.retake ?? []).map((t) => findCourse(data, t)).filter(Boolean));
  return { courses, groups, retake };
}

// 규칙 위반 목록을 돌려준다. 비어 있으면 통과다. 위반: { rule, term, item, message }
export function validateRoadmap(roadmap, student, data) {
  const { requirements } = data;
  const cap = requirements.liberalArtsCap;
  const plan = termPlan(student, requirements);
  const taken = takenSets(student, data);
  const out = [];
  const bad = (rule, term, item, message) => out.push({ rule, term, item, message });

  const terms = roadmap?.terms;
  if (!Array.isArray(terms)) return [{ rule: 'FORMAT', term: null, item: null, message: '로드맵 형식이 올바르지 않아요.' }];
  if (terms.length > plan.length) {
    bad('TERM_COUNT', null, null, `남은 정규 학기는 ${plan.length}개인데 ${terms.length}개 학기를 계획했어요.`);
  }

  const seen = new Set();
  const seenGroups = new Set();
  let liberal = (student.earned?.기초교양 ?? 0) + (student.earned?.핵심교양 ?? 0) + (student.earned?.자유교양 ?? 0);

  terms.forEach((t, i) => {
    if (!t || typeof t !== 'object' || !Array.isArray(t.items)) {
      bad('FORMAT', t?.term ?? null, null, `${i + 1}번째 학기의 형식이 올바르지 않아요.`);
      return;
    }
    const tp = plan[i];
    if (!tp || t.term !== tp.term) {
      bad('TERM_SEQUENCE', t.term, null, `${i + 1}번째 학기는 ${tp ? tp.term : '(없음)'}이어야 해요.`);
    }
    const ref = tp ?? { semester: parseTerm(t.term)?.semester, grade: Infinity };
    let total = 0;
    let coreFree = 0; // 핵심교양+자유교양 (학기당 8학점 상한)

    for (const item of t.items) {
      if (!item || typeof item !== 'object') {
        bad('FORMAT', t.term, null, '과목 항목의 형식이 올바르지 않아요.');
        continue;
      }
      if (item.slot !== undefined) {
        if (!SLOT_CATEGORIES.includes(item.category) || !Number.isInteger(item.credits) || item.credits <= 0) {
          bad('SLOT_INVALID', t.term, item.slot, `슬롯 '${item.slot}'의 이수구분이나 학점이 올바르지 않아요.`);
          continue;
        }
        total += item.credits;
        if (item.category !== '일반선택') { coreFree += item.credits; liberal += item.credits; }
        continue;
      }
      const course = findCourse(data, item);
      if (!course) {
        bad('UNKNOWN_COURSE', t.term, item.name, `교육과정에 없는 과목이에요: ${item.name}`);
        continue;
      }
      total += course.credits;
      if (course.category === '기초교양') liberal += course.credits;
      if (taken.courses.has(course) || (course.oneOf && taken.groups.has(course.oneOf))) {
        bad('ALREADY_TAKEN', t.term, course.name, `이미 이수한 과목이에요: ${course.name}`);
      }
      if (seen.has(course) || (course.oneOf && seenGroups.has(course.oneOf))) {
        bad('DUPLICATE', t.term, course.name, `로드맵에 중복된 과목이에요: ${course.name}`);
      }
      seen.add(course);
      if (course.oneOf) seenGroups.add(course.oneOf);
      const why = blocker(course, ref, taken.retake.has(course));
      if (why === 'OFFERED') bad('OFFERED', t.term, course.name, `${course.name}은 ${course.offered}학기에만 열려요. ${t.term}에는 들을 수 없어요.`);
      if (why === 'YEARS') bad('YEARS', t.term, course.name, `${course.name}은 ${course.years[0]}~${course.years[1]}학년 과목이라 ${ref.grade}학년 학기에는 들을 수 없어요.`);
    }

    const limit = creditLimit(student, requirements, i);
    if (total > limit) bad('CREDIT_LIMIT', t.term, null, `${t.term}은 ${total}학점이에요. 한도는 ${limit}학점이에요.`);
    if (coreFree > cap.perSemesterMax) {
      bad('LIBERAL_TERM_CAP', t.term, null, `${t.term}의 핵심·자유교양이 ${coreFree}학점이에요. 학기당 ${cap.perSemesterMax}학점까지예요.`);
    }
  });

  if (liberal > cap.max) bad('LIBERAL_TOTAL_CAP', null, null, `교양이 ${liberal}학점이 돼요. ${cap.max}학점을 넘는 분은 졸업학점에 들어가지 않아요.`);
  return out;
}

// AI가 실패했을 때 쓰는 기본 로드맵.
// 1) 빠진 필수과목 2) 부족한 전공선택, 핵심·자유교양 슬롯 3) 총학점 136까지 전공선택 과목과 일반선택 슬롯으로 채운다.
// 항목은 그때그때 학점 합이 가장 적은 학기에 놓아서 학기 부담을 고르게 나눈다.
// 반환: { roadmap, unplaced: [{ name|slot, reason }], shortfall, projectedTotal }  shortfall은 못 채운 총학점이다.
// 학기마다 credits(학점 합계)와 why(추천 이유)가 들어 있다.
export function buildDefaultRoadmap(student, data) {
  const { requirements, curriculum } = data;
  const plan = termPlan(student, requirements);
  const taken = takenSets(student, data);
  const rows = plan.map((tp, i) => ({ tp, limit: creditLimit(student, requirements, i), load: 0, coreFree: 0, items: [] }));
  const unplaced = [];
  const used = new Set();
  const earned = student.earned ?? {};
  const perTermCap = requirements.liberalArtsCap.perSemesterMax;

  const fits = (row, course) => !blocker(course, row.tp, taken.retake.has(course)) && row.load + course.credits <= row.limit;
  const byLoad = () => [...rows].sort((a, b) => a.load - b.load);
  const put = (row, item, credits) => { row.items.push(item); row.load += credits; };
  const putCourse = (row, course) => { put(row, { name: course.name, ...(course.code ? { code: course.code } : {}) }, course.credits); used.add(course); if (course.oneOf) used.add(course.oneOf); };
  const isUsed = (c) => used.has(c) || (c.oneOf && used.has(c.oneOf));
  const free = (c) => !taken.courses.has(c) && !(c.oneOf && taken.groups.has(c.oneOf)) && !isUsed(c);

  // 1) 빠진 필수과목. 택1 그룹은 놓을 수 있는 쪽 하나만 넣는다.
  const required = curriculum.courses.filter((c) => c.required && free(c));
  for (const c of required) {
    if (!free(c)) continue; // 같은 택1 그룹의 앞 과목이 이미 들어갔다
    const row = byLoad().find((r) => fits(r, c));
    if (row) putCourse(row, c);
    else if (!c.oneOf) unplaced.push({ name: c.name, reason: '개설 학기·수강 학년·학점 한도를 모두 맞는 학기가 없어요.' });
  }
  for (const group of new Set(required.filter((c) => c.oneOf).map((c) => c.oneOf))) {
    if (!used.has(group)) unplaced.push({ name: group, reason: '택1 과목 중 놓을 수 있는 학기가 없어요.' });
  }

  // 2) 부족한 전공선택
  const major = curriculum.courses.filter((c) => c.category === '전공선택' && !c.countsTowardMajor66);
  let need = Math.max(0, requirements.categoryMins.find((m) => m.category === '전공선택').min - (earned.전공선택 ?? 0));
  const pickMajor = (room) => {
    for (const row of byLoad()) {
      const c = major.find((m) => free(m) && m.credits <= room && fits(row, m));
      if (c) return { row, c };
    }
    return null;
  };
  while (need > 0) {
    const hit = pickMajor(need);
    if (!hit) { unplaced.push({ slot: '전공선택', reason: `전공선택 ${need}학점을 놓을 학기가 없어요.` }); break; }
    putCourse(hit.row, hit.c);
    need -= hit.c.credits;
  }

  // 2') 핵심교양(영역별 3학점)과 자유교양 슬롯
  const slots = [];
  const coreNeed = Math.max(0, requirements.categoryMins.find((m) => m.category === '핵심교양').min - (earned.핵심교양 ?? 0));
  const areas = student.missingCoreAreas ?? [];
  for (let k = 0; k * 3 < coreNeed; k++) {
    slots.push({ slot: areas[k] ? `핵심교양 ${areas[k]}` : '핵심교양', category: '핵심교양', credits: Math.min(3, coreNeed - k * 3) });
  }
  const freeNeed = Math.max(0, requirements.categoryMins.find((m) => m.category === '자유교양').min - (earned.자유교양 ?? 0));
  if (freeNeed > 0) slots.push({ slot: '자유교양', category: '자유교양', credits: freeNeed });
  for (const s of slots) {
    const row = byLoad().find((r) => r.load + s.credits <= r.limit && r.coreFree + s.credits <= perTermCap);
    if (row) { put(row, s, s.credits); row.coreFree += s.credits; }
    else unplaced.push({ slot: s.slot, reason: '학점 한도 안에서 놓을 학기가 없어요.' });
  }

  // 3) 총학점 채우기: 남는 전공선택 과목 → 일반선택 슬롯
  const need136 = () => requirements.totalCredits.min - (earned.total ?? 0) - rows.reduce((s, r) => s + r.load, 0);
  const rest = curriculum.courses.filter((c) => c.category === '전공선택' && !c.countsTowardMajor66);
  while (need136() > 0) {
    const row = [...rows].sort((a, b) => (b.limit - b.load) - (a.limit - a.load))[0];
    const room = row ? row.limit - row.load : 0;
    if (room <= 0) break;
    const left = need136();
    const c = rest.find((m) => free(m) && m.credits <= left && fits(row, m));
    if (c) putCourse(row, c);
    else {
      const credits = Math.min(room, left, 3);
      put(row, { slot: '일반선택', category: '일반선택', credits }, credits);
    }
  }

  const done = finalizeRoadmap({ terms: rows.map((r) => ({ term: r.tp.term, items: r.items })) }, student, data);
  return { roadmap: done.roadmap, unplaced, shortfall: done.shortfall, projectedTotal: done.projectedTotal };
}

// 로드맵을 화면에 보여 줄 모양으로 마무리한다. 항목 이름을 교육과정 이름으로 맞추고,
// 학기 학점 합계(credits)는 항상 코드가 계산하며, 추천 이유(why)는 whys[i]가 있으면 그것을, 없으면 코드가 만든 문장을 쓴다.
// 검증을 통과한 로드맵에만 쓴다. 반환: { roadmap, projectedTotal, shortfall }
export function finalizeRoadmap(roadmap, student, data, whys = []) {
  const taken = takenSets(student, data);
  const plan = termPlan(student, data.requirements);
  const terms = roadmap.terms.map((t) => {
    const items = t.items.map((item) => {
      if (item.slot !== undefined) return { slot: item.slot, category: item.category, credits: item.credits };
      const c = findCourse(data, item);
      const kind = taken.retake.has(c) ? 'retake' : c.required ? 'required' : null;
      return { name: c.name, ...(c.code ? { code: c.code } : {}), ...(kind ? { kind } : {}) };
    });
    const credits = items.reduce((s, i) => s + (i.credits ?? findCourse(data, i).credits), 0);
    return { term: t.term, credits, items };
  });
  const projectedTotal = (student.earned?.total ?? 0) + terms.reduce((s, t) => s + t.credits, 0);
  const shortfall = Math.max(0, data.requirements.totalCredits.min - projectedTotal);
  terms.forEach((t, i) => {
    const given = typeof whys[i] === 'string' ? whys[i].trim().slice(0, 200) : '';
    t.why = given || explainTerm(t, { data, semester: plan[i]?.semester ?? parseTerm(t.term)?.semester, isLast: i === terms.length - 1, projectedTotal, shortfall });
  });
  return { roadmap: { terms }, projectedTotal, shortfall };
}

// 학기 추천 이유를 항목에서 읽어 만든 문장. 조사가 붙는 자리를 피해서 목록 형태로 쓴다.
export function explainTerm(term, { data, semester, isLast, projectedTotal, shortfall }) {
  const names = (list) => list.map((i) => i.name).join(', ');
  const courses = term.items.filter((i) => i.name !== undefined);
  const slots = term.items.filter((i) => i.slot !== undefined);
  const retake = courses.filter((i) => i.kind === 'retake');
  const required = courses.filter((i) => i.kind === 'required');
  const electives = courses.filter((i) => !i.kind);
  const onlyThisTerm = [...retake, ...required].filter((i) => findCourse(data, i).offered !== 'all');
  const parts = [];
  if (retake.length) parts.push(`재수강: ${names(retake)}.`);
  if (required.length) parts.push(`필수 과목: ${names(required)}.`);
  if (onlyThisTerm.length) parts.push(`${semester}학기에만 열리는 과목(${names(onlyThisTerm)})이라 이 학기에 넣었어요.`);
  if (electives.length) parts.push(`전공 선택 ${electives.reduce((s, i) => s + findCourse(data, i).credits, 0)}학점으로 졸업 학점을 채워요.`);
  const pick = slots.filter((s) => s.category !== '일반선택');
  if (pick.length) parts.push(`${pick.map((s) => `${s.slot} ${s.credits}학점`).join(', ')}은 과목을 직접 골라 주세요.`);
  const general = slots.filter((s) => s.category === '일반선택').reduce((sum, s) => sum + s.credits, 0);
  if (general) parts.push(`일반선택 ${general}학점은 과목을 직접 골라 주세요.`);
  if (!parts.length) parts.push('이 학기에 더 들을 과목이 없어요.');
  if (isLast) {
    parts.push(shortfall > 0
      ? `계획한 학점을 모두 들어도 졸업까지 ${shortfall}학점이 모자라요.`
      : `이 학기까지 마치면 총 ${projectedTotal}학점이 돼요.`);
  }
  return parts.join(' ');
}

// AI에게 줄 입력 JSON. 남은 학기(학년·학점 한도), 채워야 할 학점, 그리고 학기별로 들을 수 있는 후보 과목을 코드가 미리 걸러 준다.
// 이미 들은 과목, 개설 학기·수강 학년이 안 맞는 과목, 실전프로젝트(전공 66학점 조건부)는 후보에 없다.
export function describeRoadmapTask(student, data) {
  const { requirements, curriculum } = data;
  const plan = termPlan(student, requirements);
  const taken = takenSets(student, data);
  const earned = student.earned ?? {};
  const cap = requirements.liberalArtsCap;
  const min = (category) => requirements.categoryMins.find((m) => m.category === category).min;
  const short = (category) => Math.max(0, min(category) - (earned[category] ?? 0));

  const candidates = curriculum.courses
    .filter((c) => !taken.courses.has(c) && !(c.oneOf && taken.groups.has(c.oneOf)) && !c.countsTowardMajor66)
    .map((c) => ({
      name: c.name,
      credits: c.credits,
      required: !!c.required,
      ...(taken.retake.has(c) ? { retake: true } : {}),
      ...(c.oneOf ? { oneOf: c.oneOf } : {}),
      eligibleTerms: plan.filter((tp) => !blocker(c, tp, taken.retake.has(c))).map((tp) => tp.term),
    }))
    .filter((c) => c.eligibleTerms.length > 0);

  return {
    terms: plan.map((tp, i) => ({ term: tp.term, grade: tp.grade, creditLimit: creditLimit(student, requirements, i) })),
    needs: {
      totalCredits: Math.max(0, requirements.totalCredits.min - (earned.total ?? 0)),
      majorElectiveCredits: short('전공선택'),
      coreLiberalCredits: short('핵심교양'),
      freeLiberalCredits: short('자유교양'),
      ...(student.missingCoreAreas?.length ? { missingCoreAreas: student.missingCoreAreas } : {}),
    },
    liberalArts: { perTermMax: cap.perSemesterMax, totalMax: cap.max, earned: (earned.기초교양 ?? 0) + (earned.핵심교양 ?? 0) + (earned.자유교양 ?? 0) },
    candidates,
  };
}

// AI가 비워 둔 칸(null, 빈 문자열)을 지운다. 구조화 출력이 선택 필드를 null로 채워 보내는 경우가 있다.
function cleanProposal(p) {
  if (!p || !Array.isArray(p.terms)) return p;
  const clean = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== '')) : o);
  return { ...p, terms: p.terms.map((t) => (t && typeof t === 'object' ? { ...t, items: Array.isArray(t.items) ? t.items.map(clean) : t.items } : t)) };
}

const withTimeout = (promise, ms) => {
  let id;
  const timer = new Promise((_, reject) => { id = setTimeout(() => reject(new Error(`AI 응답이 ${ms}ms 안에 오지 않았어요.`)), ms); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(id));
};

// AI 계획 → 코드 검증 → 실패하면 기본 로드맵 (PRD §8). AI 호출은 askAi가 맡는다.
//   askAi({ student, data, terms, task })  task는 describeRoadmapTask의 결과(AI에게 줄 입력 JSON). 로드맵 제안 { terms: [{ term, items, why? }] }을 돌려주는 함수(Promise 가능). 생략하면 기본 로드맵만 쓴다.
//   timeoutMs                         AI 응답을 기다리는 시간. 기본 30초
// 기본 로드맵으로 바꾸는 경우: askAi가 없음, 예외, 시간 초과, 규칙 위반, 기본 로드맵보다 졸업 학점을 덜 채움.
// 반환: { source: 'ai'|'default', roadmap, projectedTotal, shortfall, unplaced, fallbackReason, aiViolations }
//   fallbackReason은 source가 default일 때만 있다(no-ai | ai-error | invalid | shortfall). AI 응답에서는 항목 이름·학점·kind·credits를
//   코드가 다시 정리하고, why는 AI가 쓴 문장을 쓰되 비어 있으면 코드가 만든 문장으로 채운다.
export async function planRoadmap({ student, data, askAi, timeoutMs = 30_000 }) {
  const fallback = buildDefaultRoadmap(student, data);
  const useDefault = (fallbackReason, extra = {}) => ({ source: 'default', ...fallback, fallbackReason, aiViolations: [], ...extra });
  if (typeof askAi !== 'function') return useDefault('no-ai');

  let proposal;
  try {
    const task = describeRoadmapTask(student, data);
    proposal = cleanProposal(await withTimeout(Promise.resolve().then(() => askAi({ student, data, terms: task.terms, task })), timeoutMs));
  } catch (err) {
    return useDefault('ai-error', { aiError: String(err?.message ?? err) });
  }

  const aiViolations = validateRoadmap(proposal, student, data);
  if (aiViolations.length) return useDefault('invalid', { aiViolations });

  const done = finalizeRoadmap(proposal, student, data, proposal.terms.map((t) => t?.why));
  if (done.shortfall > fallback.shortfall) {
    const message = `AI 계획은 졸업까지 ${done.shortfall}학점이 모자란데 기본 로드맵은 ${fallback.shortfall}학점만 모자라요.`;
    return useDefault('shortfall', { aiViolations: [{ rule: 'SHORTFALL', term: null, item: null, message }] });
  }
  return { source: 'ai', ...done, unplaced: [], aiViolations: [] };
}

// 서버에서 쓰기 편하도록 JSON 두 개를 읽는다. 경로는 app/public/data 기준이다.
export async function loadData(dir) {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const read = async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'));
  return { requirements: await read('requirements.json'), curriculum: await read('curriculum.json') };
}
