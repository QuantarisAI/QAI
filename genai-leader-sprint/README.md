# Certification practice: GenAI Leader Sprint + NVIDIA NCA-GENL prep

Two independent practice apps in one site: the original 10-day sprint for the **Google Cloud Generative AI Leader** certification (below) and, under `/nvidia`, **NCA-GENL Prep** for the **NVIDIA-Certified Associate: Generative AI LLMs** exam (see the NVIDIA section). `/certifications` is the hub.

## Google: GenAI Leader Sprint

Independent 10-day practice app for the **Google Cloud Generative AI Leader** certification. Single user, no login, no cloud, no API keys. Progress lives in your browser's IndexedDB.
Not affiliated with or endorsed by Google. Questions are original practice items, not real or leaked exam questions.

## Start

```bash
cd genai-leader-sprint
npm install
npm run dev          # http://localhost:3000
# or: npm run build && npm start
```

Checks: `npm run check` (types, lint, all unit tests, both bank validations). Browser checks (needs the built app running and Chromium): `npm run build && npm start -- -p 3100` then `npm run e2e` (37 checks, including 375px mobile layout).
Rebuild the bank from `content/` with `npm run bank:build`. `.env.example` documents that no configuration is needed; the optional AI-generation flag is **not implemented**.

## NVIDIA: NCA-GENL Prep (`/nvidia`)

Built for the NVIDIA-Certified Associate: Generative AI LLMs exam (per [NVIDIA's page](https://www.nvidia.com/en-us/learn/certification/generative-ai-llm-associate/), read 2026-10-16: 50 to 60 multiple-choice questions, 1 hour, five weighted areas: Core ML and AI 30%, Data Analysis 14%, Experimentation 22%, Software Development 24%, Trustworthy AI 10%). Default exam date 28 Nov 2026, plan start 19 Oct 2026; both editable in Settings.

- **20 topics x 5 levels** (Beginner, Easy, Medium, Hard, Legendary, in ascending difficulty): 300 original questions, 3 per topic and level, every option explained. A level is *cleared* at 2/3 right on the first try with all questions seen; it is a recommendation, not a lock.
- **5 timed mocks** (60 questions, 60 minutes) with the official domain weights (18/8/13/15/6 questions), getting harder from Mock 1 to Mock 5. The deadline is saved: reload or a closed tab does not reset the clock; an expired mock is graded on reopen.
- **40-day roadmap** (19 Oct to 27 Nov; 2 h weekdays, 3 h weekends), today's task, mistake notebook with 1/3/7-day reviews, bookmarks, readiness index (50% recent mocks, 30% first-try accuracy on medium and up, 20% coverage).
- Backup/restore, validated whole and applied in one transaction. Nothing leaves the browser.

Honest limits: all 300 questions are **original, unreviewed drafts** (`review: draft_unverified`); a few may be wrong or arguable. Numeric answers were recomputed independently. Product facts (NeMo Guardrails rail types, Triton dynamic batching, TensorRT-LLM in-flight batching and paged KV cache, NeMo Curator dedup stages, NIM) were checked against NVIDIA docs on 2026-10-16 (see the in-app Syllabus). The readiness index is this app's own measure, **not a pass probability**; the exam page lists no passing score. Answers ship to the browser, so this is not a secure test. Not affiliated with NVIDIA.

Bank quality gates (`npm run bank:validate`): unique ids and text, exactly one correct option, every option explained, 3+ questions per topic and level, correct option the longest in under 40% of questions (currently 25%, chance level), correct position balanced across A/B/C/D.

## Site safety ("disable the site on an attack")

See **[SECURITY.md](SECURITY.md)**: what it can and cannot do on a static GitHub Pages site, the layers (build-time CSP, in-page detectors, remote kill switch, watchdog + lockdown workflows), and how to switch the site off or on by hand.

Browser checks for the NVIDIA module and the lockdown: build with `npm run build:static`, serve `out/` (for example `cd out && python3 -m http.server 3199`), then `BASE=http://localhost:3199 node e2e/nvidia.mjs`.

## What is in it (Google app)

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
