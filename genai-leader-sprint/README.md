# GenAI Leader Sprint

Independent 10-day practice app for the **Google Cloud Generative AI Leader** certification. Single user, no login, no cloud, no API keys. Progress lives in your browser's IndexedDB.
Not affiliated with or endorsed by Google. Questions are original practice items, not real or leaked exam questions.

## Start

```bash
cd genai-leader-sprint
npm install
npm run dev          # http://localhost:3000
# or: npm run build && npm start
```

Checks: `npm run check` (types, lint, 47 unit tests, bank validation). Browser checks (needs the built app running and Chromium): `npm run build && npm start -- -p 3100` then `npm run e2e` (37 checks, including 375px mobile layout).
Rebuild the bank from `content/` with `npm run bank:build`. `.env.example` documents that no configuration is needed; the optional AI-generation flag is **not implemented**.

## What is in it

Dashboard (Stockholm-time countdown, today's task, missed work carried over, per-domain progress, first-attempt / unseen-no-hint / repeat accuracy, due reviews, readiness targets) · Diagnostic (6/7/4/3) · Learn (28 objective lessons, sets of up to 10, hints, sources) · Practice (filters, mixed 6/7/4/3, labelled weak-area drills) · Exam (3 reserved mocks, 90-minute persisted deadline, flags, navigator, final review, auto-submit on expiry, even when reopened later) · Results · Mistake notebook (includes low-confidence correct answers; 1/3/7-day reviews) · 14 revision cards · Settings (dates, minutes, English/Hinglish principles, import/export, backup/restore, typed-confirmation reset).

Design choices: option positions are shuffled per session but graded by stable option identity; mastery needs good answers to *different* questions on *separate* days (3+ distinct questions tried, otherwise "insufficient evidence"); repeat attempts never change first-attempt accuracy; reserved mock questions are excluded from practice and review until that mock is first submitted; repeated mocks are labelled repeated; imports are validated whole and rejected atomically and go into a separate practice-only set; restore is a single transaction. Readiness targets (two unseen mocks ≥85%, each domain ≥80%, objective coverage) are this app's goals, **not** Google's pass mark or a probability.

## What was verified, and what was not (read this)

| Item | Status |
|---|---|
| Certification landing page | **Read.** Confirms format, four areas, sample-question caveat. |
| Official exam guide PDF, study guide PDF | **Not read.** The sandbox proxy returned 403. |
| Google Cloud product documentation | **Not read** (blocked). All product statements come from general knowledge. |
| Official objective identifiers | **Unknown.** Objectives `F1..B5` are this app's own checklist. |
| Question content | **360 original drafts, none verified against a source, no expert review.** Every item is `draft_unverified`; 0 carry a source id; verification date is empty. Terminology (Gemini Enterprise Agent Platform, Agent Search, Agent Studio, Model Garden; no "Model Builder") follows the brief, not the guide. |
| Lessons and cards | Unverified drafts. |
| Code | 47 unit tests, lint, typecheck, production build, 37 browser checks all pass. |

**Known unresolved issues**
1. **Educational accuracy is unestablished.** Before relying on the bank, read the official guide and docs and review each item; then fill `source_ids`, `verification_date` and official objective IDs in `content/` and set `review_status`.
2. **Answer-length tell is reduced, not removed.** Correct option is the longest in 49% of questions (random ≈25%) and shortest in 26%. The build trims/alternates wording to push toward uniform, but distractors are often shorter. Treat length as no clue.
3. Hinglish text exists only for the decision principle, not full explanations.
4. A static client-side bank is not an anti-cheating boundary; answers are visible to anyone who inspects the page.
5. AI-assisted generation is not implemented.
6. Next.js 16 differs from older versions; this was built and verified against it, but `node_modules/next/dist/docs` was only consulted for routing basics.

## Layout

`src/lib` engine, validation, IndexedDB, store · `src/app`, `src/components` UI · `src/data` generated `bank.json`/`meta.json` (companion metadata keyed by id), objectives, sources, lessons, cards · `content/` authored questions · `scripts/` build and validate · `docs/COVERAGE.md`, `docs/SOURCES.md` generated reports · `tests/`, `e2e/`.
Export from Settings produces the base contract only; metadata stays in `meta.json`.
