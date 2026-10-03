// 졸업각 판정 엔진. 서버(server.js)와 브라우저(app.js)가 같이 import한다. 순수 함수만 둔다.
// data = { req, cur, cats, cal, areas } = requirements / curriculum / categories / calendar / core_areas JSON
// 과목 한 행: { term:'2023-1', code, name, credits, category, grade, area, areaGuess, generic? }
// ctx = { ordinal: 지금이 몇 번째 등록 학기인지(지금 학기 포함), termNow: '2026-2' }

export const AREAS = ['인문Ⅰ', '인문Ⅱ', '소통', '창의', '글로벌'];
export const CATEGORIES = ['기초교양', '핵심교양', '자유교양', '전공선택', '일반선택'];
const LIBERAL = ['기초교양', '핵심교양', '자유교양'];
const GENERIC_OK = ['핵심교양', '자유교양', '일반선택'];
const SEMINAR_CAP = 4;
export const GRADES = ['A+', 'A0', 'B+', 'B0', 'C+', 'C0', 'D+', 'D0', 'F', 'P', 'N'];
const ROMAN = { 'Ⅰ': 'i', 'Ⅱ': 'ii', 'Ⅲ': 'iii', 'Ⅳ': 'iv', 'Ⅴ': 'v' };

// ---------- 표기 정규화 ----------

// 과목명 비교 키: 로마숫자 통일, 꼬리표와 문장부호·공백 제거.
export const nameKey = (s) => String(s ?? '')
  .replace(/[ⅠⅡⅢⅣⅤ]/g, (m) => ROMAN[m])
  .toLowerCase()
  .replace(/\((공학인증|abeek)\)|\[r\]/g, '')
  .replace(/[^0-9a-z가-힣]/g, '');

const code5 = (c) => {
  const s = String(c ?? '').replace(/\s/g, '').toUpperCase();
  return s.length >= 5 ? s.slice(0, 5) : null;
};

// 받침 유무로 조사를 고른다. 한글이 아니면 끝 글자 발음으로 어림한다.
export function josa(word, pair) {
  const [withB, without] = pair.split('/');
  const ch = String(word).trim().slice(-1);
  const c = ch.charCodeAt(0) - 0xac00;
  const batchim = c >= 0 && c <= 11171 ? c % 28 !== 0 : /[013678ⅠⅢlmn]$/i.test(ch);
  return word + (batchim ? withB : without);
}

// ---------- 학기 ----------

const SEM_ORDER = { 1: 0, 여름: 1, 2: 2, 겨울: 3 };
export const termIdx = (t) => { const [y, s] = String(t).split('-'); return +y * 4 + (SEM_ORDER[s] ?? 0); };
export const isRegular = (t) => /^\d{4}-[12]$/.test(t);
export function termNow(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1;
  if (m >= 3 && m <= 8) return `${y}-1`;
  return m >= 9 ? `${y}-2` : `${y - 1}-2`;
}
export function nextTerm(t) {
  const [y, s] = String(t).split('-');
  return s === '1' || s === '여름' ? `${y}-2` : `${+y + 1}-1`;
}
export const termSem = (t) => String(t).split('-')[1];
export function termLabel(ordinal) {
  if (ordinal > 8) return `${ordinal}번째 학기`;
  return `${Math.ceil(ordinal / 2)}학년 ${ordinal % 2 ? 1 : 2}학기`;
}
export function gradDate(lastTerm) {
  const [y, s] = String(lastTerm).split('-');
  return s === '1' ? `${y}년 8월` : `${+y + 1}년 2월`;
}
const termText = (t) => `${t}학기`;

// ---------- 등급 ----------

// kind: graded(평점 반영·학점 인정) | pass(P) | fail(F, N) | prog(수강 중) | void(재수강 전·성적포기) | unknown
export function gradeInfo(raw, cats) {
  const g0 = String(raw ?? '').trim().toUpperCase().replace(/\s/g, '');
  if (g0.includes('[R]') || g0 === 'R' || g0 === 'W') return { kind: 'void' };
  if (cats.grades.inProgress.map((x) => x.toUpperCase()).includes(g0) || g0 === '수강중') return { kind: 'prog' };
  const g = cats.grades.aliases[g0] ?? g0;
  if (g === 'P') return { kind: 'pass', g };
  if (g === 'N') return { kind: 'fail', g, noGpa: true };
  if (g in cats.grades.points) return { kind: g === 'F' ? 'fail' : 'graded', g, pts: cats.grades.points[g] };
  return { kind: 'unknown', g };
}

// ---------- 카탈로그 매칭 ----------

// 요건 데이터를 한 번만 펼쳐 둔다. data 객체마다 캐시한다.
const prepared = new WeakMap();
function prep(data) {
  if (prepared.has(data)) return prepared.get(data);
  const { req, cur, cats, areas } = data;
  const matcher = (names, codes) => ({ keys: new Set(names.map(nameKey)), codes: new Set(codes.map(code5).filter(Boolean)) });
  const catalog = cur.courses.map((c) => ({ ...c, ...matcher([c.name, ...(c.aliases ?? [])], c.code ? [c.code] : []) }));
  const findCat = (name) => catalog.find((c) => c.name === name);
  // 필수 지정 과목: oneOf 그룹은 하나로 묶어 15개
  const reqGroups = [];
  for (const it of req.requiredCourses.items) {
    const m = { ...it, ...matcher([it.name, ...(it.aliases ?? [])], [it.code]), offered: findCat(it.name)?.offered ?? 'all', rec: (it.year - 1) * 2 + it.semester };
    const g = it.oneOf && reqGroups.find((x) => x.oneOf === it.oneOf);
    if (g) { g.members.push(m); g.rec = Math.max(g.rec, m.rec); } else reqGroups.push({ oneOf: it.oneOf, members: [m], rec: m.rec });
  }
  const basicGroups = req.foundationLiberalArts.items.map((it) => {
    const c = findCat(it.name);
    const m = { ...it, ...matcher([it.name, ...(it.aliases ?? [])], it.codes), offered: c?.offered ?? 'all', rec: c ? (c.year - 1) * 2 + c.semester : 1 };
    return { members: [m], rec: m.rec };
  });
  const areaMap = new Map(Object.entries(areas ?? {}).map(([k, v]) => [nameKey(k), v]));
  const catAlias = new Map();
  for (const c of cats.categories) for (const a of [c.id, ...c.aliases]) catAlias.set(a.replace(/\s/g, ''), c.id);
  const min = Object.fromEntries(req.categoryMins.map((c) => [c.category, c]));
  const p = { catalog, reqGroups, basicGroups, areaMap, catAlias, min };
  prepared.set(data, p);
  return p;
}

