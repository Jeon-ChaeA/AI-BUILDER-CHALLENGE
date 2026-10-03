// 가상 학생 김국민의 성적 화면 캡처(public/sample/capture.png)를 parsed.json에서 만든다.
// ON국민 '전체학기 성적조회(학부)' 표 형식(docs/DATA.md)을 흉내 낸 HTML을 쓰고 Playwright로 찍는다.
// 실행: cd app && node scripts/make-sample.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const { courses } = JSON.parse(readFileSync(here('../public/sample/parsed.json'), 'utf8'));
const pts = { 'A+': '4.5', A0: '4.0', 'B+': '3.5', B0: '3.0', 'C+': '2.5', C0: '2.0', 'D+': '1.5', D0: '1.0', F: '0.0', P: '0.0' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const rows = courses.map((c, i) => {
  const [y, s] = c.term.split('-');
  return `<tr><td>${i + 1}</td><td>${y}</td><td>${s}학기</td><td>${esc(c.category)}</td><td>${esc(c.code ?? '')}</td>
    <td class="l">${esc(c.name)}</td><td>${String((i % 3) + 1).padStart(2, '0')}</td><td>${c.credits}</td><td>${esc(c.grade)}</td><td>${c.grade ? pts[c.grade] ?? '' : ''}</td></tr>`;
}).join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px 28px; font: 14px/1.4 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #333; background: #fff; width: 1040px; }
  h1 { font-size: 22px; font-weight: 400; margin: 0 0 14px; }
  .q { display: flex; gap: 18px; align-items: center; padding: 14px 18px; border: 1px solid #ddd; margin-bottom: 16px; }
  .q b { font-weight: 400; } .q span { background: #f3f3f3; padding: 6px 12px; }
  .sample { margin-left: auto; color: #c0392b; font-weight: 700; border: 2px solid #c0392b; padding: 4px 10px; }
  h2 { font-size: 16px; font-weight: 400; margin: 0 0 8px; } h2::before { content: ''; display: inline-block; width: 4px; height: 14px; background: #2bb5a0; margin-right: 8px; transform: skew(-20deg); }
  table { width: 100%; border-collapse: collapse; border-top: 2px solid #2bb5a0; }
  th { font-weight: 400; background: #fafafa; padding: 8px 4px; border-bottom: 1px solid #ddd; border-right: 1px solid #eee; }
  td { padding: 7px 4px; border-bottom: 1px solid #eee; border-right: 1px solid #f3f3f3; text-align: center; }
  td.l { text-align: left; padding-left: 10px; }
</style></head><body>
<h1>전체학기 성적조회(학부)</h1>
<div class="q"><b>학번</b><span>2023******</span><b>성명</b><span>김국민</span><b>소속</b><span>소프트웨어학부</span><span class="sample">졸업각 가상 학생 샘플</span></div>
<h2>학기별 성적</h2>
<table><thead><tr><th>순번</th><th>학년도</th><th>학기</th><th>이수구분</th><th>교과목</th><th>교과목명</th><th>분반</th><th>학점</th><th>등급</th><th>평점</th></tr></thead>
<tbody>
${rows}
</tbody></table></body></html>`;

const htmlPath = here('./sample-capture.html');
writeFileSync(htmlPath, html);
execFileSync('npx', ['playwright', 'screenshot', '--full-page', '--viewport-size=1100,800', `file:///${htmlPath.replace(/\\/g, '/')}`, here('../public/sample/capture.png')], { stdio: 'inherit', shell: process.platform === 'win32' });
