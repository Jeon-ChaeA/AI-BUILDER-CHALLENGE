# 수강 로드맵 AI 연결 가이드 (백엔드용 초안)

FR-03 "AI 계획 + 코드 검증"에서 **AI를 부르는 쪽**(`app/server.js`)이 붙일 프롬프트, 입력, JSON 스키마 초안이다. 검증과 기본 로드맵은 `app/lib/roadmap.mjs`가 이미 한다. `server.js`는 고치지 않았고, 아래를 보고 백엔드 담당이 붙인다.

## 흐름

```
학생(진단 결과)
  └─ planRoadmap({ student, data, askAi })            app/lib/roadmap.mjs
        ├─ describeRoadmapTask(student, data)  → AI에게 줄 입력 JSON (코드가 후보를 미리 거름)
        ├─ askAi({ task, ... })                 → Gemini 호출 (백엔드가 구현, 이 문서의 프롬프트·스키마)
        ├─ validateRoadmap(...)                 → 규칙 위반이 있으면 버림
        └─ 실패하면 buildDefaultRoadmap(...)    → 교육과정표 순서의 기본 로드맵
```

- Gemini 호출은 **로드맵당 1회**다. 재시도하지 않는다(PRD §9 원가: 진단 1회에 호출 2회 = 성적 인식 + 로드맵).
- 30초 안에 응답이 없으면 `planRoadmap`이 기본 로드맵으로 바꾼다(`timeoutMs`, 기본 30000).
- AI 응답은 믿지 않는다. 학점 합계는 코드가 다시 계산하고, 이름은 교육과정 이름으로 정리하고, 규칙을 어기면 통째로 버린다.

## 서버에 붙이는 방법 (예시)

`TASKS`에 `roadmap`을 하나 더 두고, `planRoadmap`에 `askAi`를 넘긴다. 아래는 예시이고 기존 `/api/ai/:task`의 Gemini 호출 방식(`responseJsonSchema`)을 그대로 따른다.

```js
import { planRoadmap, loadData } from './lib/roadmap.mjs';

const data = await loadData(new URL('./public/data', import.meta.url).pathname);

const ROADMAP_TASK = {
  system: ROADMAP_SYSTEM,   // 아래 "시스템 프롬프트"
  schema: ROADMAP_SCHEMA,   // 아래 "응답 스키마"
};

async function askRoadmapAi({ task }) {
  const r = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(task) }] }],
    config: {
      systemInstruction: ROADMAP_TASK.system,
      responseMimeType: 'application/json',
      responseJsonSchema: ROADMAP_TASK.schema,
      httpOptions: { timeout: 30_000 },
    },
  });
  return JSON.parse(r.text);
}

// 요청 처리 안에서 (student는 진단 엔진이 만든다. 모양은 app/lib/roadmap.mjs 맨 위 주석)
const result = await planRoadmap({ student, data, askAi: askRoadmapAi });
res.json(result); // { source: 'ai'|'default', roadmap, projectedTotal, shortfall, unplaced, fallbackReason, aiViolations }
```

- `planRoadmap`은 예외를 던지지 않는다. AI가 실패해도 기본 로드맵을 담아 돌려준다.
- 개인정보: `task`에는 과목 이름과 학점만 있고 이름·학번은 없다. 성적 원본은 보내지 않는다.

## AI에게 주는 입력 (`describeRoadmapTask`)

코드가 학생 상태에서 만든다. 이미 들은 과목, 개설 학기·수강 학년이 안 맞는 과목, 실전프로젝트(전공 66학점 조건부)는 **후보에서 미리 뺀다**. AI는 후보 안에서 고르기만 하면 된다. 김국민 기준 예시(후보 25개 중 앞의 3개만):