const matches = (m, rec) => m.keys.has(rec.key) || (rec.c5 && m.codes.has(rec.c5));

// ---------- 입력 정리 (신뢰 경계) ----------

// AI 응답이나 브라우저가 보낸 이수내역을 엔진이 믿을 수 있는 모양으로 거른다.
const POINTS_TO_GRADE = { 4.5: 'A+', 4: 'A0', 3.5: 'B+', 3: 'B0', 2.5: 'C+', 2: 'C0', 1.5: 'D+', 1: 'D0' };

export function sanitizeCourses(raw, cats) {
  if (!Array.isArray(raw)) return [];
  const catAlias = new Map();
  for (const c of cats.categories) for (const a of [c.id, ...c.aliases]) catAlias.set(a.replace(/\s/g, ''), c.id);
  const out = [];
  for (const r of raw.slice(0, 200)) {
    if (!r || typeof r !== 'object') continue;
    const name = String(r.name ?? '').trim().slice(0, 60);
    const credits = Number(r.credits);
    const term = String(r.term ?? '').trim();
    if (!name || !Number.isFinite(credits) || credits <= 0 || credits > 6) continue;
    if (!/^\d{4}-(1|2|여름|겨울)$/.test(term)) continue;
    let category = catAlias.get(String(r.category ?? '').replace(/\s/g, '')) ?? '일반선택';
    if (category === '전공필수') category = '전공선택';
    if (category === '기타') category = '일반선택';
    const code = /^[0-9A-Za-z]{5,8}$/.test(String(r.code ?? '').trim()) ? String(r.code).trim().toUpperCase() : null;
    const area = AREAS.includes(r.area) && category === '핵심교양' ? r.area : null;
    // AI가 등급 글자를 잘못 옮겼으면(예: 'B뼈') 같은 행의 평점 숫자로 되살린다. 0점은 F·P가 겹쳐 쓰지 않는다.
    let grade = String(r.grade ?? '').trim().slice(0, 6);
    if (gradeInfo(grade, cats).kind === 'unknown' && POINTS_TO_GRADE[Number(r.points)]) grade = POINTS_TO_GRADE[Number(r.points)];
    out.push({
      term, code, name, credits, category,
      grade,
      area, areaGuess: area ? r.areaGuess !== false : false,
      ...(r.generic ? { generic: true } : {}),
    });
  }
  return out;
}

// ---------- 분석 ----------

