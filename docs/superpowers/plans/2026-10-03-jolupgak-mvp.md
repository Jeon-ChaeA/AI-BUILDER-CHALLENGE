# 졸업각 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PRD FR-01~07을 목업 디자인 그대로 실제로 동작하게 만든다. 샘플 학생 한 번으로 모든 기능을 확인할 수 있어야 한다.

**Architecture:** `public/engine.js`(순수 함수)를 서버와 브라우저가 같이 쓴다. 서버는 Gemini 호출 2개(`/api/parse`, `/api/roadmap`)만 맡고, 로드맵은 엔진으로 검증한 뒤 실패하면 대체 계획을 쓴다. 화면은 기존 목업 렌더러에 계산값을 넣는다.

**Tech Stack:** Node 22, Express 5, @google/genai, 바닐라 JS, node:test

**Spec:** `docs/superpowers/specs/2026-10-03-jolupgak-mvp-design.md`

## Global Constraints

- 새 의존성 추가 없음. 프레임워크·빌드 단계 없음
- 기준: 소프트웨어학부 2023학번. 총 136, 기초교양 7, 핵심교양 15(영역별 3), 자유교양 2, 전공 66(필수 41), 평점 2.0, 8학기, 학기당 19학점, 교양 상한 50
- 상태 라벨: 통과 / 진행 중 / 조치 필요 / 학과 확인 (`pass`/`pending`/`fail`/`skip`)
- 문구는 해요체. 샘플은 '가상 학생'으로 표시. 성적은 서버에도 브라우저에도 저장하지 않음
- 이용권: 9,900원, `2027-02-28`까지. 무료 체험은 성공한 '진단 시작'에서만 차감

## Review Focus

1. **AI 인식 결과가 엉망일 때**(학점이 문자열, 없는 이수구분, 빈 배열): 서버가 행을 거르고 0개면 422를 보낸다. → Task 4에서 `sanitizeCourses` 테스트
2. **재수강 중인 F 과목**: 이전 F 성적은 평점에 남고, 요건은 '진행 중'으로 바뀐다. → Task 2 테스트
3. **이번 학기 성적 없이 캡처한 학생**(수강 중 0개): 계획은 다음 학기부터 짜고, 성적 공시 일정은 빠진다. → Task 3 테스트
4. **이미 요건을 다 채운 학생**: 계획 학기가 0개다. 화면에 "남은 요건이 없어요. 지금 학기를 잘 마치면 졸업할 수 있어요."를 띄우고 로드맵 호출을 생략한다. → Task 3 테스트(`planTerms`가 `[]`)
5. **localStorage 차단**(사생활 보호 모드): 페이월 상태 읽기·쓰기가 예외 없이 동작한다(목업 `store` 래퍼). → Task 6 브라우저 확인

---

### Task 1: 데이터 파일

**Files:** Create `app/public/data/requirements.json`, `curriculum.json`, `calendar.json` (`core_areas.json`은 백그라운드 수집 결과)

**Interfaces — Produces:**
- `requirements.json`
  - `{ label, total, liberalCap, minGpa, minSemesters, maxPerTerm, categories, coreAreas, coreAreaMin, basicRequired[], majorRequired[], checks{CHK-xx:{name,quote,src}}, sources{dept,rule} }`
  - `basicRequired`·`majorRequired` 항목 모양: `{ names[], codes[], credits, rec:'y-s', offered:'1'|'2'|'전학기' }`
- `curriculum.json`: `[{ name, code|null, credits, category, year, semester:'1'|'2'|'전학기', aliases? }]`
- `calendar.json`: `[{ title, start, end, rule:'major'|'seasonal'|'grades'|'nextReg'|'graduation', term?, extra? }]`

- [ ] research_notes의 JSON 블록과 표를 옮긴다. English Conversation과 College English는 변형마다 행을 나눈다. 구 과목명 별칭 3개를 넣는다.
- [ ] 커밋한다.

### Task 2: 엔진 — 정규화와 진단

**Files:** Create `app/public/engine.js`, `app/test/engine.test.js`. Modify `app/package.json` (`"test": "node --test"`)

**Interfaces — Produces:**
- `termNow(date) → 'YYYY-1'|'YYYY-2'`: 3~8월은 1학기, 9~12월은 2학기, 1~2월은 전년도 2학기
- `nextTerm(t)`, `ordinalOf(year, sem)`, `gradDate(term) → '2028년 2월'`
- `normalize(courses, data) → { eff[], all[] }`
  - `eff`: 과목별 유효 기록. `{ ...course, key, pts, earned, inGpa, inProgress, area, areaGuess, retaking }`
