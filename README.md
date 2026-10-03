# 졸업각

> 성적 화면 한 장이면 돼요. AI가 읽고 졸업요건과 한 줄씩 대조해서, 내 희망에 맞춘 남은 학기 계획과 학과 문의 메일까지 챙겨 드려요.

국민대학교 소프트웨어학부(2023학번) 학생용 졸업요건 진단 웹 서비스입니다. KOOKMIN AI BUILDER CHALLENGE 2026, 팀 **5조의마법사**.

- **배포 URL**: https://kaib.sungblab.com (로그인 없이 누구나 열림, 상태 확인 [`/api/health`](https://kaib.sungblab.com/api/health))
- **기획서**: [PRD.md](PRD.md) · 제품 원칙 [PRODUCT.md](PRODUCT.md) · 디자인 시스템 [DESIGN.md](DESIGN.md) · 데이터 근거 [docs/DATA.md](docs/DATA.md) · QA 기록 [docs/QA.md](docs/QA.md)

## 1분 체험

1. 배포 URL을 엽니다. 입력 카드는 **'샘플 학생'** 탭이 기본으로 골라져 있고 희망 사항도 채워져 있습니다.
2. **'진단 시작'**을 누릅니다. 진행판에 성적 인식(AI) → 졸업요건 판정(코드) → 남은 학기 계획(AI) → 계획 검증(코드)이 걸린 시간과 함께 차례로 표시됩니다.
3. 결과: 이수내역 표 → 졸업요건 진단(샘플 학생은 '컴퓨터네트워크' 미이수로 '조치 필요') → AI 수강 로드맵과 검증 기록 → 학사 마감 일정(.ics) → 학과에 물어볼 것(AI 문의 메일).
4. 한 번 더 '진단 시작'을 누르면 이용권 안내(9,900원)가 뜹니다. '테스트 결제하기(실제 청구 없음)'로 넘어가거나, 맨 아래 '체험 초기화'로 처음 상태로 돌아갑니다.

내 성적이 없어도 AI 인식을 직접 시험할 수 있습니다. '캡처 올리기' 탭의 **'시험용 샘플 캡처 내려받기'**로 받은 PNG를 다시 올리거나, '붙여넣기' 탭의 **'시험용 샘플 텍스트 넣기'**를 누르세요.

## 요구사항 → 화면 → 코드

PRD의 요구사항(FR)이 배포된 화면 어디에서 보이고, 어느 코드가 처리하는지입니다.

| FR | 화면에서 확인 | 처리 코드 |
|----|-------------|----------|
| FR-01 성적 입력과 이수내역 정리 (AI) | 입력 카드 세 탭 → '진단 시작' → '01 이수내역' 표, "총 N과목 · N학점" | `server.js` `POST /api/parse` (Gemini 구조화 출력) → `engine.js` `sanitizeCourses` → `app.js` `renderLog` |
| FR-02 졸업요건 진단과 위험 경고 | '02 졸업요건 진단'의 9개 항목, 원문과 cs.kookmin.ac.kr 출처 | `engine.js` `analyze`, `diagnose` → `app.js` `renderChecks` |
| FR-03 수강 로드맵 (AI 계획 + 코드 검증) | '03 수강 로드맵'의 학기별 과목·학점·이유 | `server.js` `POST /api/roadmap` → `engine.js` `planTerms`, `tidyPlan`, `verifyPlan`, `repairPlan`, `defaultPlan` |
| FR-04 학사 마감 일정 | '04 학사 마감 일정'의 D-day, '캘린더에 추가(.ics)' | `engine.js` `pickDates` → `schedule.js` `buildIcs` |
| FR-05 무료 체험 1회와 이용권 (하드페이월) | 상단 '무료 체험 1회 남음', 두 번째 진단의 이용권 창, '요금' 섹션 | `app.js` `renderTrial`, `openPaywall`, `diagnoseNow` |
| FR-06 이수내역 수정 후 다시 진단 | 이수내역 표의 칸 수정·행 삭제 → '다시 진단' | `app.js` `renderLog`(표 편집), `analyze` |
| FR-07 상담용 리포트 인쇄/PDF | '리포트 인쇄/PDF 저장' | `styles.css` `@media print` |
| FR-08 희망 사항을 반영한 AI 로드맵 | 로드맵 위 AI 요약, '희망 사항' + 'AI로 다시 짜기' | `server.js` `ROADMAP_SYSTEM`(희망 반영 규칙) → `app.js` `fetchPlan`, `renderPlan` |
| FR-09 AI 계획 검증 기록 공개 | 로드맵의 'AI 계획 검증 기록' | `server.js` `/api/roadmap`의 `trace` → `app.js` `renderPlan` |
| FR-10 AI 학과 문의 메일·상담 질문 | '05 학과에 물어볼 것' → 'AI로 문의 메일 쓰기', '메일 복사', '메일 앱으로 열기' | `engine.js` `consultFacts` → `server.js` `POST /api/consult` → `app.js` `showConsult` |
| FR-11 회원가입·로그인 (선택) | 상단 '로그인'·'회원가입' → `/login.html` | `auth.js`, `db.js` (bcrypt, httpOnly 세션 쿠키, SQLite) |