// 과목마다 유효한 기록을 고르고(재수강이면 최근 학기), 이수구분·영역·학점을 계산한다.
export function analyze(courses, ctx, data) {
  const P = prep(data);
  const { req, cats } = data;
  const recs = courses.map((c, i) => {
    const key = nameKey(c.name), c5 = code5(c.code);
    const rec = { ...c, i, key, c5, gi: gradeInfo(c.grade, cats) };
    // 이름이 맞는 쪽을 먼저 본다. S-TEAM Class(0367203)와 사제동행세미나(0367202)는 코드 앞 5자리가 같다.
    const byName = (ms) => ms.find((m) => m.keys.has(key)) ?? ms.find((m) => matches(m, rec));
    rec.cat = byName(P.catalog) ?? null;
    rec.reqGroup = P.reqGroups.find((g) => g.members.some((m) => m.keys.has(key))) ?? P.reqGroups.find((g) => g.members.some((m) => matches(m, rec))) ?? null;
    rec.basicGroup = P.basicGroups.find((g) => g.members.some((m) => matches(m, rec))) ?? null;
    // 이수구분: 목록에 있는 전공 과목은 성적표 라벨과 상관없이 전공으로 센다(docs/DATA.md).
    const listedMajor = rec.reqGroup || ['전공필수', '전공선택'].includes(rec.cat?.category);
    rec.kind = rec.basicGroup ? '기초교양' : listedMajor ? '전공' : c.category === '전공선택' ? '전공' : c.category;
    rec.labelMismatch = listedMajor && c.category !== '전공선택';
    // 같은 과목 판정용 id. 재수강하면 같은 id끼리 묶인다. 기초교양 택1은 변형(Ⅰ/Ⅱ)마다 다른 과목이다.
    // S-TEAM Class·사제동행세미나 묶음은 재수강이 아니라 여러 번 들을 수 있는 과목이라 묶지 않는다.
    const reqMember = rec.reqGroup && byName(rec.reqGroup.members);
    rec.repeatable = rec.reqGroup?.members.length > 1;
    rec.id = c.generic || rec.repeatable ? `one:${i}` : reqMember ? `req:${reqMember.name}` : rec.basicGroup ? `basic:${key}`
      : rec.cat ? `cat:${rec.cat.name}` : c5 ? `code:${c5}` : `name:${key}`;
    // 핵심교양 영역: 화면·학생이 준 값 > 요람 목록 > AI 추정
    if (rec.kind === '핵심교양') {
      const listed = P.areaMap.get(key);
      if (c.area && !c.areaGuess) { rec.areaUsed = c.area; rec.areaSrc = 'given'; }
      else if (listed) { rec.areaUsed = listed; rec.areaSrc = 'list'; }
      else if (c.area) { rec.areaUsed = c.area; rec.areaSrc = 'guess'; }
    }
    return rec;
  });

  // 같은 과목끼리 묶어 완료 기록은 최근 것 하나만, 수강 중 기록은 따로 남긴다.
  const byId = new Map();
  for (const r of recs) (byId.get(r.id) ?? byId.set(r.id, []).get(r.id)).push(r);
  const eff = [];
  for (const list of byId.values()) {
    list.sort((a, b) => termIdx(a.term) - termIdx(b.term));
    const done = list.filter((r) => ['graded', 'pass', 'fail'].includes(r.gi.kind));
    const last = done.at(-1);
    const prog = list.filter((r) => r.gi.kind === 'prog').at(-1);
    for (const r of done) if (r !== last) r.superseded = true;
    if (last) eff.push(last);
    if (prog && (!last || termIdx(prog.term) > termIdx(last.term))) { prog.retaking = !!last; eff.push(prog); }
  }
  for (const r of eff) {
    r.earned = r.gi.kind === 'graded' || r.gi.kind === 'pass';
    r.inProgress = r.gi.kind === 'prog';
  }
  // 학과 원문: "<사제동행세미나> 및 <S-TEAM Class>는 최대 4학점까지 이수 가능". 넘는 학점은 세지 않는다.
  let seminar = 0;
  for (const r of eff.filter((x) => x.repeatable && x.earned).sort((a, b) => termIdx(a.term) - termIdx(b.term))) {
    if (seminar + r.credits > SEMINAR_CAP) { r.earned = false; r.overCap = true; } else seminar += r.credits;
  }
  const unknown = recs.filter((r) => r.gi.kind === 'unknown');
  const sum = (f) => eff.filter(f).reduce((s, r) => s + r.credits, 0);
  const earnedBy = (kind) => sum((r) => r.earned && r.kind === kind);
  const progBy = (kind) => sum((r) => r.inProgress && r.kind === kind);

  // 그룹(필수 지정·기초교양 지정) 상태
  const groupState = (g) => {
    const mine = eff.filter((r) => r.reqGroup === g || r.basicGroup === g);
    if (mine.some((r) => r.earned)) return { st: 'done', recs: mine };
    if (mine.some((r) => r.inProgress)) return { st: 'prog', recs: mine };
    if (mine.some((r) => r.gi.kind === 'fail')) return { st: 'failed', recs: mine };
    return { st: g.rec < ctx.ordinal ? 'overdue' : 'missing', recs: mine };
  };
  const reqStates = P.reqGroups.map((g) => ({ g, ...groupState(g) }));
  const basicStates = P.basicGroups.map((g) => ({ g, ...groupState(g) }));

  // 학점
  const liberalEarned = LIBERAL.reduce((s, k) => s + earnedBy(k), 0);
  const cap = req.liberalArtsCap.max;
  const earnedTotal = sum((r) => r.earned);
  const counted = earnedTotal - Math.max(0, liberalEarned - cap);
  const prog = sum((r) => r.inProgress);
  const majorEarned = earnedBy('전공');
  // 필수 지정으로 인정하는 학점: 그룹마다 한 과목
  const reqCredits = reqStates.filter((s) => s.st === 'done').reduce((s, x) => s + x.recs.find((r) => r.earned).credits, 0);
  const reqProg = reqStates.filter((s) => s.st === 'prog').reduce((s, x) => s + x.recs.find((r) => r.inProgress).credits, 0);
  const areaCredits = Object.fromEntries(AREAS.map((a) => [a, 0]));
  const areaProg = Object.fromEntries(AREAS.map((a) => [a, 0]));
  let unknownArea = 0, guessed = false;
  for (const r of eff) {
    if (r.kind !== '핵심교양' || !(r.earned || r.inProgress)) continue;
    if (!r.areaUsed) { if (r.earned) unknownArea += r.credits; continue; }
    (r.earned ? areaCredits : areaProg)[r.areaUsed] += r.credits;
    if (r.areaSrc === 'guess') guessed = true;
  }
  // 평점: F 포함, P·N·수강 중 제외
  const graded = eff.filter((r) => r.gi.pts != null && !r.gi.noGpa);
  const gpaDen = graded.reduce((s, r) => s + r.credits, 0);
  const gpa = gpaDen ? Math.round((graded.reduce((s, r) => s + r.gi.pts * r.credits, 0) / gpaDen) * 100) / 100 : null;

  return {
    recs, eff, unknown, reqStates, basicStates, areaCredits, areaProg, unknownArea, guessed, gpa,
    earnedTotal, counted, prog, liberalEarned, majorEarned, reqCredits, reqProg,
    majorProg: progBy('전공'), electiveEarned: majorEarned - reqCredits, electiveProg: progBy('전공') - reqProg,
    earnedBy, progBy,
  };
}

// ---------- 진단 ----------

const STATUS_ORDER = { fail: 0, pending: 1, pass: 2, skip: 3 };

function evidenceOf(data, ev) {
  const src = Object.values(data.req.sources).find((s) => s.url === ev.url);
  return { quote: ev.quote, src: { href: ev.url, label: src?.title ?? '출처' } };
}

const offeredText = (o) => (o === '1' ? '1학기에만 열려서 ' : o === '2' ? '2학기에만 열려서 ' : '');
function nextOffered(offered, after) {
  let t = nextTerm(after);
  while (offered !== 'all' && termSem(t) !== offered) t = nextTerm(t);
  return t;
}
const groupName = (g) => g.members.map((m) => m.name).join('·');
const stateText = { done: '이수', prog: '수강 중', failed: '재수강 필요', overdue: '미이수', missing: '남음' };

