# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain HTML, CSS and vanilla JavaScript served as static files by Node.js 22 + Express 5 (`app/`). No frontend framework or build step. Google Gemini API via `@google/genai` on the server. Deployed with Docker Compose on an OCI VM behind a subdomain with HTTPS.

## Users

국민대학교 소프트웨어학부 학부생, especially 3rd and 4th year students and students returning from a leave of absence (복학생). They use it before 수강신청·정정, before applying for 계절학기, before their graduating semester, and before meeting their 지도교수. They use it on a PC or a phone. The hackathon judges (Kookmin professors) and an AI auto-evaluator will also use the deployed page, starting with the sample student.

## Product Purpose

졸업각 tells a student whether they can graduate on their current path. The student uploads a capture of their ON국민 grade screen or pastes it as text. Then:

- AI turns it into a course table.
- Code compares that table against the department's graduation requirements.
- The page shows what is missing, with the source text for each finding.
- AI plans the remaining semesters, and code verifies the plan.
- The page lists the academic deadlines that apply to the student and offers them as an .ics file.

Success means the student knows within one visit what is missing, what to take next, and what to apply for by when.

## Positioning

Graduation requirements are scattered: the department homepage has them by admission year, ON국민 has the transcript, and the university homepage has the calendar. A general chatbot does not know them, and ON국민 only confirms graduation eligibility in the final semester.

졸업각 already holds the department's requirements, curriculum and calendar, so the student brings only their grades. Code does the judging, so the same input always gives the same result. Every finding cites the requirement's original sentence and source link (cs.kookmin.ac.kr).

## Operating Context

- Input is a capture image (PNG, JPG, WEBP) or text pasted from ON국민. Login is optional (email sign-up, FR-11) and every feature works without it. The student's school account is never used.
- Demo scope is fixed to 소프트웨어학부, 2023 admission year.
- A sample student ('김국민', synthetic) lets anyone try every feature without their own data.
- The first diagnosis per browser is free. After that a one-semester pass costs 9,900원, paid through a test payment with no real charge.
- The student's own grades are never stored on the server.
- The student can print the result as a report for advising.

## Capabilities and Constraints

- Features: FR-01 to FR-11 in `PRD.md`.
  - Required: input and course table, requirement diagnosis with warnings and sources, remaining-semester roadmap, personalized deadlines with .ics, free trial with hard paywall.
  - Optional: editing the table and re-running the diagnosis, printable report, a roadmap that follows the student's written wishes, a visible AI-draft → code-check → revision log, and an AI-written inquiry email and advisor questions built only from facts the code extracted, and optional email sign-up and login.
- Out of scope:
  - real payment
  - saving diagnosis history for logged-in users
  - automatic ON국민 scraping
  - other departments or admission years
  - double majors and transfers
  - 졸업인증 and 졸업작품
  - messenger or email notifications
- Results are guidance. The page must say that the final check belongs to the department office (학과 사무실).
- Requirement data comes from cs.kookmin.ac.kr and is still being collected and verified.

## Brand Commitments

- Name: 졸업각.
- It is an independent student-made service, not an official Kookmin service. Do not use the Kookmin logo, crest or official university colors, and do not imply endorsement. Refer to the school only as the data basis, e.g. "국민대 소프트웨어학부 2023학번 기준".
- Voice: friendly 해요체, like a senior student explaining, e.g. "전공필수 1과목이 아직 남았어요". Plain and concrete, no hype.

## Evidence on Hand

- Problem evidence cited in `PRD.md`:
  - Kookmin guidance tells students to confirm with the department office.
  - ON국민's graduation check is for the final semester.
  - The 척척학사 precedent at 수원대.
- Market numbers in `PRD.md` §9. Revenue figures there are estimates and labeled as such.
- Still missing: real user testimonials, usage numbers, verified requirement data and the real transcript format. Never fabricate any of these. Sample data must be labeled as synthetic.

## Product Principles

1. Code judges, AI assists. Never present an AI guess as a graduation verdict.
2. Show the source. Every warning carries the requirement's original sentence and a link.
3. Ask for nothing beyond the grades: no required login, no school password, no stored transcripts.
4. Every feature is reachable from the sample student in one click, so anyone, including an evaluator, can see the whole product.
5. Tell the student what to do next, not just what is wrong.