## 구조: 판정은 코드가, AI는 보조

```
성적 캡처/텍스트 ─▶ [AI] Gemini 인식 ─▶ [코드] sanitizeCourses: 표기 통일, 깨진 등급을 평점으로 복구
                                          │
                                          ▼
                  [코드] diagnose: 졸업요건 9개 판정 (같은 입력이면 항상 같은 결과, 원문·출처 첨부)
                                          │
희망 사항 ──────────▶ [AI] 남은 학기 로드맵 초안
                                          ▼
                  [코드] verifyPlan: 이미 들은 과목, 학기 학점 한도, 요건 충족, 연속 학기 검사
                        ├─ 통과 → 사용
                        ├─ 학점 계산만 어긋남 → repairPlan: 일반선택 빈칸을 옮기거나 더해 맞춤(같은 검증 통과)
                        ├─ 그 밖의 위반 → 위반 내용을 붙여 AI에 1회 재요청
                        └─ 그래도 실패 → defaultPlan(교육과정 순서 기본 계획, 같은 검증 통과)
                                          │
                  [코드] pickDates: 진단 결과에 맞는 학사 마감만 → .ics
                  [코드] consultFacts: 코드가 판정 못 하는 항목 → [AI] 학과 문의 메일·상담 질문
```

- **AI에 맡긴 일**: 사진·텍스트 읽기, 희망 사항을 계획으로 옮기기, 사람에게 보낼 문장 쓰기.
- **코드에 맡긴 일**: 졸업 판정, 학점 계산, 계획 검증, 일정 선택. AI가 틀려도 결과가 틀리지 않게 하려는 분리입니다.
- 진단 엔진 `app/public/engine.js`는 순수 함수로, 서버와 브라우저가 같은 파일을 씁니다. 그래서 '다시 진단'은 성적 인식(AI)을 다시 하지 않고, 판정은 브라우저에서 바로 계산하며 로드맵만 AI에 다시 요청합니다.
- 검증 과정(AI 초안 → 위반 → 수정안)은 화면의 'AI 계획 검증 기록'에 그대로 보입니다.

### AI 사용 방식

| 호출 | 엔드포인트 | 입력 | 출력(JSON 스키마) | 실패 시 |
|------|-----------|------|------------------|--------|
| 성적 인식 | `POST /api/parse` | 캡처 최대 5장 또는 텍스트 | `courses[]` (학기·코드·과목명·학점·이수구분·등급·평점) | 샘플 학생은 저장된 인식 결과로 진행, 그 외에는 안내 |
| 수강 로드맵 | `POST /api/roadmap` | 이수내역, 남은 요건, 개설 과목, 희망 사항 | AI: `plan[]`(학기별 과목·이유), `summary` → API 응답: `plan`, `source`(`ai`·`fallback`·`done`), `summary`, `trace`(검증 기록), `fallbackOk` | 학점 계산 위반은 코드 보정, 그 밖의 위반은 피드백 재요청 1회 → 기본 계획 |
| 학과 문의 | `POST /api/consult` | 코드가 고른 확인 사항 | `subject`, `body`, `questions[]` | 코드가 만든 기본 문안 |

- 모델: `gemini-flash-latest` (`GEMINI_MODEL`로 변경), `@google/genai`, 구조화 출력(`responseJsonSchema`), `thinkingLevel: LOW`.
- 프롬프트와 API 키는 서버에만 있습니다. 클라이언트는 정해진 형식의 데이터만 보냅니다.

## 비즈니스 모델

