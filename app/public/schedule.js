// FR-04 학사 일정: calendar.json 이벤트를 진단 결과(trigger)로 거르고, D-day와 .ics를 만든다.
// 일반 <script>로 불러서 window.Schedule을 노출한다. DOM을 건드리지 않는 순수 함수라 Node에서도 테스트한다.
// 규칙은 docs/DATA.md의 일정 항목 기준: end는 마지막 날 포함, DTEND는 end+1일, 지난 일정(end<오늘)은 제외.
(() => {
  const DAY = 86400000;

  // 'YYYY-MM-DD'를 UTC 자정의 일수로 바꾼다. 시간대에 따라 하루가 밀리지 않게 문자열로 직접 계산한다.
  const dayNum = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
  };
  const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const compact = (iso) => iso.replaceAll('-', '');
  // 사용자의 오늘(로컬 날짜)을 'YYYY-MM-DD'로.
  const todayIso = (now = new Date()) =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // flags: { hasCreditShortage, hasNextSemesterCourses, isGraduatingSemester } (불리언)
  // always는 항상, none은 절대 통과하지 않는다. 모르는 trigger는 숨긴다.
  function upcoming(events, flags, now = new Date()) {
    const t = dayNum(todayIso(now));
    return events
      .filter((e) => dayNum(e.end) >= t && (e.trigger === 'always' || (e.trigger !== 'none' && flags?.[e.trigger] === true)))
      .sort((a, b) => dayNum(a.start) - dayNum(b.start) || dayNum(a.end) - dayNum(b.end));
  }

  // 시작일까지 남은 날수. 0 이하면 진행 중이다.
  const daysLeft = (e, now = new Date()) => dayNum(e.start) - dayNum(todayIso(now));

  // RFC 5545 TEXT 이스케이프: 역슬래시, 세미콜론, 쉼표, 줄바꿈.
  const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

  // 한 줄은 75옥텟을 넘기지 않는다. 넘으면 CRLF+공백으로 접는다. 한글(3바이트)이 중간에 잘리지 않게 글자 단위로 센다.
  function fold(line) {
    const enc = new TextEncoder();
    const out = [];
    let cur = '';
    let bytes = 0;
    for (const ch of line) {
      const n = enc.encode(ch).length;
      const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 앞 공백 1바이트가 있다
      if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch;
      bytes += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  }

  function buildIcs(events, now = new Date()) {
    const stamp = `${compact(todayIso(now))}T000000Z`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jolupgak//KO', 'CALSCALE:GREGORIAN'];
    for (const e of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}@jolupgak`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(e.start)}`,
        `DTEND;VALUE=DATE:${compact(isoOf(dayNum(e.end) + 1))}`,
        `SUMMARY:${escapeText(e.title)}`,
        `DESCRIPTION:${escapeText(e.reason)}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  globalThis.Schedule = { upcoming, daysLeft, buildIcs, escapeText, fold };
})();
