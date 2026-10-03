// 졸업각 메인페이지 목업. 샘플 학생 '김국민'(가상)의 진단 결과를 그린다.
// 졸업요건 수치는 research_notes/졸업각 데이터/requirements.md (cs.kookmin.ac.kr 2023학번 기준).
// ponytail: 진단 결과는 지금 SAMPLE에 미리 계산해 둔 값. 규칙 엔진이 붙으면 이 객체를 계산 결과로 바꾼다.

const SRC_DEPT = { href: 'https://cs.kookmin.ac.kr/major/graduated/13', label: '소프트웨어학부 2023학년도 입학생 졸업요건' };
const SRC_RULE = { href: 'https://www.kookmin.ac.kr/comm/menu/user/5c1cfd2865beb8179130a66c1bb20406/content/index.do', label: '국민대 학사안내 졸업요건 (학사규정 제95조)' };

const C = (n, c, cat, g, extra = {}) => ({ n, c, cat, g, ...extra });
const SAMPLE = {
  terms: [
    { code: '2023-1', label: '1학년 1학기', courses: [
      C('English Conversation Ⅰ', 2, '기초교양', 'A0'), C('글쓰기', 3, '기초교양', 'B+'),
      C('소프트웨어적사고', 3, '전공선택', 'A+', { req: 1 }), C('소프트웨어프로젝트Ⅰ', 3, '전공선택', 'B+', { req: 1 }),
      C('S-TEAM Class', 1, '전공선택', 'P', { req: 1 }), C('공학기초수학', 3, '전공선택', 'B0'),
      C('논리와비판적사고', 3, '핵심교양', 'A0', { area: '인문Ⅰ' }) ] },
    { code: '2023-2', label: '1학년 2학기', courses: [
      C('College English Ⅰ', 2, '기초교양', 'B+'), C('객체지향프로그래밍', 3, '전공선택', 'A0', { req: 1 }),
      C('응용통계학', 3, '전공선택', 'B0', { req: 1 }), C('유레카프로젝트', 1, '전공선택', 'A+', { req: 1 }),
      C('선형대수', 3, '전공선택', 'C+'), C('소프트웨어프로젝트Ⅱ', 3, '전공선택', 'B+'),
      C('현대사회와윤리', 3, '핵심교양', 'A0', { area: '인문Ⅱ' }) ] },
    { code: '2024-1', label: '2학년 1학기', courses: [
      C('자료구조', 3, '전공선택', 'B+', { req: 1 }), C('C++프로그래밍', 3, '전공선택', 'A0', { req: 1 }),
      C('논리회로설계', 3, '전공선택', 'B0'), C('웹클라이언트컴퓨팅', 3, '전공선택', 'A+'),
      C('말하기와토론', 3, '핵심교양', 'B+', { area: '소통' }), C('대학생활과진로', 2, '자유교양', 'P') ] },
    { code: '2024-2', label: '2학년 2학기', courses: [
      C('이산수학', 3, '전공선택', 'B0', { req: 1 }), C('컴퓨터구조', 3, '전공선택', 'C+', { req: 1 }),
      C('모바일프로그래밍', 3, '전공선택', 'A0'), C('데이터과학', 3, '전공선택', 'B+'),
      C('글로벌문화의이해', 3, '핵심교양', 'A0', { area: '글로벌' }), C('경영학원론', 3, '일반선택', 'B+') ] },
    { code: '2025-1', label: '휴학', leave: true },
    { code: '2025-2', label: '휴학', leave: true },
    { code: '2026-1', label: '3학년 1학기', courses: [
      C('운영체제', 3, '전공선택', 'B0', { req: 1 }), C('데이터베이스', 3, '전공선택', 'B+', { req: 1 }),
      C('컴퓨터네트워크', 3, '전공선택', 'F', { req: 1, link: 'cn' }), C('프로그래밍언어론', 3, '전공선택', 'B0'),
      C('SW 기술영어Ⅰ', 1, '전공선택', 'A0'), C('심리학의이해', 3, '일반선택', 'A0') ] },
    { code: '2026-2', label: '3학년 2학기', now: true, courses: [
      C('알고리즘', 3, '전공선택', '', { req: 1 }), C('컴파일러', 3, '전공선택', ''), C('인공지능', 3, '전공선택', ''),
      C('클라우드컴퓨팅', 3, '전공선택', ''), C('SW 기술영어Ⅱ', 1, '전공선택', ''), C('마케팅원론', 3, '일반선택', '') ] },
  ],
  // 정렬: 조치 필요 → 진행 중 → 통과 → 학과 확인. 코드는 요건마다 고정.
  checks: [
    { id: 'CHK-06', name: '필수 지정 과목', s: 'fail', have: 12, need: 15, unit: '과목', link: 'cn',
      note: '컴퓨터네트워크가 F예요. 1학기에만 열려서 2027-1학기에 꼭 다시 들어야 해요.',
      quote: '전공선택 과목 중 필수 지정 과목 15개 이수', src: SRC_DEPT,
      related: ['컴퓨터네트워크 2026-1 F', '알고리즘 2026-2 수강 중', '다학제간캡스톤디자인 2027-1 계획'] },
    { id: 'CHK-01', name: '총 이수학점', s: 'pending', have: 84, need: 136, unit: '학점',
      note: '계획대로면 2027-2학기에 136학점을 채워요.', quote: '총 학점 136학점', src: SRC_DEPT,
      related: ['지금 듣는 16학점 포함 시 100학점'] },
    { id: 'CHK-03', name: '핵심교양', s: 'pending', have: 12, need: 15, unit: '학점',
      note: '창의 영역 3학점이 비어 있어요. 2027-1학기 계획에 넣었어요.',
      quote: '[인문Ⅰ] [인문Ⅱ] [소통] [창의] [글로벌] 5개의 핵심역량 영역별 최소 3학점 이상 이수', src: SRC_DEPT,
      related: ['인문Ⅰ 3', '인문Ⅱ 3', '소통 3', '글로벌 3', '창의 0'] },
    { id: 'CHK-05', name: '전공 (전공선택)', s: 'pending', have: 57, need: 66, unit: '학점',
      note: '지금 듣는 전공 13학점이 끝나면 통과해요.',
      quote: '필수 41학점 + 전공선택 과목 중 25학점 이상 이수, 소계 66', src: SRC_DEPT, related: ['필수 지정 33학점', '그 외 전공 24학점'] },
    { id: 'CHK-08', name: '등록 학기', s: 'pending', have: 6, need: 8, unit: '학기',
      note: '지금 학기가 6학기째예요. 2027-2학기가 8학기째예요.', quote: '8학기 이상 등록한 자', src: SRC_RULE, related: ['휴학 2학기 제외'] },
    { id: 'CHK-02', name: '기초교양', s: 'pass', have: 7, need: 7, unit: '학점',
      note: '지정 3과목을 모두 들었어요.', quote: '기초교양 지정 3과목 모두 이수', src: SRC_DEPT,
      related: ['English Conversation Ⅰ', '글쓰기', 'College English Ⅰ'] },
    { id: 'CHK-04', name: '자유교양', s: 'pass', have: 2, need: 2, unit: '학점',
      note: '대학생활과진로 2학점으로 채웠어요.', quote: '자유교양 최저 2학점', src: SRC_DEPT, related: ['대학생활과진로 P'] },
    { id: 'CHK-07', name: '평점평균', s: 'pass', have: '3.42', need: '2.0', unit: '',
      note: '4.5 만점 기준이에요. P 과목은 빼고 F는 0점으로 넣었어요.', quote: '전학년 성적이 평점평균 2.0 이상인 자', src: SRC_RULE, related: ['84학점 기준'] },
    { id: 'CHK-09', name: '학부 인증, 졸업논문, 전공능력', s: 'skip',
      note: '자동으로 판정하지 않아요. 학과 사무실에서 확인해 주세요.',
      quote: '다음 역량기반 졸업 요건 중 택1. 졸업논문은 캡스톤디자인 결과보고서로 대체', src: SRC_DEPT,
      related: ['평점 3.5 이상이면 자동 인증', '캡스톤 결과보고서'] },
  ],
  plan: [
    { code: '2026-2', label: '3학년 2학기', now: true, load: 16,
      courses: [['알고리즘', 3, 'req'], ['컴파일러', 3], ['인공지능', 3], ['클라우드컴퓨팅', 3], ['SW 기술영어Ⅱ', 1], ['마케팅원론', 3]],
      why: '지금 듣는 학기예요. 끝나면 전공 66학점을 채워요.' },
    { code: '2027-1', label: '4학년 1학기', load: 19, link: 'cn',
      courses: [['컴퓨터네트워크', 3, 'retake'], ['다학제간캡스톤디자인', 3, 'req'], ['핵심교양 창의 영역', 3], ['소프트웨어공학', 3],
        ['웹서버컴퓨팅', 3], ['소프트웨어의실제', 2], ['SW 기술영어Ⅲ', 1], ['산업체특강', 1]],
      why: '컴퓨터네트워크와 캡스톤은 1학기에만 열려요. 학점이 꽉 차니 계절학기로 미리 덜어 두면 좋아요.' },
    { code: '2027-2', label: '4학년 2학기', load: 17,
      courses: [['소프트웨어아키텍처', 3], ['정보보호와시스템보안', 3], ['소프트웨어융합최신기술', 3], ['학부연구참여(UROP) Ⅱ', 2], ['일반선택 2과목', 6]],
      why: '남은 17학점을 채우면 총 136학점이 돼요.' },
  ],
  dates: [
    { title: '동계 계절학기 수강신청', start: '2026-11-24', end: '2026-11-26',
      why: '2027-1학기가 19학점으로 꽉 차요. 계절학기로 3~6학점을 미리 덜어 둘 수 있어요.' },
    { title: '2학기 성적 공시', start: '2026-12-15', end: '2026-12-28',
      why: '필수 과목인 알고리즘 성적을 확인하세요. 이의신청은 12.23~12.28이에요.' },
    { title: '2027-1학기 수강신청', start: '2027-02-11', end: '2027-02-24', link: 'cn',
      why: '컴퓨터네트워크 재수강과 캡스톤을 꼭 담으세요. 둘 다 1학기에만 열려요.' },
  ],
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const ICON = {
  pass: '<i class="ph-fill ph-check-circle done"></i>',
  fail: '<i class="ph-fill ph-x-circle done"></i>',
  pending: '<i class="ph ph-circle-dashed done"></i>',
  skip: '<i class="ph ph-minus-circle done"></i>',
};
const LABEL = { pass: '통과', fail: '조치 필요', pending: '진행 중', skip: '학과 확인' };
const status = (s) => `<span class="st" title="${LABEL[s]}">${ICON[s]}<i class="ph ph-spinner-gap spin"></i><span class="sr-only">${LABEL[s]}</span></span>`;
const metric = (k) => (k.need == null ? '' : `${k.have}/${k.need}${k.unit}`);
const linkAttr = (k) => (k.link ? ` data-link="${k.link}"` : '');

function renderHeroChecks() {
  $('heroChecks').innerHTML = SAMPLE.checks.map((k, i) => `
    <li class="check" data-s="${k.s}" style="--i:${i}"${linkAttr(k)} tabindex="0">
      ${status(k.s)}<span class="name">${esc(k.name)}</span><span class="metric">${k.s === 'skip' ? '학과 확인' : metric(k)}</span>
    </li>`).join('');
}

function renderFullChecks() {
  const n = (s) => SAMPLE.checks.filter((k) => k.s === s).length;
  $('tally').innerHTML = `
    <span class="bad"><i class="ph-fill ph-x-circle"></i>조치 필요 ${n('fail')}</span>
    <span class="mid"><i class="ph ph-circle-dashed"></i>진행 중 ${n('pending')}</span>
    <span class="ok"><i class="ph-fill ph-check-circle"></i>통과 ${n('pass')}</span>
    <span class="mid"><i class="ph ph-minus-circle"></i>학과 확인 ${n('skip')}</span>`;
  $('fullChecks').innerHTML = SAMPLE.checks.map((k, i) => {
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
            <a class="src" href="${k.src.href}" target="_blank" rel="noopener"><i class="ph ph-link-simple"></i>${esc(k.src.label)}</a>
          </blockquote>
          <ul class="related">${k.related.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>
      </details>
    </li>`;
  }).join('');
}

function renderGrass() {
  $('grass').innerHTML = SAMPLE.terms.map((t) => {
    const cells = t.leave ? '' : t.courses.map((c) => {
      const cls = t.now ? 'now' : c.g === 'F' ? 'f' : `l${Math.min(c.c, 3)}`;
      return `<span class="cell ${cls}" title="${esc(c.n)} ${c.c}학점${c.g ? ` ${c.g}` : ''}"></span>`;
    }).join('');
    return `<div class="gcol${t.leave ? ' leave' : ''}"><div class="gcells">${cells}</div><span class="glabel">${t.code.slice(2)}</span></div>`;
  }).join('');
}

const CATS = ['기초교양', '핵심교양', '자유교양', '전공선택', '일반선택'];
function renderTerms() {
  const done = SAMPLE.terms.filter((t) => !t.leave && !t.now);
  $('terms').innerHTML = done.map((t, ti) => {
    const earned = t.courses.reduce((s, c) => s + (c.g === 'F' ? 0 : c.c), 0);
    return `
    <details class="term"${ti === done.length - 1 ? ' open' : ''}>
      <summary><i class="ph ph-caret-right chev"></i><strong>${t.label}</strong><span class="grow mono muted">${t.code}</span><span class="num">${earned}학점</span></summary>
      <table class="course-table">
        <thead><tr><th>과목</th><th>학점</th><th>이수구분</th><th>성적</th></tr></thead>
        <tbody>${t.courses.map((c) => `
          <tr class="${c.g === 'F' ? 'is-f' : ''}"${c.link ? ` data-link="${c.link}"` : ''}>
            <td>${esc(c.n)}${c.req ? '<span class="req">필수</span>' : ''}${c.area ? `<span class="area">${c.area}</span>` : ''}</td>
            <td><input class="cell-edit" type="number" min="0" max="6" value="${c.c}" aria-label="${esc(c.n)} 학점"></td>
            <td><select class="cell-edit" aria-label="${esc(c.n)} 이수구분">${CATS.map((x) => `<option${x === c.cat ? ' selected' : ''}>${x}</option>`).join('')}</select></td>
            <td class="grade">${c.g}</td>
          </tr>`).join('')}</tbody>
      </table>
    </details>`;
  }).join('');
}

function renderPlan() {
  const nodes = SAMPLE.plan.map((p) => `
    <li class="node${p.now ? ' now' : ''}"${p.link ? ` data-link="${p.link}"` : ''}>
      <span class="dot"></span>
      <div class="node-card">
        <div class="node-head">
          <strong>${p.label}</strong><span class="term-code">${p.code}</span>${p.now ? '<span class="tag">지금 듣는 중</span>' : ''}
          <span class="load"><b>${p.load}</b>/19학점</span>
        </div>
        <ul class="chips">${p.courses.map(([n, c, k]) => `
          <li class="chip${k ? ` ${k}` : ''}"${k === 'retake' ? ' data-link="cn"' : ''}>${k === 'retake' ? '<i class="ph ph-arrow-counter-clockwise"></i>' : ''}${esc(n)}${k === 'retake' ? ' 재수강' : ''}<span class="c">${c}</span></li>`).join('')}
        </ul>
        <p class="why"><i class="ph ph-sparkle"></i>${esc(p.why)}</p>
      </div>
    </li>`).join('');
  $('branch').innerHTML = nodes + `
    <li class="node goal"><span class="dot"><i class="ph-fill ph-check"></i></span>
      <div class="node-card"><div class="node-head"><strong>2028년 2월 졸업</strong><span class="load"><b>136</b>/136학점</span></div></div>
    </li>`;
}

const DAY = 86400000;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const md = (iso) => `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}`;
function upcomingDates() {
  return SAMPLE.dates.filter((d) => new Date(`${d.end}T00:00`) >= today());
}
function renderDates() {
  $('dateList').innerHTML = upcomingDates().map((d) => {
    const left = Math.round((new Date(`${d.start}T00:00`) - today()) / DAY);
    return `
    <li class="date"${d.link ? ` data-link="${d.link}"` : ''}>
      <div><div class="dday">${left > 0 ? `D-${left}` : '진행 중'}</div><div class="when">${md(d.start)}~${md(d.end)}</div></div>
      <div><h3>${esc(d.title)}</h3><p>${esc(d.why)}</p></div>
    </li>`;
  }).join('');
}

function downloadIcs() {
  const ymd = (iso, plus = 0) => new Date(new Date(`${iso}T00:00Z`).getTime() + plus * DAY).toISOString().slice(0, 10).replaceAll('-', '');
  const events = upcomingDates().map((d, i) => [
    'BEGIN:VEVENT', `UID:jolupgak-${d.start}-${i}@jolupgak`, `DTSTAMP:${ymd(new Date().toISOString().slice(0, 10))}T000000Z`,
    `DTSTART;VALUE=DATE:${ymd(d.start)}`, `DTEND;VALUE=DATE:${ymd(d.end, 1)}`,
    `SUMMARY:${d.title}`, `DESCRIPTION:${d.why}`, 'END:VEVENT'].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jolupgak//KO', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: '졸업각-마감일정.ics' });
  a.click();
  URL.revokeObjectURL(a.href);
}

// 무료 체험 표시. 저장소가 막혀 있어도 화면은 돌아가야 한다.
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 무시 */ } },
};
function renderTrial() {
  const used = store.get('jg.trialUsed') === '1';
  $('trialText').textContent = used ? '무료 체험을 사용했어요' : '무료 체험 1회 남음';
  $('trial').classList.toggle('used', used);
}

function replay(el) {
  el.classList.remove('run');
  void el.offsetWidth;
  el.classList.add('run');
}

renderHeroChecks();
renderFullChecks();
renderGrass();
renderTerms();
renderPlan();
renderDates();
renderTrial();

$('intake').addEventListener('submit', (e) => {
  e.preventDefault();
  store.set('jg.trialUsed', '1');
  renderTrial();
  replay($('heroChecks'));
  replay($('fullChecks'));
  $('checks').scrollIntoView();
});
$('rerun').addEventListener('click', () => { replay($('fullChecks')); $('checks').scrollIntoView(); });
$('ics').addEventListener('click', downloadIcs);
$('print').addEventListener('click', () => window.print());
$('reset').addEventListener('click', () => { store.set('jg.trialUsed', null); renderTrial(); });

// 인쇄할 때는 접힌 근거까지 모두 펼친다.
let closed = [];
addEventListener('beforeprint', () => { closed = [...document.querySelectorAll('#checks details:not([open])')]; closed.forEach((d) => (d.open = true)); });
addEventListener('afterprint', () => closed.forEach((d) => (d.open = false)));

// 계획의 브랜치 선은 화면에 들어올 때 한 번 그린다.
new IntersectionObserver((entries, io) => {
  if (entries.some((e) => e.isIntersecting)) { $('branch').classList.add('drawn'); io.disconnect(); }
}, { threshold: 0.2 }).observe($('branch'));


// 상단바 로그인 상태. /api/auth/me로 확인해 게스트/로그인 UI를 전환한다.
(() => {
  const guest = document.getElementById('authGuest');
  const user = document.getElementById('authUser');
  console.log('[auth-ui] guest=', guest, 'user=', user);
  if (!guest || !user) {
    console.warn('[auth-ui] authGuest 또는 authUser 요소를 못 찾음 — index.html의 id 확인 필요');
    return;
  }

  function render(me) {
    const loggedIn = Boolean(me);
    console.log('[auth-ui] render loggedIn=', loggedIn, 'me=', me);
    guest.hidden = loggedIn;      // 로그인 → 로그인/회원가입 숨김
    user.hidden = !loggedIn;      // 로그인 → 이메일+로그아웃 표시
    if (loggedIn && me.email) document.getElementById('authEmail').textContent = me.email;
  }

  fetch('/api/auth/me')
    .then((r) => r.json())
    .then((d) => render(d.user))
    .catch((e) => { console.error('[auth-ui] /me 실패', e); render(null); });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    render(null);
  });
})();