export function diagnose(courses, ctx, data) {
  const A = analyze(courses, ctx, data);
  const { req } = data;
  const P = prep(data);
  const remTerms = Math.max(0, req.minRegisteredSemesters.min - ctx.ordinal);
  const maxLoad = req.maxCreditsPerSemester.base;
  const checks = [];
  const add = (c) => checks.push(c);

  // CHK-01 총 이수학점
  {
    const need = req.totalCredits.min, have = A.counted;
    const short = need - have - A.prog;
    const s = have >= need ? 'pass' : short > remTerms * maxLoad ? 'fail' : 'pending';
    let note = s === 'pass' ? '졸업 학점을 다 채웠어요.'
      : s === 'fail' ? (remTerms ? `남은 ${remTerms}학기를 ${maxLoad}학점씩 들어도 ${short - remTerms * maxLoad}학점이 모자라요. 계절학기나 추가 학기가 필요해요.` : `등록 학기는 채웠지만 ${short}학점이 남았어요. 추가 학기나 계절학기가 필요해요.`)
      : A.prog ? `지금 듣는 ${A.prog}학점까지 들으면 ${have + A.prog}학점이에요. ${Math.max(0, short)}학점 남아요.` : `${need - have}학점 남았어요.`;
    if (A.unknown.length) note += ` 성적을 읽지 못한 ${A.unknown.length}과목(${A.unknown.map((r) => r.name).join(', ')})은 뺐어요. 이수내역 표에서 성적을 고쳐 주세요.`;
    const related = [`교양 ${A.liberalEarned}학점${A.liberalEarned > req.liberalArtsCap.max ? ` (${req.liberalArtsCap.max}학점까지만 인정)` : ''}`, `전공 ${A.majorEarned}학점`, `일반선택 ${A.earnedBy('일반선택')}학점`];
    add({ id: 'CHK-01', name: '총 이수학점', s, have, need, unit: '학점', note, related, ...evidenceOf(data, req.totalCredits.evidence) });
  }

  // CHK-02 기초교양
  {
    const m = P.min['기초교양'];
    const left = A.basicStates.filter((x) => x.st !== 'done');
    const bad = left.filter((x) => x.st === 'failed' || x.st === 'overdue');
    const s = !left.length ? 'pass' : bad.length ? 'fail' : 'pending';
    const note = s === 'pass' ? '지정 3과목을 모두 들었어요.'
      : bad.length ? `${josa(groupName(bad[0].g), '을/를')} 아직 이수하지 않았어요. ${offeredText(bad[0].g.members[0].offered)}${termText(nextOffered(bad[0].g.members[0].offered, ctx.termNow))}에 들어야 해요.`
      : `지정 과목 ${josa(left.map((x) => groupName(x.g)).join(', '), '이/가')} 남았어요.`;
    add({ id: 'CHK-02', name: '기초교양', s, have: A.earnedBy('기초교양'), need: m.min, unit: '학점', note,
      related: A.basicStates.map((x) => `${groupName(x.g)} ${stateText[x.st]}`), ...evidenceOf(data, m.evidence), ...(bad.length ? { link: 'act' } : {}) });
  }

  // CHK-03 핵심교양 (총 15 + 영역별 3)
  {
    const m = P.min['핵심교양'];
    const have = A.earnedBy('핵심교양'), areaMin = 3;
    const empty = AREAS.filter((a) => A.areaCredits[a] + A.areaProg[a] < areaMin);
    const s = have >= m.min && AREAS.every((a) => A.areaCredits[a] >= areaMin) ? 'pass' : 'pending';
    let note = s === 'pass' ? '5개 영역을 모두 채웠어요.'
      : empty.length ? `${empty.join('·')} 영역 학점이 비어 있어요.` : have + A.progBy('핵심교양') >= m.min ? '지금 듣는 과목이 끝나면 채워요.' : `${m.min - have}학점 남았어요.`;
    if (A.guessed) note += ' 영역 일부는 AI가 추정했어요. 표에서 확인해 주세요.';
    if (A.unknownArea) note += ` 영역을 모르는 ${A.unknownArea}학점은 영역 판정에서 뺐어요.`;
    add({ id: 'CHK-03', name: '핵심교양', s, have, need: m.min, unit: '학점', note,
      related: AREAS.map((a) => `${a} ${A.areaCredits[a]}${A.areaProg[a] ? `(+${A.areaProg[a]})` : ''}`), ...evidenceOf(data, m.evidence) });
  }

  // CHK-04 자유교양
  {
    const m = P.min['자유교양'];
    const have = A.earnedBy('자유교양');
    const s = have >= m.min ? 'pass' : 'pending';
    add({ id: 'CHK-04', name: '자유교양', s, have, need: m.min, unit: '학점',
      note: s === 'pass' ? `${have}학점으로 채웠어요.` : `${m.min - have}학점 남았어요.`,
      related: A.eff.filter((r) => r.kind === '자유교양' && (r.earned || r.inProgress)).map((r) => `${r.name} ${r.grade || '수강 중'}`), ...evidenceOf(data, m.evidence) });
  }

  // CHK-05 전공 (66 = 필수 41 + 선택 25)
  {
    const sub = req.subtotals.find((x) => x.label === '전공');
    const elMin = P.min['전공선택'].min;
    const have = A.majorEarned, need = sub.min;
    const s = have >= need && A.electiveEarned >= elMin ? 'pass' : 'pending';
    const after = have + A.majorProg;
    const note = s === 'pass' ? '전공 학점을 다 채웠어요.'
      : A.majorProg && after >= need && A.electiveEarned + A.electiveProg >= elMin ? `지금 듣는 전공 ${A.majorProg}학점이 끝나면 통과해요.`
      : `전공 ${Math.max(0, need - after)}학점이 더 필요해요.`;
    add({ id: 'CHK-05', name: '전공', s, have, need, unit: '학점', note,
      related: [`필수 지정 ${A.reqCredits}학점`, `그 외 전공 ${A.electiveEarned}학점`], ...evidenceOf(data, sub.evidence) });
  }

  // CHK-06 필수 지정 과목 15개
  {
    const done = A.reqStates.filter((x) => x.st === 'done').length;
    const bad = A.reqStates.filter((x) => x.st === 'failed' || x.st === 'overdue');
    const left = A.reqStates.filter((x) => x.st !== 'done');
    const s = !left.length ? 'pass' : bad.length ? 'fail' : 'pending';
    let note;
    if (s === 'pass') note = '필수 지정 15과목을 모두 들었어요.';
    else if (bad.length) {
      const b = bad[0], m = b.g.members.at(-1);
      const when = termText(nextOffered(m.offered, ctx.termNow));
      note = b.st === 'failed'
        ? `${josa(b.recs.find((r) => r.gi.kind === 'fail').name, '이/가')} ${b.recs.find((r) => r.gi.kind === 'fail').gi.g}예요. ${offeredText(m.offered)}${when}에 꼭 다시 들어야 해요.`
        : `${josa(groupName(b.g), '을/를')} 아직 안 들었어요. ${offeredText(m.offered)}${when}에 꼭 들어야 해요.`;
      if (bad.length > 1) note += ` 손볼 과목이 ${bad.length - 1}개 더 있어요.`;
    } else note = `남은 필수 과목은 ${josa(left.map((x) => groupName(x.g)).join(', '), '이에요/예요')}.`;
    const related = left.map((x) => {
      const r = x.recs.at(-1);
      return `${groupName(x.g)} ${r ? `${r.term} ${r.gi.kind === 'prog' ? '수강 중' : r.grade}` : stateText[x.st]}`;
    });
    add({ id: 'CHK-06', name: '필수 지정 과목', s, have: done, need: A.reqStates.length, unit: '과목', note, related,
      ...evidenceOf(data, req.requiredCourses.evidence), quote: '전공선택 과목 중 필수 지정 과목 15개 이수', ...(bad.length ? { link: 'act' } : {}) });
  }

  // CHK-07 평점평균
  {
    const min = req.gpa.min;
    const s = A.gpa == null ? 'pending' : A.gpa >= min ? 'pass' : 'fail';
    add({ id: 'CHK-07', name: '평점평균', s, have: A.gpa == null ? '-' : A.gpa.toFixed(2), need: min.toFixed(1), unit: '',
      note: A.gpa == null ? '아직 평점이 나온 과목이 없어요.' : s === 'pass' ? '4.5 만점 기준이에요. P 과목은 빼고 F는 0점으로 넣었어요.' : '평점평균이 2.0보다 낮아요. C+ 이하 과목을 재수강하면 올릴 수 있어요.',
      related: [`평점 반영 ${A.eff.filter((r) => r.gi.pts != null && !r.gi.noGpa).reduce((x, r) => x + r.credits, 0)}학점 기준`], ...evidenceOf(data, req.gpa.evidence) });
  }

  // CHK-08 등록 학기
  {
    const need = req.minRegisteredSemesters.min, have = ctx.ordinal;
    let t = ctx.termNow;
    for (let i = have; i < need; i++) t = nextTerm(t);
    add({ id: 'CHK-08', name: '등록 학기', s: have >= need ? 'pass' : 'pending', have, need, unit: '학기',
      note: have >= need ? `${have}학기째라 조건을 채웠어요.` : `지금 학기가 ${have}학기째예요. ${termText(t)}가 ${need}학기째예요.`,
      related: ['휴학한 학기는 세지 않아요'], ...evidenceOf(data, req.minRegisteredSemesters.evidence) });
  }

  // CHK-09 판정하지 않는 요건
  {
    const items = req.manualCheck.filter((m) => m.id !== 'liberal-arts-areas');
    const auto = A.gpa != null && A.gpa >= 3.5;
    add({ id: 'CHK-09', name: '학부 인증, 졸업논문, 전공능력', s: 'skip',
      note: auto ? '평점 3.5 이상이라 학부 인증은 서류 없이 인정될 수 있어요. 나머지는 학과 사무실에서 확인해 주세요.' : '자동으로 판정하지 않아요. 학과 사무실에서 확인해 주세요.',
      related: items.map((m) => m.label), ...evidenceOf(data, items[0].evidence) });
  }

  checks.sort((a, b) => STATUS_ORDER[a.s] - STATUS_ORDER[b.s] || a.id.localeCompare(b.id));
  const done = A.eff.filter((r) => !r.inProgress);
  const summary = {
    earned: A.earnedTotal, counted: A.counted, prog: A.prog, gpa: A.gpa,
    doneCourses: done.length,
    doneTerms: new Set(done.map((r) => r.term)).size,
    fails: A.eff.filter((r) => r.gi.kind === 'fail').map((r) => r.name),
    failCount: checks.filter((c) => c.s === 'fail').length,
  };
  return { checks, summary, A };
}

