// 샘플 학생 김국민(public/samples) 검사. 사용: npm run test:sample
// 성적 텍스트와 인식 결과가 같은지, 목업(app.js의 SAMPLE)과 숫자가 맞는지, 교육과정 규칙을 어기지 않았는지 본다.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findCourse, loadData } from '../lib/roadmap.mjs';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const data = await loadData(join(pub, 'data'));
const grades = JSON.parse(readFileSync(join(pub, 'data', 'categories.json'), 'utf8')).grades;
const parsed = JSON.parse(readFileSync(join(pub, 'samples', 'kim-gookmin.parsed.json'), 'utf8'));
const text = readFileSync(join(pub, 'samples', 'kim-gookmin.transcript.txt'), 'utf8');
const rows = parsed.rows;
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };
const sum = (list) => list.reduce((s, r) => s + r.credits, 0);
const done = rows.filter((r) => !r.inProgress);
const earned = done.filter((r) => r.grade !== 'F'); // F는 학점 미인정

t('성적 텍스트를 읽은 결과가 인식 결과 rows와 같다', () => {
  const fromText = text.split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
    const [year, term, category, code, name, section, credits, grade, gpa] = l.split('|').map((x) => x.trim());
    return { year: +year, semester: +term.replace('학기', ''), category, code: code || null, name, section, credits: +credits,
      grade: grade || null, gpa: gpa === '' ? null : +gpa, inProgress: grade === '' };
  });
  assert.deepEqual(fromText, rows);
});
t('성적 환산: 평점 열이 등급 환산표와 같다', () => {
  for (const r of done) assert.equal(r.gpa, grades.points[r.grade] ?? 0, `${r.name} ${r.grade}`);
});
t('목업 숫자: 취득 84학점, 수강 중 16학점, 평점 3.42', () => {
  assert.equal(sum(earned), 84);
  assert.equal(sum(rows.filter((r) => r.inProgress)), 16);
  const g = done.filter((r) => r.grade !== 'P'); // P는 평점에서 빼고 F는 0점으로 넣는다
  assert.equal((sum(g.map((r) => ({ credits: r.credits * r.gpa }))) / sum(g)).toFixed(2), '3.42');
});
t('목업 숫자: 이수구분별 학점', () => {
  const by = (c) => sum(earned.filter((r) => r.category === c));
  assert.deepEqual([by('기초교양'), by('핵심교양'), by('자유교양'), by('전공선택')], [7, 12, 2, 57]);
});
t('목업 숫자: 등록 6학기(휴학 2학기 제외), 필수 지정 12/15', () => {
  assert.equal(new Set(rows.map((r) => `${r.year}-${r.semester}`)).size, 6);
  assert.deepEqual(parsed.intake.leaveTerms, ['2025-1', '2025-2']);
  const groups = new Set();
  for (const item of data.requirements.requiredCourses.items) {
    const hit = earned.some((r) => findCourse(data, { name: r.name, code: r.code })?.name === item.name);
    if (hit) groups.add(item.oneOf ?? item.name); // 택1 그룹은 하나로 센다
  }
  assert.equal(groups.size, 12);
  assert.ok(!rows.some((r) => r.name === '컴퓨터네트워크' && r.grade !== 'F'), '컴퓨터네트워크는 F');
});
t('교육과정 규칙: 개설 학기와 수강 학년을 지켰다', () => {
  const termIndex = [...new Set(rows.map((r) => `${r.year}-${r.semester}`))]; // 등록 순서
  let checked = 0;
  for (const r of rows) {
    const c = findCourse(data, { name: r.name, code: r.code });
    if (!c) continue; // 교양 과목은 교육과정에 없다
    checked++;
    const grade = Math.ceil((termIndex.indexOf(`${r.year}-${r.semester}`) + 1) / 2);
    assert.ok(c.offered === 'all' || c.offered === String(r.semester), `${r.name} 개설 학기`);
    // 필수과목은 졸업요건표의 year가 확정이고, 나머지는 스마트멘토의 years 범위를 쓴다.
    const [lo, hi] = c.required ? [c.year, c.year] : c.years;
    assert.ok(grade >= lo && grade <= hi, `${r.name} ${grade}학년`);
    assert.equal(r.credits, c.credits, `${r.name} 학점`);
  }
  assert.ok(checked >= 28, String(checked));
});
t('이름만 있는 과목(코드 없음)도 교육과정과 매칭된다', () => {
  const noCode = rows.filter((r) => !r.code);
  const matched = noCode.filter((r) => findCourse(data, { name: r.name }));
  assert.equal(matched.length, 13);
  // 매칭되지 않는 나머지는 교육과정에 없는 교양·일반선택 과목뿐이어야 한다.
  assert.ok(noCode.filter((r) => !matched.includes(r)).every((r) => ['핵심교양', '자유교양', '일반선택'].includes(r.category)));
});

console.log(`${n}개 통과`);