첫 화면 아래 **'요금'** 섹션과 이용권 안내 창에서 그대로 볼 수 있습니다. 자세한 근거는 [PRD §9](PRD.md#9-비즈니스-모델--시장성).

- **학생 하드페이월**: 첫 진단 1회 무료 → 한 학기 이용권 9,900원(진단 무제한, AI 다시 짜기, 학과 문의 메일, 상담 리포트). 수강신청·정정·계절학기마다 다시 진단할 이유가 생깁니다.
- **학과·학교 라이선스(향후)**: 졸업요건 문의 응대를 줄이고 지도교수 상담 리포트를 제공합니다.
- **원가**: 진단 1회에 Gemini 호출 2~3회. 판정은 코드가 해서 추가 비용이 없습니다.
- **확장**: 학과마다 다른 규칙이 병목입니다. AI가 요람 PDF에서 데이터 초안을 만들고 사람이 검수합니다. 핵심교양 영역표 59과목을 이 방식으로 1,161쪽 요람에서 추출했습니다.

## 안정성

- 입력 검증: 이미지 형식(PNG·JPEG·WEBP)·개수·크기, 텍스트 길이, 학년·학기 범위, 회원가입 이메일 형식·비밀번호 8자 이상. 잘못된 JSON에는 스택 대신 한국어 오류. 본문은 요청 제한을 통과한 뒤 경로별 크기(로그인 4KB, 로드맵·문의 256KB, 인식 15MB)까지만 읽고, 압축 본문은 받지 않습니다.
- 요청 제한: AI·로그인 API는 IP별로 앱에서 분당 60회로 제한하고, AI API는 앞단 nginx에서도 분당 30회(여유 30회)로 제한합니다. AI 호출 수는 하루 전체 상한(`AI_DAILY_MAX`, 기본 3,000회)도 둡니다.
- 보안 헤더: CSP(외부 자원은 글꼴·아이콘 CSS와 GSAP만 허용), `X-Frame-Options: DENY`, HSTS. 로그인은 비동기 bcrypt, 없는 계정도 같은 시간 동안 비교, 만료 세션은 로그인할 때 지웁니다.
- 타임아웃: AI 호출마다 서버 25~30초, 클라이언트 30~40초. 넘으면 안내 메시지.
- 개인정보: 성적은 저장하지 않습니다. 브라우저에는 체험·이용권 상태와 화면 설정만, 서버에는 회원 이메일·비밀번호 해시·세션만 둡니다.

## 실행

Node.js 22 이상이 필요합니다.

```bash
cd app
npm install
cp .env.example .env   # GEMINI_API_KEY 채우기
npm run dev            # http://localhost:3000
```

Docker:

```bash
cd app
docker compose up --build   # http://127.0.0.1:3300
```

## 테스트

```bash
cd app
npm test               # 진단 엔진 24개 (무작위 성적 300건 퍼즈 포함)
npm run test:schedule  # 학사 일정·.ics 10개
npm run test:roadmap   # 로드맵 규칙 참조 구현(lib/roadmap.mjs) 교차 검증 35개
npm run test:sample    # 샘플 학생 데이터 7개
npm run validate:data  # 졸업요건·교육과정 JSON 검사
```

main에 push하거나 PR을 열면 GitHub Actions(`.github/workflows/test.yml`)가 위 5종을 Node 22에서 자동으로 돌립니다.

## 폴더 구조

```
PRD.md, PRODUCT.md, DESIGN.md   기획서, 제품 원칙, 디자인 시스템
docs/DATA.md                    졸업요건 데이터의 출처와 해석
docs/QA.md                      배포 URL 기준 요구사항 점검 기록
app/
  server.js                     Express 서버, AI 호출 API 3개, 요청 제한
  auth.js, db.js                회원가입·로그인 (FR-11)
  public/
    index.html, app.js          화면과 화면 로직
    engine.js                   진단 엔진 (서버·브라우저 공용 순수 함수)
    schedule.js                 .ics 생성(줄 접기·이스케이프). 일정 고르기는 engine.js pickDates
    data/*.json                 졸업요건, 교육과정, 이수구분, 학사일정, 핵심교양 영역
    sample/                     샘플 학생의 성적 캡처와 인식 결과
    samples/                    시험용 샘플 텍스트(붙여넣기 탭)와 인식 결과
    gsap.js, theme.js           화면 연출, 다크 모드 토글
    i18n.js                     영어 전환(상단 EN 버튼). 기본은 한국어이고 한국어일 때는 화면을 바꾸지 않음
    sw.js, manifest.webmanifest PWA(앱 설치, 오프라인 첫 화면). 서비스 워커는 네트워크 우선이라 배포 즉시 새 파일을 씀
    login.html, terms.html, privacy.html
  test/engine.test.js           진단 엔진 테스트
  scripts/                      데이터 검사, 샘플 캡처 생성, 보조 테스트
  lib/roadmap.mjs               초기 로드맵 규칙 참조 구현 (테스트 교차 검증용)
  deploy.sh                     OCI VM 배포 스크립트
```

## 한계

- 소프트웨어학부 2023학번만 지원합니다. 복수전공·부전공·편입·조기졸업은 범위 밖입니다.
- 학부 인증, 졸업논문, 전공능력처럼 성적표만으로 판정할 수 없는 항목은 '학과 확인'으로 표시하고 문의 메일로 넘깁니다.
- 결제는 테스트 결제만 있습니다(PG 연동 없음).
- 결과는 참고용이며, 최종 확인은 학과 사무실에서 해야 합니다.

## 데이터 출처

- 국민대 소프트웨어학부 홈페이지(cs.kookmin.ac.kr)의 졸업요건과 교육과정
- 국민대 학사일정, 요람(핵심교양 영역)
- 샘플 학생 '김국민'은 팀원 성적 형식을 바탕으로 만든 가상 데이터입니다.

## 사용한 도구와 오픈소스

Claude Code(기획·개발), Google Gemini API(서비스 내 AI), Node.js·Express(MIT), @google/genai(Apache-2.0), bcryptjs·better-sqlite3(MIT), GSAP 3.12.5(GreenSock 표준 라이선스), Phosphor Icons(MIT), Pretendard(OFL), Playwright(개발용 샘플 캡처 생성).