```json
{
  "terms": [
    { "term": "2027-1", "grade": 4, "creditLimit": 19 },
    { "term": "2027-2", "grade": 4, "creditLimit": 19 }
  ],
  "needs": {
    "totalCredits": 36,
    "majorElectiveCredits": 0,
    "coreLiberalCredits": 3,
    "freeLiberalCredits": 0,
    "missingCoreAreas": ["창의"]
  },
  "liberalArts": { "perTermMax": 8, "totalMax": 50, "earned": 21 },
  "candidates": [
    { "name": "컴퓨터네트워크", "credits": 3, "required": true, "retake": true, "eligibleTerms": ["2027-1"] },
    { "name": "다학제간캡스톤디자인", "credits": 3, "required": true, "eligibleTerms": ["2027-1"] },
    { "name": "빅데이터최신기술", "credits": 3, "required": false, "eligibleTerms": ["2027-1"] }
  ]
}
```

| 필드 | 뜻 |
|---|---|
| `terms[]` | 계획할 학기. 순서대로 채운다. `creditLimit`이 그 학기 학점 한도 |
| `needs.totalCredits` | 졸업까지 더 필요한 총 학점 |
| `needs.majorElectiveCredits`, `coreLiberalCredits`, `freeLiberalCredits` | 이수구분별 부족 학점 |
| `needs.missingCoreAreas` | 비어 있는 핵심교양 영역(있을 때만) |
| `liberalArts` | 교양 학기당 상한, 재학 중 상한, 지금까지 이수한 교양 학점 |
| `candidates[]` | 들을 수 있는 과목. `eligibleTerms`에 있는 학기에만 배치할 수 있다. `required`는 졸업요건 필수, `retake`는 다시 들어야 하는 과목, `oneOf`가 같은 과목은 하나만 |

## 시스템 프롬프트 (초안)

```
너는 국민대학교 소프트웨어학부 학생의 남은 학기 수강 계획을 짜는 도우미다.
입력 JSON의 terms에 나온 학기마다 들을 과목을 배치해서 JSON으로만 답한다.

규칙:
1. 과목은 candidates에 있는 이름을 그대로 쓴다. 목록에 없는 과목을 만들지 않는다.
2. 과목은 그 과목의 eligibleTerms에 있는 학기에만 넣는다.
3. 같은 과목을 두 번 넣지 않는다. oneOf가 같은 과목은 하나만 넣는다.
4. 학기마다 학점 합이 creditLimit을 넘지 않게 한다.
5. required가 true인 과목은 반드시 넣는다. retake가 true인 과목도 반드시 넣는다.
   한 학기에만 들어갈 수 있는 필수 과목을 먼저 배치하고, 나머지로 학기 부담을 비슷하게 나눈다.
6. needs를 채운다. 졸업까지 더 필요한 학점(totalCredits)을 계획 전체로 채우는 것이 목표다.
   - 전공선택 부족분(majorElectiveCredits)은 required가 false인 전공 과목으로 채운다.
   - 핵심교양과 자유교양은 과목 목록이 없으므로 슬롯으로 넣는다.
     예: { "slot": "핵심교양 창의", "category": "핵심교양", "credits": 3 }
   - 남는 학점은 전공 과목이나 일반선택 슬롯({ "slot": "일반선택", "category": "일반선택", "credits": 3 })으로 채운다.
7. 핵심교양과 자유교양 슬롯은 한 학기에 liberalArts.perTermMax 학점을 넘기지 않는다.
   교양 전체는 totalMax를 넘기지 않는다(earned를 더해서 계산한다).
8. why에는 그 학기를 그렇게 짠 이유를 해요체로 한두 문장 쓴다.
   예: "컴퓨터네트워크와 캡스톤은 1학기에만 열려서 이 학기에 넣었어요."
   입력에 없는 사실(성적, 교수, 시간표, 졸업 가능 여부)은 쓰지 않는다.
9. 과목의 학점은 쓰지 않는다. 슬롯만 credits를 쓴다.
```

규칙 1~7은 코드가 그대로 검증한다(`validateRoadmap`). 프롬프트를 고쳐도 검증 규칙은 바뀌지 않는다.

## 응답 스키마 (`responseJsonSchema`)

항목은 과목(`name`)이거나 슬롯(`slot`, `category`, `credits`)이다. 구조화 출력이 하나의 평평한 객체만 안정적으로 받으므로 선택 필드를 모두 열어 두었다. 쓰지 않는 칸에 `null`이나 빈 문자열이 와도 코드가 지운다.