// ---------- 계획 ----------

const REQUIRED_PASS = ['CHK-01', 'CHK-02', 'CHK-03', 'CHK-04', 'CHK-05', 'CHK-06', 'CHK-08'];

// 다음 학기부터 몇 학기를 계획할지. 요건을 이미 다 채웠으면 빈 배열.
export function planTerms(courses, ctx, data) {
  const { checks, A } = diagnose(withProgDone(courses, data), ctx, data);
  const unmet = checks.filter((c) => REQUIRED_PASS.includes(c.id) && c.s !== 'pass' && c.id !== 'CHK-08');
  const remSem = Math.max(0, data.req.minRegisteredSemesters.min - ctx.ordinal);
  const short = Math.max(0, data.req.totalCredits.min - A.counted);
  let n = Math.max(remSem, Math.ceil(short / data.req.maxCreditsPerSemester.base));
  if (!n && unmet.length) n = 1;
  const out = [];
  let t = ctx.termNow;
  for (let i = 0; i < n; i++) out.push((t = nextTerm(t)));
  return out;
}

// 수강 중 과목을 다 들었다고 친 이수내역
const withProgDone = (courses, data) => courses.map((c) => (gradeInfo(c.grade, data.cats).kind === 'prog' ? { ...c, grade: 'P' } : c));

const studentYear = (ordinal) => Math.min(4, Math.ceil(ordinal / 2));

// 계획을 이수내역에 붙여 요건을 다시 판정할 수 있게 만든다.
function simulate(plan, courses, ctx, data) {
  const P = prep(data);
  const added = [];
  for (const p of plan) for (const c of p.courses) {
    const cat = !c.generic && P.catalog.find((m) => m.keys.has(nameKey(c.name)));
    added.push({ term: p.term, code: cat?.code ?? null, name: c.name, credits: cat?.credits ?? c.credits, grade: 'P',
      category: c.generic ? c.category : cat?.category === '기초교양' ? '기초교양' : '전공선택', area: c.area ?? null, areaGuess: false, generic: !!c.generic });
  }
  const last = plan.at(-1)?.term ?? ctx.termNow;
  return diagnose([...withProgDone(courses, data), ...added], { ordinal: ctx.ordinal + plan.length, termNow: last }, data);
}

// AI가 준 계획을 교육과정 표기·학점으로 맞추고 필수·재수강 표시를 붙인다. 검증은 verifyPlan이 한다.
export function tidyPlan(plan, courses, ctx, data) {
  const P = prep(data);
  const A = analyze(courses, ctx, data);
  const states = [...A.reqStates, ...A.basicStates];
  return (Array.isArray(plan) ? plan : []).slice(0, 8).map((p) => ({
    term: String(p?.term ?? '').slice(0, 9),
    why: String(p?.why ?? '').slice(0, 300),
    courses: (Array.isArray(p?.courses) ? p.courses : []).slice(0, 12).map((c) => {
      const cat = !c?.generic && P.catalog.find((m) => m.keys.has(nameKey(c?.name)));
      if (!cat) {
        return { name: String(c?.name ?? '').slice(0, 40), credits: Number(c?.credits) || 0, category: String(c?.category ?? '').slice(0, 10),
          ...(c?.generic ? { generic: true } : {}), ...(AREAS.includes(c?.area) ? { area: c.area } : {}) };
      }
      const out = { name: cat.name, credits: cat.credits, category: cat.category === '기초교양' ? '기초교양' : '전공선택' };
      const st = states.find((x) => x.g.members.some((m) => m.name === cat.name));
      if (st && st.st !== 'done' && st.st !== 'prog') out.kind = st.st === 'failed' ? 'retake' : 'req';
      return out;
    }).reduce((list, c) => {
      // 같은 학기의 '일반선택' 같은 빈칸은 한 칸으로 합친다.
      const same = c.generic && list.find((x) => x.generic && x.category === c.category && x.area === c.area);
      if (same) same.credits += c.credits; else list.push(c);
      return list;
    }, []),
  }));
}

