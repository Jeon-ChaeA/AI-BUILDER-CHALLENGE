# AGENTS.md

이 저장소를 읽거나 고치는 사람과 AI 에이전트를 위한 안내입니다. 서비스 소개와 실행 방법은 [README.md](README.md), 요구사항과 심사용 확인 순서는 [PRD.md](PRD.md)에 있습니다.

## 한눈에

- 졸업각: 국민대 소프트웨어학부 2023학번 졸업요건 진단 웹 서비스. 배포 https://kaib.sungblab.com
- 요구사항: PRD의 FR-01~FR-11. 요구사항별 구현 상태와 확인 순서는 PRD '최종 구현 및 검증', 실제 점검 기록은 [docs/QA.md](docs/QA.md)
- 실행 코드는 모두 `app/` 안에 있습니다. `research_notes/`와 `reports/`는 기획 리서치 자료입니다.

## 어디를 보면 되나

| 알고 싶은 것 | 볼 곳 |
|---|---|
| 졸업요건 판정 (FR-02) | `app/public/engine.js`의 `analyze`, `diagnose` |
| 졸업요건 데이터와 원문 근거 | `app/public/data/requirements.json`(항목마다 `evidence`: 원문 문구 + 출처 URL), [docs/DATA.md](docs/DATA.md) |
| AI 호출, 프롬프트, 응답 스키마 | `app/server.js`의 `PARSE_SYSTEM`·`PARSE_SCHEMA`, `ROADMAP_SYSTEM`·`ROADMAP_SCHEMA`, `CONSULT_SYSTEM`·`CONSULT_SCHEMA`, 공통 호출 `ask` |
| AI가 읽은 성적 정리 (FR-01) | `engine.js`의 `sanitizeCourses`, `gradeInfo` |
| 로드맵 검증 루프 (FR-03·08·09) | `server.js`의 `POST /api/roadmap` → `engine.js`의 `planTerms`, `tidyPlan`, `verifyPlan`, `repairPlan`, `vagueTerms`, `defaultPlan` |
| 학사 마감 일정과 .ics (FR-04) | `engine.js`의 `pickDates`, `app/public/schedule.js` |
| 학과 문의 메일 (FR-10) | `engine.js`의 `consultFacts` → `server.js`의 `POST /api/consult` |
| 화면과 페이월 (FR-05·06·07) | `app/public/index.html`, `app/public/app.js`, `app/public/styles.css`(`@media print`) |
| 회원가입·로그인 (FR-11) | `app/auth.js`, `app/db.js` |
| 테스트 | `app/test/engine.test.js`, `app/scripts/` |

## 지켜야 할 규칙

1. 졸업 판정은 코드만 합니다. AI 출력은 `sanitizeCourses`와 `verifyPlan`을 거친 뒤에만 씁니다. 같은 성적이면 판정 결과가 항상 같아야 합니다.
2. `engine.js`는 순수 함수만 둡니다. 서버와 브라우저가 같은 파일을 import하므로 DOM, 네트워크, Node 전용 API를 쓰지 않습니다.
3. 성적 데이터는 저장하지 않습니다. 서버 DB에는 회원 이메일, 비밀번호 해시, 세션만 둡니다.
4. 프롬프트와 API 키는 서버에만 둡니다. 클라이언트는 정해진 형식의 데이터만 보냅니다.
5. AI 기능마다 실패했을 때 쓰는 대체 경로가 있어야 합니다. 로드맵은 `defaultPlan`, 문의 메일은 코드가 고른 질문으로 만든 기본 문안, 샘플 학생의 성적 인식은 저장된 결과입니다.
6. 졸업요건 데이터를 바꾸면 `evidence`(원문 문구와 출처 URL)를 함께 고치고 `npm run validate:data`를 돌립니다.
7. 화면 문구는 해요체입니다. PRD의 버튼·탭 이름은 화면과 글자까지 같아야 합니다.

## 명령

```bash
cd app
npm install
npm run dev            # http://localhost:3000, .env에 GEMINI_API_KEY 필요
npm test               # 진단 엔진 24개 (무작위 성적 300건 포함)
npm run test:schedule  # 학사 일정·.ics 10개
npm run test:roadmap   # 로드맵 규칙 교차 검증 35개
npm run test:sample    # 샘플 학생 데이터 7개
npm run validate:data  # 졸업요건·교육과정 JSON 검사
```

main push와 PR마다 GitHub Actions(`.github/workflows/test.yml`)가 위 테스트 5종을 돌립니다.

## 범위

지원 범위는 소프트웨어학부 2023학번이고, 결제는 테스트 결제만 있습니다. 범위 밖 목록은 PRD §10, 알려진 한계는 README '한계'에 있습니다.
