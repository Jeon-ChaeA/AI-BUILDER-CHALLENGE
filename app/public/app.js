// 졸업각 화면. 판정은 engine.js가 하고, 이 파일은 입력·호출·그리기만 맡는다.
import * as E from './engine.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const PASS_UNTIL = '2027-02-28';
const SAMPLE_CTX = { ordinal: 6, termNow: '2026-2' }; // 샘플 학생은 2026-2학기 시점 스냅숏
const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;

let data, sample;
const state = { courses: [], ctx: null, diag: null, plan: [], source: '', summary: '', trace: [], wishes: '', dates: [] };
let busy = false;

// ---------- 저장소: 막혀 있어도 화면은 돌아가야 한다 ----------
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 무시 */ } },
};
const todayIso = () => new Date().toLocaleDateString('sv-SE');
const hasPass = () => { const u = store.get('jg.passUntil'); return !!u && todayIso() <= u; };
const trialUsed = () => store.get('jg.trialUsed') === '1';

function renderTrial() {
  const pass = hasPass(), used = trialUsed();
  // 상단바 배지는 한 줄로 둔다. 480px 이하에서는 짧은 문구(.t-narrow)로 바꿔 로고·버튼과 함께 들어가게 한다.
  const label = (wide, narrow) => `<span class="t-wide">${wide}</span><span class="t-narrow">${narrow}</span>`;
  $('trialText').innerHTML = pass ? label(`이용권 사용 중<span class="until"> · ${esc(store.get('jg.passUntil'))}까지</span>`, '<i class="ph ph-check"></i>이용권')
    : used ? label('무료 체험을 사용했어요', '체험 완료') : label('무료 체험 1회 남음', '무료 1회');
  $('trial').title = pass ? `이용권 사용 중 · ${store.get('jg.passUntil')}까지` : used ? '무료 체험을 사용했어요' : '무료 체험 1회 남음';
  $('trial').classList.toggle('used', used && !pass);
  $('trial').classList.toggle('pass', pass);
  // 요금 섹션 버튼도 같은 상태를 보여 준다.
  $('buyPass').disabled = pass;
  $('buyPass').innerHTML = pass ? `<i class="ph ph-check-circle"></i>이용권 사용 중 · ${esc(store.get('jg.passUntil'))}까지` : '<i class="ph ph-credit-card"></i>이용권 테스트 결제';
}

// ---------- 공통 조각 ----------
const ICON = {
  pass: '<i class="ph-fill ph-check-circle done"></i>',
  fail: '<i class="ph-fill ph-x-circle done"></i>',
  pending: '<i class="ph ph-circle-dashed done"></i>',
  skip: '<i class="ph ph-minus-circle done"></i>',
};
const LABEL = { pass: '통과', fail: '조치 필요', pending: '진행 중', skip: '학과 확인' };
const status = (s) => `<span class="st" title="${LABEL[s]}">${ICON[s]}<i class="ph ph-spinner-gap spin"></i><span class="sr-only">${LABEL[s]}</span></span>`;
const metric = (k) => (k.need == null ? '' : `${k.have}/${k.need}${k.unit}`);
const linkAttr = (o) => (o.link ? ` data-link="${o.link}"` : '');
const load = (cs) => cs.reduce((s, c) => s + c.credits, 0);
const replay = (el) => { el.classList.remove('run'); void el.offsetWidth; el.classList.add('run'); };

function setStatus(kind, text) {
  const el = $('status');
  el.className = `status${kind ? ` ${kind}` : ''}`;
  el.innerHTML = text ? `${kind === 'busy' ? '<i class="ph ph-spinner-gap"></i>' : kind === 'error' ? '<i class="ph ph-warning-circle"></i>' : '<i class="ph ph-info"></i>'}${esc(text)}` : '';
}
function setBusy(on) {
  busy = on;
  for (const id of ['go', 'rerun', 'replanGo', 'consultGo']) $(id).disabled = on;
  // 진단 중에는 표를 잠근다. 새 이수내역으로 바뀐 뒤 옛 표의 행 번호로 고치는 일을 막는다.
  $('log').inert = on;
}

// ---------- hero 미리보기: 샘플 학생을 엔진으로 계산 ----------
function renderHero() {
  const diag = E.diagnose(sample.courses, SAMPLE_CTX, data);
  const plan = E.defaultPlan(sample.courses, SAMPLE_CTX, data);
  const grad = E.gradDate(plan.at(-1)?.term ?? SAMPLE_CTX.termNow);
  $('heroChecks').innerHTML = diag.checks.map((k, i) => `
    <li class="check" data-s="${k.s}" style="--i:${i}"${linkAttr(k)} tabindex="0">
      ${status(k.s)}<span class="name">${esc(k.name)}</span><span class="metric">${k.s === 'skip' ? '학과 확인' : metric(k)}</span>
    </li>`).join('');
  // 졸업 리포트 카드: 수치는 모두 엔진 계산값. gsap.js가 jg:hero를 받아 링과 숫자를 움직인다.
  const total = data.req.totalCredits.min, counted = diag.summary.counted;
  const pct = Math.min(100, Math.round((counted / total) * 100));
  const f = diag.summary.failCount;
  $('heroBadge').textContent = `${grad} 졸업 가능`;
  $('heroEarned').textContent = counted;
  $('heroTotal').textContent = `/ ${total}학점`;
  $('heroLeft').textContent = `${Math.max(0, total - counted)}학점`;
  $('heroPct').textContent = pct;
  $('heroFoot').innerHTML = f ? `딱 <strong>${f}개</strong>만 해결하면 돼요` : '손볼 것 없이 순조로워요';
  const ring = document.querySelector('.rc-ring .prog');
  if (ring) ring.style.strokeDashoffset = String(2 * Math.PI * 52 * (1 - pct / 100));
  document.dispatchEvent(new CustomEvent('jg:hero', { detail: { pct, earned: counted } }));
}