export function verifyPlan(plan, courses, ctx, data) {
  const P = prep(data);
  const errs = [];
  const max = data.req.maxCreditsPerSemester.base;
  if (!Array.isArray(plan)) return ['계획 형식이 올바르지 않아요'];
  const A = analyze(courses, ctx, data);
  const seen = new Set();
  let prev = ctx.termNow;
  plan.forEach((p, idx) => {
    if (p.term !== nextTerm(prev)) errs.push(`${p.term}: 학기는 ${ctx.termNow} 다음 정규 학기부터 빠짐없이 순서대로 써야 해요`);
    prev = p.term;
    let load = 0;
    for (const c of p.courses ?? []) {
      if (c.generic) {
        if (!GENERIC_OK.includes(c.category)) errs.push(`${p.term} ${c.name}: 전공·기초교양은 실제 과목명으로 넣어야 해요`);
        if (c.category === '핵심교양' && !AREAS.includes(c.area)) errs.push(`${p.term} ${c.name}: 핵심교양은 영역을 정해야 해요`);
        if (!(Number(c.credits) > 0)) errs.push(`${p.term} ${c.name}: 학점은 1 이상이어야 해요`);
        load += Number(c.credits) || 0;
        continue;
      }
      const cat = P.catalog.find((m) => m.keys.has(nameKey(c.name)));
      if (!cat) { errs.push(`${p.term} ${c.name}: 교육과정에 없는 과목이에요`); load += Number(c.credits) || 0; continue; }
      load += cat.credits;
      if (cat.offered !== 'all' && cat.offered !== termSem(p.term)) errs.push(`${p.term} ${cat.name}: ${cat.offered}학기에만 열리는 과목이에요`);
      const yr = studentYear(ctx.ordinal + idx + 1);
      if (!cat.required && cat.years && (yr < cat.years[0] || yr > cat.years[1])) errs.push(`${p.term} ${cat.name}: ${yr}학년은 들을 수 없는 과목이에요(${cat.years[0]}~${cat.years[1]}학년)`);
      const same = A.eff.filter((r) => r.cat === cat);
      if (same.some((r) => r.earned)) errs.push(`${p.term} ${cat.name}: 이미 이수한 과목이에요`);
      else if (same.some((r) => r.inProgress)) errs.push(`${p.term} ${cat.name}: 지금 듣고 있는 과목이에요`);
      if (seen.has(cat.name)) errs.push(`${p.term} ${cat.name}: 계획에 두 번 들어 있어요`);
      seen.add(cat.name);
    }
    if (load > max) errs.push(`${p.term}: ${load}학점으로 학기당 ${max}학점을 넘어요`);
  });
  if (errs.length) return errs;
  const { checks } = simulate(plan, courses, ctx, data);
  for (const c of checks) if (REQUIRED_PASS.includes(c.id) && c.s !== 'pass') errs.push(`계획을 다 들어도 ${c.name} 요건이 부족해요 (${c.have}/${c.need}${c.unit})`);
  return errs;
}

// 품질 점검(규칙 위반은 아니다): 고를 전공 과목이 남았는데 '일반선택' 빈칸이 한 학기에 VAGUE_MAX학점을 넘으면
// 과목 추천이라 하기 어렵다. 서버는 이 지적으로 AI에 한 번만 다시 요청하고, 수정안이 규칙을 어기면 초안을 그대로 쓴다.
const VAGUE_MAX = 6;
export function vagueTerms(plan, courses, ctx, data) {
  const P = prep(data);
  const A = analyze(courses, ctx, data);
  const taken = new Set(A.eff.filter((r) => r.earned || r.inProgress).map((r) => r.cat?.name));
  const used = new Set(plan.flatMap((p) => p.courses.map((c) => c.name)));
  return plan.flatMap((p, idx) => {
    const blank = p.courses.filter((c) => c.generic && c.category === '일반선택').reduce((s, c) => s + c.credits, 0);
    if (blank <= VAGUE_MAX) return [];
    const yr = studentYear(ctx.ordinal + idx + 1);
    const open = P.catalog.filter((c) => c.category === '전공선택' && !c.required && c.countsTowardMajor66 !== 'conditional'
      && !taken.has(c.name) && !used.has(c.name) && (c.offered === 'all' || c.offered === termSem(p.term))
      && (!c.years || (yr >= c.years[0] && yr <= c.years[1])));
    return open.length < 2 ? [] : [`${p.term}: 일반선택 빈칸이 ${blank}학점이에요. 일반선택은 한 학기 ${VAGUE_MAX}학점까지만 쓰고, 나머지는 이 학기에 열리는 전공선택 과목명으로 채워 주세요`];
  });
}