```js
const ROADMAP_SCHEMA = {
  type: 'object',
  properties: {
    terms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string', description: "학기 코드. 입력 terms의 term과 같은 값, 같은 순서. 예: '2027-1'" },
          why: { type: 'string', description: '이 학기를 이렇게 짠 이유. 해요체 한두 문장' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: '과목이면 candidates의 이름' },
                slot: { type: 'string', description: '슬롯이면 이름. 예: 핵심교양 창의' },
                category: { type: 'string', enum: ['핵심교양', '자유교양', '일반선택'], description: '슬롯일 때만' },
                credits: { type: 'integer', description: '슬롯일 때만' },
              },
            },
          },
        },
        required: ['term', 'why', 'items'],
      },
    },
  },
  required: ['terms'],
};
```

## AI 응답 예 (김국민, 통과하는 계획)

```json
{
  "terms": [
    {
      "term": "2027-1",
      "why": "컴퓨터네트워크와 캡스톤은 1학기에만 열려서 이 학기에 넣었어요.",
      "items": [
        { "name": "컴퓨터네트워크" }, { "name": "다학제간캡스톤디자인" },
        { "name": "소프트웨어공학" }, { "name": "웹서버컴퓨팅" },
        { "name": "소프트웨어의실제" }, { "name": "SW기술영어Ⅲ" }, { "name": "산업체특강" },
        { "slot": "핵심교양 창의", "category": "핵심교양", "credits": 3 }
      ]
    },
    {
      "term": "2027-2",
      "why": "남은 학점을 전공과 일반선택으로 채우면 총 136학점이 돼요.",
      "items": [
        { "name": "소프트웨어아키텍처" }, { "name": "정보보호와시스템보안" },
        { "name": "소프트웨어융합최신기술" }, { "name": "학부연구참여(UROP)Ⅱ" },
        { "slot": "일반선택", "category": "일반선택", "credits": 3 },
        { "slot": "일반선택", "category": "일반선택", "credits": 3 }
      ]
    }
  ]
}
```

이 응답은 `app/scripts/test-roadmap.mjs`에서 실제로 통과하는 것을 확인했다(19학점, 17학점, 총 136학점).

## `planRoadmap` 결과 읽기

| `source` | 뜻 | 화면 |
|---|---|---|
| `ai` | AI 계획이 모든 검증을 통과해서 그대로 씀 | 로드맵 표시 |
| `default` | 기본 로드맵으로 바꿈. 이유는 `fallbackReason` | 로드맵 표시. "AI 계획을 쓰지 못해 기본 계획을 보여 드려요" 같은 안내를 붙이면 좋다 |

`fallbackReason`: `no-ai`(askAi 없음), `ai-error`(예외 또는 시간 초과, `aiError`에 메시지), `invalid`(규칙 위반, `aiViolations`에 목록), `shortfall`(규칙은 지켰지만 기본 로드맵보다 졸업 학점을 덜 채움).

화면에 낼 때 학기마다 `credits`(학기 학점 합계), `why`(추천 이유)가 있고 과목 항목의 `kind`(`required`, `retake`)로 필수·재수강 표시를 한다. `why`에는 AI가 쓴 문장이 들어가므로 HTML 이스케이프를 해야 한다.

`shortfall`이 0보다 크면 남은 학기로 졸업 학점을 다 채울 수 없다는 뜻이다. FR-02 진단의 "조치 필요" 안내와 같이 보여 주면 된다.

## 아직 정하지 못한 것

- Gemini 모델별 구조화 출력이 선택 필드를 어떻게 채우는지는 실제 호출로 확인하지 못했다(키 없이 작성). 코드가 `null`과 빈 문자열은 정리하지만, 첫 호출 때 응답 모양을 한 번 확인해야 한다.
- `student` 객체는 진단 엔진 결과에서 만들어야 한다. 모양은 `app/lib/roadmap.mjs` 맨 위 주석이 기준이고 아직 진단 엔진 담당과 맞추지 않았다.
- 프롬프트 문구는 초안이다. 실제 응답을 보고 `shortfall`, `invalid`로 떨어지는 비율을 확인해 가며 고친다.