// ---------- 이수내역 ----------
const regularOf = (t) => { const [y, s] = t.split('-'); return s === '여름' ? `${y}-1` : s === '겨울' ? `${y}-2` : t; };

function renderLog() {
  const { summary, A } = state.diag;
  const progCount = A.eff.filter((r) => r.inProgress).length;
  $('log-h').innerHTML = `지금까지 <span class="num">${summary.earned}</span>학점을 들었어요`;
  // PRD FR-01 완료 기준의 요약 문구: "총 N과목 · N학점"
  $('logLede').innerHTML = `<b class="total">총 ${summary.doneCourses}과목 · ${summary.earned}학점</b> `
    + esc(`${summary.doneTerms}개 학기 동안 들었고`
    + (summary.fails.length ? `, F 받은 ${summary.fails.length}과목은 학점에서 뺐어요.` : '.')
    + (progCount ? ` 지금 ${progCount}과목 ${summary.prog}학점을 듣고 있어요.` : ''));

  // 잔디: 첫 학기부터 지금 학기까지 정규 학기마다 한 칸. 계절학기는 앞 학기 칸에 붙인다.
  const terms = [...new Set(state.courses.map((c) => regularOf(c.term)))].sort((a, b) => E.termIdx(a) - E.termIdx(b));
  const cols = [];
  if (terms.length) {
    const last = E.termIdx(state.ctx.termNow) > E.termIdx(terms.at(-1)) ? state.ctx.termNow : terms.at(-1);
    for (let t = terms[0]; E.termIdx(t) <= E.termIdx(last); t = E.nextTerm(t)) cols.push(t);
  }
  $('grass').innerHTML = cols.map((t) => {
    const recs = A.recs.filter((r) => regularOf(r.term) === t);
    const cells = recs.map((r) => {
      const cls = r.gi.kind === 'prog' ? 'now' : r.gi.kind === 'fail' ? 'f' : `l${Math.min(r.credits, 3)}`;
      return `<span class="cell ${cls}" title="${esc(r.name)} ${r.credits}학점${r.grade ? ` ${esc(r.grade)}` : ' 수강 중'}"></span>`;
    }).join('');
    return `<div class="gcol${recs.length ? '' : ' leave'}"${recs.length ? '' : ' title="휴학"'}><div class="gcells">${cells}</div><span class="glabel">${t.slice(2)}</span></div>`;
  }).join('');

  // 학기별 표: 칸을 고치면 state.courses가 바로 바뀐다. [R]·W·못 읽은 성적은 원문을 선택지로 남긴다.
  const keepRaw = (r) => r.gi.kind === 'unknown' || r.gi.kind === 'void';
  const byTerm = new Map();
  A.recs.forEach((r) => (byTerm.get(r.term) ?? byTerm.set(r.term, []).get(r.term)).push(r));
  const keys = [...byTerm.keys()].sort((a, b) => E.termIdx(a) - E.termIdx(b));
  const lastDone = keys.filter((t) => byTerm.get(t).some((r) => r.gi.kind !== 'prog')).at(-1);
  $('terms').innerHTML = keys.map((t) => {
    const recs = byTerm.get(t);
    const prog = recs.every((r) => r.gi.kind === 'prog');
    const earned = recs.reduce((s, r) => s + (r.gi.kind === 'graded' || r.gi.kind === 'pass' ? r.credits : 0), 0);
    const [y, s] = t.split('-');
    return `
    <details class="term"${t === lastDone || prog ? ' open' : ''}>
      <summary><i class="ph ph-caret-right chev"></i><strong>${y}년 ${/^\d$/.test(s) ? `${s}학기` : `${s} 계절학기`}</strong><span class="grow mono muted">${t}</span><span class="num">${prog ? `${load(recs)}학점 수강 중` : `${earned}학점`}</span></summary>
      <div class="tscroll"><table class="course-table" role="table">
        <thead role="rowgroup"><tr role="row"><th role="columnheader">과목명</th><th role="columnheader">학점</th><th role="columnheader">이수구분</th><th role="columnheader">성적</th><th role="columnheader"><span class="sr-only">삭제</span></th></tr></thead>
        <tbody role="rowgroup">${recs.map((r) => {
          const area = r.kind === '핵심교양' ? `<select class="cell-edit area-edit" data-f="area" aria-label="${esc(r.name)} 핵심교양 영역">
              <option value="">영역 모름</option>${E.AREAS.map((a) => `<option${a === r.areaUsed ? ' selected' : ''}>${a}</option>`).join('')}</select>${r.areaSrc === 'guess' ? '<span class="guess">추정</span>' : ''}` : '';
          const cls = [r.gi.kind === 'fail' && !r.superseded ? 'is-f' : '', r.superseded ? 'is-old' : ''].join(' ').trim();
          return `
          <tr role="row" data-i="${r.i}"${cls ? ` class="${cls}"` : ''}${r.reqGroup && r.gi.kind === 'fail' && !r.superseded ? ' data-link="act"' : ''}>
            <td role="cell" class="c-name">${esc(r.name)}${r.reqGroup ? '<span class="req">필수</span>' : ''}${area}${r.labelMismatch ? `<span class="area" title="목록에 있는 전공 과목이라 전공으로 셌어요">성적표에는 ${esc(r.category)}</span>` : ''}</td>
            <td role="cell" class="c-cr"><input class="cell-edit" data-f="credits" type="number" min="1" max="6" value="${r.credits}" aria-label="${esc(r.name)} 학점"></td>
            <td role="cell" class="c-cat"><select class="cell-edit" data-f="category" aria-label="${esc(r.name)} 이수구분">${E.CATEGORIES.map((x) => `<option${x === r.category ? ' selected' : ''}>${x}</option>`).join('')}</select></td>
            <td role="cell" class="grade"><select class="cell-edit${r.gi.kind === 'unknown' ? ' bad' : ''}" data-f="grade" aria-label="${esc(r.name)} 성적">
              ${[...(keepRaw(r) ? [r.grade] : []), ...E.GRADES, ''].map((g) => `<option value="${esc(g)}"${(r.gi.kind === 'prog' ? '' : keepRaw(r) ? r.grade : r.gi.g) === g ? ' selected' : ''}>${g === '' ? '수강 중' : esc(g)}${keepRaw(r) && g === r.grade ? (r.gi.kind === 'void' ? ' (제외)' : ' (읽지 못함)') : ''}</option>`).join('')}
            </select></td>
            <td role="cell" class="c-del"><button class="row-del" type="button" data-del aria-label="${esc(r.name)} 행 삭제"><i class="ph ph-x"></i></button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </details>`;
  }).join('');
}

// ---------- 체크 ----------
function renderChecks() {
  const { checks } = state.diag;
  const n = (s) => checks.filter((k) => k.s === s).length;
  $('checks-h').innerHTML = n('fail') ? `체크 ${checks.length}개 중 <span class="num">${n('fail')}</span>개는 지금 손봐야 해요` : `체크 ${checks.length}개 중 지금 손볼 것은 없어요`;
  $('tally').innerHTML = `
    <span class="bad"><i class="ph-fill ph-x-circle"></i>조치 필요 ${n('fail')}</span>
    <span class="mid"><i class="ph ph-circle-dashed"></i>진행 중 ${n('pending')}</span>
    <span class="ok"><i class="ph-fill ph-check-circle"></i>통과 ${n('pass')}</span>
    <span class="mid"><i class="ph ph-minus-circle"></i>학과 확인 ${n('skip')}</span>`;
  $('fullChecks').innerHTML = checks.map((k, i) => {
    const gap = typeof k.have === 'number' && k.have < k.need ? `${k.need - k.have}${k.unit} 부족` : LABEL[k.s];
    return `
    <li class="check" data-s="${k.s}" style="--i:${i}"${linkAttr(k)}>
      <details${k.s === 'fail' ? ' open' : ''}>
        <summary>
          ${status(k.s)}<span class="code">${k.id}</span><span class="name">${esc(k.name)}</span>
          <span class="metric">${k.need == null ? '' : `<b>${k.have}</b> / ${k.need}${k.unit}`}<span class="gap">${gap}</span></span>
          <i class="ph ph-caret-right chev"></i>
          <span class="note">${esc(k.note)}${k.link ? ' <span class="link-hint"><i class="ph ph-arrow-bend-right-down"></i>계획에서 해결</span>' : ''}</span>
        </summary>
        <div class="logbox">
          <blockquote class="quote">“${esc(k.quote)}”<br>
            <a class="src" href="${esc(k.src.href)}" target="_blank" rel="noopener"><i class="ph ph-link-simple"></i>${esc(k.src.label)}</a>
          </blockquote>
          <ul class="related">${k.related.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>
      </details>
    </li>`;
  }).join('');
}

// ---------- 계획 ----------
function renderPlan() {
  const { plan, source, ctx, diag } = state;
  const max = data.req.maxCreditsPerSemester.base;
  const lastTerm = plan.at(-1)?.term ?? ctx.termNow;
  const grad = E.gradDate(lastTerm);
  $('plan-h').textContent = `${grad}에 졸업하는 계획`;
  $('planLede').textContent = source === 'ai' ? 'AI가 짠 계획을 코드가 다시 확인했어요.'
    : source === 'done' ? '남은 요건이 없어요. 지금 학기를 잘 마치면 졸업할 수 있어요.'
    : state.fallbackOk ? 'AI 계획을 쓰지 못해서 교육과정 순서로 만든 기본 계획을 보여 드려요. 이 계획도 코드가 확인했어요.'
    : 'AI 계획을 쓰지 못해서 기본 계획을 보여 드려요. 일부 요건은 이 계획으로 채우지 못하니 학과 사무실과 꼭 상의하세요.';
  $('verified').hidden = source === 'done' || (source === 'fallback' && !state.fallbackOk);

  // AI 요약과 희망 사항. 기본 계획은 희망을 읽지 않으니 '반영했다'고 쓰지 않는다.
  const wish = !state.wishes || source === 'done' ? ''
    : source === 'ai' ? `<p class="wish-used"><i class="ph ph-chat-circle-text"></i>반영한 희망 사항: “${esc(state.wishes)}”</p>`
    : `<p class="wish-used"><i class="ph ph-chat-circle-text"></i>기본 계획에는 희망 사항(“${esc(state.wishes)}”)을 반영하지 못했어요. 아래 'AI로 다시 짜기'로 다시 시도해 보세요.</p>`;
  $('planSummary').innerHTML = state.summary ? `<p><i class="ph-fill ph-sparkle"></i>${esc(state.summary)}</p>${wish}` : wish;
  $('planSummary').hidden = !state.summary && !wish;

  // AI 초안 → 코드 검증 → 수정 요청 기록
  const steps = state.trace.map((t) => {
    const head = t.attempt === 1 ? 'AI 초안' : `위반 내용을 AI에 돌려주고 받은 ${t.attempt}차 수정안`;
    if (t.error) return `<li class="t-bad"><b>${head}</b> AI 응답을 받지 못했어요.</li>`;
    if (!t.total) return `<li class="t-ok"><b>${head}</b> 코드 검증 통과: 학기당 ${max}학점, 중복 수강, 개설 학기·학년, 졸업요건 7개를 모두 지켰어요.</li>`;
    return `<li class="t-bad"><b>${head}</b> 코드 검증에서 위반 ${t.total}건을 찾았어요.<ul>${t.violations.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></li>`;
  });
  if (source === 'fallback') steps.push(state.fallbackOk ? '<li class="t-ok"><b>기본 계획</b> AI 계획을 쓰지 못해 교육과정 순서로 만든 계획으로 바꿨고, 같은 검증을 통과했어요.</li>'
    : '<li class="t-bad"><b>기본 계획</b> 교육과정 순서로 만든 계획도 일부 요건을 채우지 못했어요.</li>');
  $('trace').innerHTML = steps.join('');
  $('traceBox').hidden = !steps.length;

  const chip = ([name, c, k, gen]) => `<li class="chip${k ? ` ${k}` : ''}${gen ? ' gen' : ''}"${k === 'retake' ? ' data-link="act"' : ''}>${k === 'retake' ? '<i class="ph ph-arrow-counter-clockwise"></i>' : ''}${esc(name)}${k === 'retake' ? ' 재수강' : ''}<span class="c">${c}</span></li>`;
  const node = ({ label, code, now, credits, chips, why, link }) => `
    <li class="node${now ? ' now' : ''}"${link ? ` data-link="${link}"` : ''}>
      <span class="dot"></span>
      <div class="node-card">
        <div class="node-head">
          <strong>${label}</strong><span class="term-code">${code}</span>${now ? '<span class="tag">지금 듣는 중</span>' : ''}
          <span class="load"><b>${credits}</b>/${max}학점</span>
        </div>
        ${chips.length ? `<ul class="chips">${chips.map(chip).join('')}</ul>` : ''}
        <p class="why"><i class="ph ph-sparkle"></i>${esc(why)}</p>
      </div>
    </li>`;

  const nodes = [];
  const prog = diag.A.eff.filter((r) => r.inProgress);
  if (prog.length) {
    const req = prog.filter((r) => r.reqGroup).map((r) => r.name);
    nodes.push(node({ label: E.termLabel(ctx.ordinal), code: ctx.termNow, now: true, credits: load(prog),
      chips: prog.map((r) => [r.name, r.credits, r.reqGroup ? 'req' : '']),
      why: req.length ? `지금 듣는 학기예요. 필수 ${E.josa(req.join(', '), '이/가')} 들어 있으니 꼭 통과하세요.` : '지금 듣는 학기예요.' }));
  }
  plan.forEach((p, i) => nodes.push(node({
    label: E.termLabel(ctx.ordinal + i + 1), code: p.term, credits: load(p.courses),
    chips: p.courses.map((c) => [c.name, c.credits, c.kind, c.generic]),
    why: p.why, link: p.courses.some((c) => c.kind === 'retake') ? 'act' : '',
  })));
  const total = diag.summary.counted + diag.summary.prog + plan.reduce((s, p) => s + load(p.courses), 0);
  $('branch').innerHTML = nodes.join('') + `
    <li class="node goal"><span class="dot"><i class="ph-fill ph-check"></i></span>
      <div class="node-card"><div class="node-head"><strong>${grad} 졸업</strong><span class="load"><b>${total}</b>/${data.req.totalCredits.min}학점</span></div></div>
    </li>`;
}

// ---------- 날짜 ----------
const DAY = 86400000;
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const md = (iso) => `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}`;
function renderDates() {
  const { dates } = state;
  $('dateList').innerHTML = dates.length ? dates.map((d) => {
    const left = Math.round((new Date(`${d.start}T00:00`) - today0()) / DAY);
    const toEnd = Math.round((new Date(`${d.end}T00:00`) - today0()) / DAY);
    return `
    <li class="date"${linkAttr(d)}>
      <div><div class="dday">${left > 0 ? `D-${left}` : '진행 중'}</div><div class="when">${d.start === d.end ? md(d.start) : `${md(d.start)}~${md(d.end)}`}${left <= 0 ? ` · 마감 D-${toEnd}` : ''}</div></div>
      <div><h3>${esc(d.title)}</h3><p>${esc(d.why)}</p></div>
    </li>`;
  }).join('') : '<li class="muted">지금 챙길 마감 일정이 없어요.</li>';
  $('ics').disabled = !dates.length;
}

// .ics는 schedule.js(줄 접기·RFC 5545 이스케이프)가 만든다. 이유 문장은 진단에 맞춘 why를 쓴다.
function downloadIcs() {
  const ics = window.Schedule.buildIcs(state.dates.map((d) => ({ ...d, reason: d.why })));
  const filename = document.documentElement.dataset.locale === 'en' ? 'GraduationGak-deadlines.ics' : '졸업각-마감일정.ics';
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 호출 ----------
async function post(url, body, ms, retry = true) {
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  } catch (err) {
    throw new Error(err?.name === 'TimeoutError' ? `AI 응답이 ${ms / 1000}초를 넘었어요. 잠시 후 다시 시도해 주세요.` : '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.');
  }
  const json = await r.json().catch(() => ({}));
  // 앞단 프록시가 낸 502·503(JSON 아님)은 요청이 앱에 닿지 않은 것이라 한 번만 다시 보낸다. 504는 AI가 도는 중일 수 있어 다시 보내지 않는다.
  if (retry && (r.status === 502 || r.status === 503) && !json.error) return post(url, body, ms, false);
  if (!r.ok) throw new Error(json.error ?? 'AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
  return json;
}

const toB64 = (blob) => new Promise((ok, no) => {
  const fr = new FileReader();
  fr.onload = () => ok(String(fr.result).split(',')[1]);
  fr.onerror = () => no(new Error('파일을 읽지 못했어요.'));
  fr.readAsDataURL(blob);
});

async function readInput(src) {
  if (src === 'sample') {
    const blob = await (await fetch('sample/capture.png')).blob();
    return { files: [{ mimeType: 'image/png', data: await toB64(blob) }] };
  }
  if (src === 'capture') {
    const files = [...$('files').files];
    if (!files.length) throw new Error('성적 화면 캡처를 골라 주세요.');
    if (files.length > MAX_FILES) throw new Error(`캡처는 ${MAX_FILES}장까지 올릴 수 있어요.`);
    if (files.some((f) => !/^image\/(png|jpeg|webp)$/.test(f.type))) throw new Error('PNG, JPG, WEBP 이미지만 올릴 수 있어요.');
    if (files.reduce((s, f) => s + f.size, 0) > MAX_BYTES) throw new Error('캡처 용량이 너무 커요. 합쳐서 10MB 이하로 올려 주세요.');
    return { files: await Promise.all(files.map(async (f) => ({ mimeType: f.type, data: await toB64(f) }))) };
  }
  const text = $('paste').value.trim();
  if (!text) throw new Error('성적 화면 텍스트를 붙여넣어 주세요.');
  return { text };
}

// ---------- 진행판: 히어로의 '진단 순서'가 진단하는 동안 단계별 상태와 걸린 시간을 보여 준다 ----------
const flow = (() => {
  const STEPS = ['parse', 'judge', 'plan', 'verify'];
  const ICON = { run: 'ph-spinner-gap', done: 'ph-check', warn: 'ph-info', fail: 'ph-warning-circle', skip: 'ph-minus' };
  const started = {};
  let t0 = 0, timer = 0;
  const sec = (ms) => (ms < 100 ? '즉시' : `${(ms / 1000).toFixed(1)}초`);
  const li = (k) => document.querySelector(`.flow-steps li[data-step="${k}"]`);
  function set(k, st, text = '') {
    const el = li(k);
    if (!el) return;
    if (st === 'run') started[k] = performance.now();
    const took = st === 'done' && started[k] ? sec(performance.now() - started[k]) : '';
    delete el.dataset.state;
    if (st) el.dataset.state = st;
    const label = st === 'run' ? text || '진행 중' : [text, took].filter(Boolean).join(' · ');
    el.querySelector('.fs-state').innerHTML = st ? `<i class="ph ${ICON[st]}"></i>${esc(label)}` : '';
    if (st !== 'run') delete started[k];
  }
  return {
    start(title) {
      STEPS.forEach((k) => set(k, ''));
      t0 = performance.now();
      $('flowTitle').textContent = title;
      clearInterval(timer);
      timer = setInterval(() => { $('flowTime').textContent = sec(performance.now() - t0); }, 100);
    },
    set,
    end(title) {
      clearInterval(timer);
      $('flowTime').textContent = sec(performance.now() - t0);
      $('flowTitle').textContent = title;
    },
  };
})();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 로드맵 응답으로 계획·검증 단계 상태를 채운다.
function flowPlanResult() {
  const { source, trace, fallbackOk } = state;
  if (source === 'done') { flow.set('plan', 'skip', '남은 학기 없음'); flow.set('verify', 'skip'); return; }
  if (source === 'ai') {
    flow.set('plan', 'done', trace.length > 1 ? `${trace.length}차 수정안` : 'AI 초안');
    flow.set('verify', 'done', trace.length > 1 ? `위반 ${trace[0].total}건 → 수정 후 통과` : '규칙 모두 통과');
    return;
  }
  flow.set('plan', 'warn', 'AI 응답 실패');
  flow.set('verify', fallbackOk ? 'done' : 'fail', fallbackOk ? '기본 계획 통과' : '일부 요건 미달');
}

// AI 로드맵. 서버가 코드로 검증하고, 서버에 닿지 못하면 브라우저에서 기본 계획을 만든다.
async function fetchPlan() {
  try {
    const r = await post('/api/roadmap', { courses: state.courses, ctx: state.ctx, wishes: state.wishes }, 35_000);
    Object.assign(state, { plan: r.plan, source: r.source, fallbackOk: r.fallbackOk !== false, summary: r.summary ?? '', trace: r.trace ?? [] });
  } catch {
    const plan = E.defaultPlan(state.courses, state.ctx, data);
    Object.assign(state, { plan, source: 'fallback', fallbackOk: !E.verifyPlan(plan, state.courses, state.ctx, data).length, summary: '', trace: [{ attempt: 1, error: true }] });
  }
  state.dates = E.pickDates({ diag: state.diag, plan: state.plan, courses: state.courses, ctx: state.ctx, data });
}

// ---------- 학과 문의 메일 ----------
function resetConsult() {
  const facts = E.consultFacts(state.courses, state.ctx, data, state.plan);
  $('facts').innerHTML = facts.map((f) => `<li><b>${esc(f.title)}</b>${esc(f.fact)}</li>`).join('');
  $('consultOut').hidden = true;
  $('questions').innerHTML = '';
  consultStatus('', '');
}
function consultStatus(kind, text) {
  const el = $('consultStatus');
  el.className = `status${kind ? ` ${kind}` : ''}`;
  el.textContent = text;
}
function syncMailto() {
  $('mailto').href = `mailto:?subject=${encodeURIComponent($('mailSubject').value)}&body=${encodeURIComponent($('mailBody').value)}`;
}
function showConsult({ subject, body, questions }) {
  $('questions').innerHTML = questions.map((q) => `<li>${esc(q)}</li>`).join('');
  $('mailSubject').value = subject;
  $('mailBody').value = body;
  syncMailto();
  $('consultOut').hidden = false;
}
// AI가 실패해도 코드가 고른 사실로 초안은 준다.
function fallbackConsult() {
  const facts = E.consultFacts(state.courses, state.ctx, data, state.plan);
  return {
    subject: '소프트웨어학부 졸업요건 확인 문의',
    body: ['안녕하세요. 소프트웨어학부 [학번] [이름]입니다.', '졸업요건을 확인하다가 몇 가지 여쭙고 싶어 연락드립니다.', '',
      ...facts.map((f, i) => `${i + 1}. ${f.ask} 여쭙고 싶습니다.`), '', '확인해 주시면 감사하겠습니다.', '[이름] 드림'].join('\n'),
    questions: facts.slice(0, 6).map((f) => `${f.ask} 궁금해요.`),
  };
}

// 이수내역이 정해진 뒤의 단계. '다시 진단'도 여기서 시작한다(AI 인식과 체험 차감 없음).
async function analyze(notice = '') {
  flow.set('judge', 'run');
  state.diag = E.diagnose(state.courses, state.ctx, data);
  flow.set('judge', 'done', state.diag.summary.failCount ? `조치 필요 ${state.diag.summary.failCount}개` : '조치 필요 없음');
  setStatus('busy', state.wishes ? 'AI가 희망 사항을 반영해 남은 학기를 짜고, 코드가 그 계획을 검증하고 있어요.' : 'AI가 남은 학기 계획을 짜고, 코드가 그 계획을 검증하고 있어요.');
  flow.set('plan', 'run', state.wishes ? '희망 사항 반영 중' : '');
  await fetchPlan();
  flowPlanResult();
  flow.end('진단을 마쳤어요');
  renderLog();
  renderChecks();
  renderPlan();
  renderDates();
  resetConsult();
  $('printHead').textContent = `졸업각 졸업요건 진단 리포트 · ${data.req.department} ${data.req.admissionYear}학번 · ${E.termLabel(state.ctx.ordinal)}(${state.ctx.termNow}) 기준 · ${todayIso()} 진단`;
  for (const id of ['log', 'checks', 'plan', 'dates', 'consult', 'report']) $(id).hidden = false;
  replay($('fullChecks'));
  setStatus(notice ? 'info' : '', notice);
  document.dispatchEvent(new CustomEvent('jg:render'));
}

async function diagnoseNow() {
  const src = document.querySelector('input[name="src"]:checked').value;
  setBusy(true);
  try {
    let input;
    try { input = await readInput(src); } catch (err) { setStatus('error', err.message); return; }
    if (src === 'sample') { $('year').value = '3'; $('term').value = '2'; }
    state.wishes = $('wishes').value.replace(/\s+/g, ' ').trim();
    $('wishes2').value = state.wishes;
    setStatus('busy', 'AI가 성적 화면을 읽고 있어요. 10~20초쯤 걸려요.');
    flow.start('진단하는 중');
    flow.set('parse', 'run', 'AI가 읽는 중');
    let notice = '';
    try {
      state.courses = (await post('/api/parse', input, 40_000)).courses;
      flow.set('parse', 'done', `${state.courses.length}과목`);
    } catch (err) {
      if (src !== 'sample') {
        flow.set('parse', 'fail', '인식 실패');
        flow.end('진단하지 못했어요');
        setStatus('error', err.message);
        return;
      }
      state.courses = structuredClone(sample.courses);
      flow.set('parse', 'warn', '저장본 사용');
      notice = 'AI 인식이 실패해서 미리 읽어 둔 샘플 결과로 보여 드려요.';
    }
    state.ctx = src === 'sample' ? SAMPLE_CTX : { ordinal: (+$('year').value - 1) * 2 + +$('term').value, termNow: E.termNow() };
    await analyze(notice);
    if (!hasPass()) store.set('jg.trialUsed', '1');
    renderTrial();
    await sleep(700); // 끝난 진행판을 잠깐 보여 주고 결과로 넘어간다
    $('checks').scrollIntoView();
  } finally {
    setBusy(false);
  }
}

// ---------- 이벤트 ----------
// 하드페이월(PRD FR-05): 무료 체험을 쓴 뒤 '진단 시작'을 누르면 이용권 안내가 뜬다.
// 요금 섹션의 '이용권 테스트 결제'도 같은 창을 쓰고, 그때는 결제 뒤 진단을 자동으로 시작하지 않는다.
let diagnoseAfterPay = false;
function openPaywall(thenDiagnose) {
  diagnoseAfterPay = thenDiagnose;
  $('paywall').returnValue = '';
  $('paywall').showModal();
}

$('intake').addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) return;
  if (trialUsed() && !hasPass()) { openPaywall(true); return; }
  diagnoseNow();
});

$('buyPass').addEventListener('click', () => { if (!hasPass()) openPaywall(false); });

$('paywall').addEventListener('close', () => {
  if ($('paywall').returnValue !== 'pay') return;
  store.set('jg.passUntil', PASS_UNTIL);
  renderTrial();
  setStatus('info', `테스트 결제가 끝났어요. ${PASS_UNTIL}까지 이용권을 쓸 수 있어요.`);
  if (diagnoseAfterPay) diagnoseNow();
});

$('rerun').addEventListener('click', async () => {
  if (busy) return;
  if (!state.courses.length) { setStatus('error', '이수내역이 비어 있어요. 다시 진단 시작을 눌러 주세요.'); return; }
  setBusy(true);
  flow.start('다시 진단하는 중');
  flow.set('parse', 'skip', '고친 이수내역');
  try { await analyze('고친 이수내역으로 다시 진단했어요.'); $('checks').scrollIntoView(); } finally { setBusy(false); }
});

$('replan').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy || !state.courses.length) return;
  state.wishes = $('wishes2').value.replace(/\s+/g, ' ').trim();
  $('wishes').value = state.wishes;
  setBusy(true);
  $('replanGo').innerHTML = '<i class="ph ph-spinner-gap"></i>AI가 다시 짜는 중';
  flow.start('계획을 다시 짜는 중');
  flow.set('parse', 'skip', '그대로');
  flow.set('judge', 'skip', '그대로');
  flow.set('plan', 'run', '희망 사항 반영 중');
  try {
    await fetchPlan();
    flowPlanResult();
    flow.end('계획을 다시 짰어요');
    renderPlan();
    renderDates();
    resetConsult();
    $('plan').scrollIntoView();
    document.dispatchEvent(new CustomEvent('jg:render'));
  } finally {
    $('replanGo').innerHTML = '<i class="ph ph-sparkle"></i>AI로 다시 짜기';
    setBusy(false);
  }
});

// 샘플 학생은 희망 사항까지 채워 두고, AI가 읽을 원본 성적 화면을 볼 수 있게 한다.
const SAMPLE_WISH = '웹·정보보호 쪽으로 취업하고 싶어요. 마지막 학기는 가볍게 듣고 싶어요.';
function syncSampleWish() {
  const w = $('wishes');
  if ($('src-sample').checked && !w.value.trim()) w.value = SAMPLE_WISH;
  if (!$('src-sample').checked && w.value === SAMPLE_WISH) w.value = '';
}
document.querySelectorAll('input[name="src"]').forEach((r) => r.addEventListener('change', syncSampleWish));
syncSampleWish();
$('viewSample').addEventListener('click', () => $('sampleSheet').showModal());
// 붙여넣기 경로를 바로 시험할 수 있게 가상 학생의 성적 텍스트(ON국민 표 형식)를 채운다. # 줄은 설명이라 뺀다.
$('fillSample').addEventListener('click', async () => {
  try {
    const text = await (await fetch('samples/kim-gookmin.transcript.txt')).text();
    $('paste').value = ['학년도 | 학기 | 이수구분 | 교과목 | 교과목명 | 분반 | 학점 | 등급 | 평점',
      ...text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))].join('\n');
    $('year').value = '3';
    $('term').value = '2';
  } catch {
    setStatus('error', '샘플 텍스트를 불러오지 못했어요.');
  }
});
$('sampleSheet').addEventListener('click', (e) => { if (e.target === $('sampleSheet')) $('sampleSheet').close(); }); // 바깥을 누르면 닫는다

// 희망 사항 예시 칩: 누르면 해당 칸에 문장을 붙인다.
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.wchip');
  if (!chip) return;
  const t = $(chip.closest('.wish-chips').dataset.for);
  const v = t.value.trim();
  if (!v.includes(chip.textContent)) t.value = v ? `${v}, ${chip.textContent}` : chip.textContent;
  t.focus();
});

$('consultGo').addEventListener('click', async () => {
  if (busy || !state.courses.length) return;
  setBusy(true);
  consultStatus('busy', 'AI가 진단 결과로 문의 메일과 상담 질문을 쓰고 있어요.');
  try {
    showConsult(await post('/api/consult', { courses: state.courses, ctx: state.ctx, plan: state.plan }, 30_000));
    consultStatus('', '');
  } catch (err) {
    showConsult(fallbackConsult());
    consultStatus('error', `${err.message} 대신 코드가 고른 질문으로 초안을 만들었어요.`);
  } finally {
    setBusy(false);
  }
});
$('mailSubject').addEventListener('input', syncMailto);
$('mailBody').addEventListener('input', syncMailto);
$('copyMail').addEventListener('click', async () => {
  const text = `제목: ${$('mailSubject').value}\n\n${$('mailBody').value}`;
  try { await navigator.clipboard.writeText(text); consultStatus('info', '메일을 복사했어요. 학교 메일에 붙여넣어 보내세요.'); }
  catch { $('mailBody').select(); consultStatus('info', '본문을 선택해 두었어요. Ctrl+C로 복사하세요.'); }
});

$('terms').addEventListener('change', (e) => {
  const el = e.target.closest('[data-f]'), row = e.target.closest('tr[data-i]');
  if (!el || !row) return;
  const c = state.courses[+row.dataset.i];
  if (el.dataset.f === 'credits') c.credits = Math.min(6, Math.max(1, Number(el.value) || c.credits));
  if (el.dataset.f === 'category') c.category = el.value;
  if (el.dataset.f === 'grade') c.grade = el.value;
  if (el.dataset.f === 'area') { c.area = el.value || null; c.areaGuess = false; }
  setStatus('info', '고친 내용은 다시 진단을 누르면 반영돼요.');
});

$('terms').addEventListener('click', (e) => {
  const row = e.target.closest('[data-del]')?.closest('tr[data-i]');
  if (!row) return;
  state.courses.splice(+row.dataset.i, 1);
  state.diag = E.diagnose(state.courses, state.ctx, data);
  renderLog();
  setStatus('info', '행을 지웠어요. 다시 진단을 누르면 반영돼요.');
});

// 캡처: 끌어 놓기와 고른 파일 표시
const drop = $('drop');
const showFiles = () => {
  const n = $('files').files.length;
  $('dropText').textContent = n ? `${[...$('files').files].map((f) => f.name).join(', ')} (${n}장)` : 'ON국민 성적 화면 캡처를 끌어 놓거나 눌러서 고르세요';
};
$('files').addEventListener('change', showFiles);
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  $('files').files = e.dataTransfer.files;
  showFiles();
});

$('ics').addEventListener('click', downloadIcs);
$('print').addEventListener('click', () => window.print());
$('reset').addEventListener('click', () => {
  store.set('jg.trialUsed', null);
  store.set('jg.passUntil', null);
  renderTrial();
  setStatus('info', '체험을 초기화했어요. 무료 진단 1회가 다시 생겼어요.');
});

// 인쇄할 때는 접힌 근거까지 모두 펼친다.
let closed = [];
addEventListener('beforeprint', () => { closed = [...document.querySelectorAll('#checks details:not([open])')]; closed.forEach((d) => (d.open = true)); });
addEventListener('afterprint', () => closed.forEach((d) => (d.open = false)));

// 계획의 브랜치 선은 화면에 들어올 때 한 번 그린다.
new IntersectionObserver((entries, io) => {
  if (entries.some((e) => e.isIntersecting)) { $('branch').classList.add('drawn'); io.disconnect(); }
}, { threshold: 0.2 }).observe($('branch'));

// ---------- 시작 ----------
// 헤더 로그인 버튼: 로그인한 상태면 이메일을 보여 준다(로그아웃은 login.html에서).
fetch('/api/auth/me').then((r) => r.json()).then(({ user }) => {
  if (!user) return;
  $('authText').textContent = user.email;
  $('authLink').setAttribute('aria-label', `${user.email}로 로그인됨, 계정 관리`);
  $('signupLink').hidden = true;
}).catch(() => { /* 로그인 서버가 없어도 진단은 된다 */ });

async function boot() {
  const get = async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(p); return r.json(); };
  try {
    const [req, cur, cats, cal, areas, s] = await Promise.all(['requirements', 'curriculum', 'categories', 'calendar', 'core_areas'].map((f) => get(`data/${f}.json`)).concat(get('sample/parsed.json')));
    data = { req, cur, cats, cal, areas };
    sample = s;
  } catch {
    setStatus('error', '졸업요건 데이터를 불러오지 못했어요. 새로고침해 주세요.');
    $('go').disabled = true;
    return;
  }
  renderTrial();
  renderHero();
}
boot();