// AI가 실패했을 때 쓰는 계획. 필수 → 전공 → 교양 → 일반선택 순서로 채운다.
export function defaultPlan(courses, ctx, data) {
  const P = prep(data);
  const terms = planTerms(courses, ctx, data);
  if (!terms.length) return [];
  const max = data.req.maxCreditsPerSemester.base;
  const plan = terms.map((term) => ({ term, courses: [], why: '' }));
  const load = (p) => p.courses.reduce((s, c) => s + c.credits, 0);
  const idxOf = (p) => plan.indexOf(p);
  const fits = (p, c, cat) => load(p) + c.credits <= max
    && (!cat || cat.offered === 'all' || cat.offered === termSem(p.term))
    && (!cat || cat.required || !cat.years || (studentYear(ctx.ordinal + idxOf(p) + 1) >= cat.years[0] && studentYear(ctx.ordinal + idxOf(p) + 1) <= cat.years[1]));
  // grow: 들어갈 학기가 없으면 학기를 늘린다. 선택 과목은 늘리지 않고 건너뛴다.
  const place = (c, cat, earliest, grow = true) => {
    for (;;) {
      const order = earliest ? plan : [...plan].sort((a, b) => load(a) - load(b));
      const p = order.find((x) => fits(x, c, cat));
      if (p) { p.courses.push(c); return true; }
      if (!grow || plan.length >= 8) return false;
      plan.push({ term: nextTerm(plan.at(-1).term), courses: [], why: '' });
    }
  };
  const A = analyze(withProgDone(courses, data), ctx, data);
  const taken = new Set(A.eff.filter((r) => r.earned).map((r) => r.cat?.name).filter(Boolean));

  // 1) 필수 지정·기초교양 지정 과목
  const missing = [...A.reqStates, ...A.basicStates].filter((x) => x.st !== 'done').sort((a, b) => a.g.rec - b.g.rec);
  let reqPlanned = 0;
  for (const x of missing) {
    // 택1 그룹은 학년 제한이 덜한 뒤쪽 과목(사제동행세미나)을 고른다.
    const m = x.g.members.at(-1);
    const cat = P.catalog.find((c) => c.name === m.name);
    const kind = x.st === 'failed' ? 'retake' : 'req';
    place({ name: m.name, credits: m.credits, category: cat?.category === '기초교양' ? '기초교양' : '전공선택', kind }, cat, true);
    if (A.reqStates.includes(x)) reqPlanned += m.credits;
  }
  // 2) 전공 학점
  const elMin = P.min['전공선택'].min, majorMin = data.req.subtotals.find((s) => s.label === '전공').min;
  let need = Math.max(majorMin - A.majorEarned - reqPlanned, elMin - A.electiveEarned);
  // 앞으로 들을 수 있는 학년의 과목만 고른다. 먼저 있는 학기에 넣어 보고, 그래도 모자라면 학기를 늘린다.
  const electives = P.catalog.filter((cat) => !cat.required && cat.category === '전공선택' && cat.countsTowardMajor66 !== 'conditional'
    && !taken.has(cat.name) && !(cat.years && cat.years[1] < studentYear(ctx.ordinal + 1)));
  for (const grow of [false, true]) {
    for (const cat of electives) {
      if (need <= 0) break;
      if (plan.some((p) => p.courses.some((c) => c.name === cat.name))) continue;
      if (place({ name: cat.name, credits: cat.credits, category: '전공선택' }, cat, false, grow)) need -= cat.credits;
    }
  }
  // 3) 핵심교양 영역과 자유교양
  const area = { ...A.areaCredits };
  for (const a of AREAS) while (area[a] < 3) { place({ name: `핵심교양 (${a})`, credits: 3, category: '핵심교양', area: a, generic: true }, null, false); area[a] += 3; }
  let core = A.earnedBy('핵심교양') + AREAS.reduce((s, a) => s + area[a] - A.areaCredits[a], 0);
  while (core < P.min['핵심교양'].min) {
    const a = AREAS.reduce((x, y) => (area[x] <= area[y] ? x : y));
    place({ name: `핵심교양 (${a})`, credits: 3, category: '핵심교양', area: a, generic: true }, null, false);
    area[a] += 3; core += 3;
  }
  const free = P.min['자유교양'].min - A.earnedBy('자유교양');
  if (free > 0) place({ name: '자유교양', credits: free, category: '자유교양', generic: true }, null, false);
  // 4) 남은 총 학점: 들을 수 있는 전공 과목을 먼저 추천하고, 그래도 남으면 일반선택 칸으로 둔다.
  let short = data.req.totalCredits.min - simulate(plan, courses, ctx, data).A.counted;
  const placed = new Set(plan.flatMap((p) => p.courses.map((c) => c.name)));
  for (const cat of P.catalog) {
    if (short < 3) break;
    if (cat.required || cat.category !== '전공선택' || cat.countsTowardMajor66 === 'conditional' || taken.has(cat.name) || placed.has(cat.name) || cat.credits > short) continue;
    if (place({ name: cat.name, credits: cat.credits, category: '전공선택' }, cat, false, false)) short -= cat.credits;
  }
  while (short > 0) {
    const p = [...plan].sort((a, b) => load(a) - load(b))[0];
    const room = max - load(p);
    if (room <= 0) { if (plan.length >= 8) break; plan.push({ term: nextTerm(plan.at(-1).term), courses: [], why: '' }); continue; }
    const c = Math.min(3, short, room);
    const g = p.courses.find((x) => x.generic && x.category === '일반선택');
    if (g) { g.credits += c; g.name = '일반선택'; } else p.courses.push({ name: '일반선택', credits: c, category: '일반선택', generic: true });
    short -= c;
  }
  for (const p of plan) {
    const req = p.courses.filter((c) => c.kind).map((c) => (c.kind === 'retake' ? `${c.name} 재수강` : c.name));
    p.why = req.length ? `필수 ${josa(req.join(', '), '을/를')} 먼저 넣고 남은 학점을 채웠어요.`
      : p.courses.length ? '남은 전공·교양·일반선택 학점을 채우는 학기예요.' : '8학기 등록을 채우는 학기예요. 듣고 싶은 과목을 자유롭게 넣으세요.';
  }
  return plan;
}

// ---------- 일정 ----------