- `diagnose(courses, ctx, data) → { checks[9], summary{ earned, counted, prog, gpa, courseCount, termCount, failCount, fails } }`
- `data = { req, cur, cal, areas }`, `ctx = { ordinal, termNow }`

- [ ] 테스트 작성
  - 등급 표기 변형(A0/A°/A), P·N·F 처리
  - 재수강 중복 제거와 재수강 중인 F
  - 교양 50학점 상한, 택1 묶음
  - 꼬리표 붙은 과목명 매칭(`글쓰기(공학인증)`, `English Conversation II(ABEEK)`)
  - 샘플 학생의 체크별 상태(CHK-06 fail, CHK-01/03/05/08 pending, CHK-02/04/07 pass, CHK-09 skip)
- [ ] 테스트가 실패하는지 확인 → 구현 → 테스트 통과 → 커밋

### Task 3: 엔진 — 계획 검증, 대체 계획, 일정

**Files:** Modify `app/public/engine.js`, `app/test/engine.test.js`

**Interfaces — Produces:**
- `planTerms(courses, ctx, data) → string[]`
- `verifyPlan(plan, courses, ctx, data) → string[]` (위반 문장. 빈 배열이면 통과)
- `defaultPlan(courses, ctx, data) → plan`
- `pickDates({ diag, plan, courses, ctx, data, today }) → [{ title, start, end, why }]`
- `plan = [{ term, courses:[{ name, credits, category, area?, generic?, kind?:'req'|'retake' }], why }]`

- [ ] 테스트 작성
  - `verifyPlan`이 위반 5종을 각각 잡는지
  - 샘플의 `defaultPlan`이 위반 없이 통과하는지
  - 요건을 다 채운 학생이면 `planTerms`가 `[]`인지
  - 수강 중 과목이 없으면 `grades` 일정이 빠지는지
  - 지난 일정이 빠지는지
- [ ] 구현 → 테스트 통과 → 커밋

### Task 4: 서버 API

**Files:** Modify `app/server.js`, `app/test/engine.test.js` (`sanitizeCourses`는 engine.js에 둔다)

**Interfaces:** `POST /api/parse {text?, files?} → {courses}`, `POST /api/roadmap {courses, ctx} → {plan, source}`. IP당 분당 10회, 넘으면 429.

- [ ] `sanitizeCourses(raw) → courses` 테스트(잘못된 행 제거, 학점 숫자 변환, 등급 trim) → 구현
- [ ] 인식 프롬프트·스키마, 로드맵 프롬프트·스키마, 25초 예산 안에서 1회 재시도, 실패하면 `defaultPlan`
- [ ] 샘플 이미지로 실제 Gemini 호출을 확인하고 응답 시간을 잰다 → 커밋

### Task 5: 샘플 학생 자료

**Files:** Create `app/public/sample/capture.png`, `app/public/sample/parsed.json`, `app/scripts/sample.html`(이미지 원본)

- [ ] 목업의 김국민 학기 데이터와 실제 핵심교양 과목명으로 `parsed.json`을 만든다.
- [ ] ON국민 표 형식을 흉내 낸 HTML을 Playwright로 PNG로 렌더링한다.
- [ ] `/api/parse`에 PNG를 보내 `parsed.json`과 비교한다(과목 수, 학점 합). 커밋한다.

### Task 6: 화면 연결

**Files:** Modify `app/public/app.js`, `index.html`, `styles.css`

- [ ] 결과 섹션은 처음에 hidden. hero 미리보기는 `parsed.json`과 `defaultPlan`으로 계산한다.
- [ ] 입력 3종(샘플, 캡처 최대 5장·드래그 앤 드롭, 붙여넣기). 진행 상태와 오류 문구.
- [ ] 페이월 `<dialog>`, 테스트 결제, 상단 이용권 표시, 체험 초기화.
- [ ] 이수내역 표 수정(학점, 이수구분, 핵심교양 영역, 행 삭제) → 다시 진단(체험 차감 없음).
- [ ] 제목·요약 숫자를 계산값으로 바꾸고 계획 출처(ai/fallback)를 표시한다. .ics와 인쇄도 계산값으로.
- [ ] 브라우저에서 확인한다.
  - 샘플 → 결과 → 두 번째 진단에서 페이월 → 결제 → 결과
  - 표 수정 → 다시 진단
  - .ics, 인쇄, 모바일 폭, 다크 모드
  - Gemini 키가 없을 때 저장본으로 진행되는지
- [ ] 커밋한다.

### Task 7: 마무리

- [ ] 브랜치 전체 코드 리뷰(서브에이전트 1회) → 지적 사항 반영
- [ ] `node --test` 전체 통과, 배포용 Dockerfile에 `public/` 포함 확인 → 커밋