export function pickDates({ diag, plan, courses, ctx, data, today = new Date() }) {
  const day = (iso) => new Date(`${iso}T00:00:00`);
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  const A = diag.A;
  const short = data.req.totalCredits.min - A.counted - A.prog > 0;
  const heavy = plan.find((p) => p.courses.reduce((s, c) => s + c.credits, 0) >= 18);
  const next = plan[0];
  const nextReq = next ? next.courses.filter((c) => c.kind) : [];
  const progReq = A.eff.filter((r) => r.inProgress && r.reqGroup).map((r) => r.name);
  const out = [];
  for (const e of data.cal.events) {
    if (day(e.end) < t0) continue;
    let why = e.reason, link;
    switch (e.trigger) {
      case 'hasCreditShortage':
        if (!short) continue;
        if (heavy && e.type === 'apply') why = `${termText(heavy.term)}가 ${heavy.courses.reduce((s, c) => s + c.credits, 0)}학점으로 꽉 차요. 계절학기로 3~6학점을 미리 덜어 둘 수 있어요.`;
        break;
      case 'hasNextSemesterCourses':
        if (!next) continue;
        if (nextReq.length && e.id.startsWith('enroll')) {
          why = `${josa(nextReq.map((c) => (c.kind === 'retake' ? `${c.name} 재수강` : c.name)).join(', '), '을/를')} 꼭 담으세요. ${e.reason}`;
          if (nextReq.some((c) => c.kind === 'retake')) link = 'act';
        }
        break;
      case 'isGraduatingSemester':
        if (plan.length) continue;
        break;
      case 'always':
        if (e.type === 'grade' && e.id.startsWith('grade-publish') && progReq.length) why = `필수 과목인 ${progReq.join(', ')} 성적을 확인하세요. ${e.reason}`;
        break;
      default:
        continue;
    }
    out.push({ id: e.id, title: e.title, start: e.start, end: e.end, why, ...(link ? { link } : {}) });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// ---------- 학과 문의 ----------

// 학과 사무실·지도교수에게 확인할 사실을 코드가 고른다. AI는 이 사실로 메일과 질문 문장만 쓴다.
// 반환: [{ id, title, fact, ask }]
export function consultFacts(courses, ctx, data, plan = []) {
  const { A } = diagnose(courses, ctx, data);
  const out = [];
  const add = (id, title, fact, ask) => out.push({ id, title, fact, ask });
  const names = (rs) => [...new Set(rs.map((r) => r.name))].join(', ');
  const plannedIn = (name) => plan.find((p) => p.courses?.some((c) => nameKey(c.name) === nameKey(name)))?.term;

  for (const x of A.reqStates.filter((s) => s.st === 'failed' || s.st === 'overdue')) {
    const m = x.g.members.at(-1);
    const when = plannedIn(m.name);
    const open = m.offered === 'all' ? '매 학기' : `${m.offered}학기에만`;
    if (x.st === 'failed') {
      const r = x.recs.find((y) => y.gi.kind === 'fail');
      add(`retake:${m.name}`, `${m.name} 재수강`, `필수 지정 과목 ${josa(m.name, '을/를')} ${r.term}학기에 ${r.gi.g}로 받음. ${open} 개설되고 계획상 ${when ?? '다음 개설'}학기에 재수강 예정.`,
        `${josa(m.name, '을/를')} 계절학기로 먼저 재수강할 수 있는지, 아니면 ${when ?? '다음 개설'}학기에 들어야 하는지`);
    } else {
      add(`missing:${m.name}`, `${m.name} 미이수`, `필수 지정 과목 ${m.name}의 권장 학기가 지났는데 아직 듣지 않음. ${open} 개설되고 계획상 ${when ?? '다음 개설'}학기에 수강 예정.`,
        `${josa(m.name, '을/를')} ${when ?? '다음 개설'}학기에 들어도 졸업에 문제가 없는지`);
    }
  }
  const guessed = A.eff.filter((r) => r.areaSrc === 'guess' && (r.earned || r.inProgress));
  if (guessed.length) {
    add('area', '핵심교양 영역', `${guessed.map((r) => `${r.name}(${r.areaUsed}로 추정)`).join(', ')}: 성적 화면과 요람 목록에서 영역을 확인하지 못함.`, '이 과목들의 핵심교양 영역이 맞는지');
  }
  const mism = A.eff.filter((r) => r.labelMismatch && (r.earned || r.inProgress));
  if (mism.length) {
    add('label', '이수구분 표기', `${names(mism)}: 성적표에는 ${mism[0].category}로 표시됐지만 소프트웨어학부 교육과정의 전공 과목임.`, '이 과목들이 전공 학점으로 인정되는지');
  }
  if (!A.eff.some((r) => nameKey(r.name) === nameKey('글로벌영어') && (r.earned || r.inProgress))) {
    add('globalEnglish', '글로벌영어 미이수', '글로벌영어(1학점)를 듣지 않음. 2025-1학기부터 기초교양 필수가 해지됐고, 미이수자는 이수구분과 관계없이 1학점을 추가로 이수해야 한다는 부칙(2025.03.31)이 있음.',
      '글로벌영어 대신 추가로 들어야 하는 1학점이 총 136학점 안에서 어떻게 계산되는지');
  }
  const both = A.reqStates.find((s) => s.g.members.length > 1 && s.recs.filter((r) => r.earned).length > 1);
  if (both) add('oneOf', 'S-TEAM Class·사제동행세미나', 'S-TEAM Class와 사제동행세미나를 모두 이수함. 필수는 둘 중 하나만 인정됨.', '남는 1학점이 전공선택이나 일반선택으로 인정되는지');
  const practice = A.eff.filter((r) => /^실전프로젝트/.test(r.name.replace(/\s/g, '')) && (r.earned || r.inProgress));
  if (practice.length) add('practice', '실전프로젝트 학점', `${names(practice)} 이수. 2023 요람은 과목당 1학점, 현재 개설 기준은 3학점이고 학부 인증에 쓰면 전공 66학점에 넣지 않음.`, '실전프로젝트 학점이 몇 학점으로, 어느 영역에 인정되는지');

  const gpa = A.gpa;
  add('competency', '학부 인증(역량기반 졸업요건)', gpa != null && gpa >= 3.5 ? `평점평균 ${gpa.toFixed(2)}로 3.5 이상. 학과 공지상 평점 3.5 이상은 서류 없이 자동 인증됨.` : `평점평균 ${gpa == null ? '없음' : gpa.toFixed(2)}. 10가지 항목 중 하나로 채워야 함.`,
    gpa != null && gpa >= 3.5 ? '평점 3.5 이상 자동 인증 대상이 맞는지, 따로 낼 서류가 있는지' : '학부 인증을 어떤 항목으로 채우는 게 좋은지');
  const majorPlanned = plan.reduce((s, p) => s + (p.courses ?? []).filter((c) => c.category === '전공선택' && !c.generic).reduce((t, c) => t + (Number(c.credits) || 0), 0), 0);
  const majorAfter = A.majorEarned + A.majorProg + majorPlanned;
  add('majorTrack', '전공능력(심화전공)', `계획대로 들으면 전공 ${majorAfter}학점. 심화전공은 전공 66학점과 별도로 전공 18학점을 더 들어 합계 84학점이 필요함.`,
    majorAfter >= 84 ? '이 계획으로 심화전공이 인정되는지' : `심화전공으로 인정받으려면 전공 ${84 - majorAfter}학점을 더 들어야 하는지, 부전공이나 다전공이 나은지`);
  const cap = plannedIn('다학제간캡스톤디자인');
  add('thesis', '졸업논문', `졸업논문은 다학제간캡스톤디자인 결과보고서로 대체됨.${cap ? ` 캡스톤은 ${cap}학기에 들을 계획.` : ''}`, '캡스톤 결과보고서를 언제, 어디에 제출하는지');
  return out;
}
