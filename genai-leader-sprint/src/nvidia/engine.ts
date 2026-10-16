/**
 * NVIDIA module engine: pure functions only (no React, no storage), so it is easy to test.
 * Honesty rules baked in:
 *  - "first attempt" accuracy is the number that matters; retries do not improve it.
 *  - mastery of a mistake needs correct answers on separate days (1 / 3 / 7 day review).
 *  - the readiness index is this app's own measure. It is NOT a pass probability.
 */
import { addDays, diffDays, stockholmDay } from "@/lib/dates";
import { hashStr, mulberry32, shuffle, uid } from "@/lib/rng";
import {
  DOMAINS, LEVELS, LETTERS, type AnswerRec, type Attempt, type Confidence, type DomainId, type Letter, type Level, type NvQuestion,
  type Session, type SessionKind,
} from "./types";

export type ById = Map<string, NvQuestion>;

/* ---------------- Sessions ---------------- */
export interface NewSession {
  kind: SessionKind;
  label: string;
  qids: string[];
  now: number;
  seen: Set<string>;
  mockId?: string;
  topic?: string;
  level?: Level;
  /** Absolute deadline (ms). Persisted so a reload or a closed tab cannot reset the clock. */
  deadline?: number;
}
export function makeSession(p: NewSession): Session {
  const id = uid("s");
  const order: Record<string, Letter[]> = {};
  for (const qid of p.qids) order[qid] = shuffle(LETTERS, mulberry32(hashStr(`${id}:${qid}`)));
  return {
    id, kind: p.kind, label: p.label, mockId: p.mockId, topic: p.topic, level: p.level,
    qids: p.qids, order, answers: {}, flags: [], hinted: [], timeMs: {}, startedAt: p.now, deadline: p.deadline,
    status: "active", cursor: 0, unseenAtStart: p.qids.filter((q) => !p.seen.has(q)).length,
  };
}

export const correctLetter = (q: NvQuestion): Letter => q.options.find((o) => o.correct)!.letter;
export const isCorrect = (q: NvQuestion, letter: Letter) => correctLetter(q) === letter;

function attemptFor(s: Session, q: NvQuestion, a: AnswerRec, first: boolean, now: number): Attempt {
  return {
    id: `${s.id}:${q.id}`, sessionId: s.id, qid: q.id, topic: q.topic, domain: q.domain, level: q.level,
    letter: a.letter, correct: isCorrect(q, a.letter), confidence: a.confidence, hintUsed: !!a.hintUsed,
    at: now, day: stockholmDay(now), first, mode: s.kind, mockId: s.mockId,
  };
}

/** Practice / review: grade immediately and lock the answer. */
export function submitAnswer(
  s: Session, q: NvQuestion, letter: Letter, now: number, seen: Set<string>, confidence?: Confidence,
): { session: Session; attempt: Attempt } {
  if (s.answers[q.id]?.submitted) throw new Error("already answered");
  const rec: AnswerRec = { letter, confidence, hintUsed: s.hinted?.includes(q.id), at: now, submitted: true };
  const session: Session = { ...s, answers: { ...s.answers, [q.id]: rec } };
  return { session, attempt: attemptFor(session, q, rec, !seen.has(q.id), now) };
}

/** Mock: store the choice without grading (it can still be changed until the exam is submitted). */
export function setMockAnswer(s: Session, qid: string, letter: Letter | null, now: number): Session {
  if (s.status !== "active") return s;
  const answers = { ...s.answers };
  if (letter === null) delete answers[qid];
  else answers[qid] = { letter, at: now, submitted: false };
  return { ...s, answers };
}

export function toggleFlag(s: Session, qid: string): Session {
  const flags = s.flags.includes(qid) ? s.flags.filter((x) => x !== qid) : [...s.flags, qid];
  return { ...s, flags };
}

export function markHinted(s: Session, qid: string): Session {
  return s.hinted?.includes(qid) ? s : { ...s, hinted: [...(s.hinted ?? []), qid] };
}

/** Close a session. For a mock this is where answers become graded attempts. */
export function finalize(
  s: Session, byId: ById, seen: Set<string>, now: number, status: "submitted" | "expired" = "submitted",
): { session: Session; attempts: Attempt[] } {
  if (s.status !== "active") return { session: s, attempts: [] };
  const attempts: Attempt[] = [];
  const answers: Record<string, AnswerRec> = {};
  for (const qid of s.qids) {
    const a = s.answers[qid];
    if (!a) continue;
    answers[qid] = { ...a, submitted: true };
    // practice answers already produced their attempt when they were submitted
    if (s.kind === "mock" && !a.submitted) {
      const q = byId.get(qid);
      if (q) attempts.push(attemptFor(s, q, a, !seen.has(qid), Math.min(now, s.deadline ?? now)));
    }
  }
  return { session: { ...s, answers, status, submittedAt: now }, attempts };
}

/** Exam deadline passed while the tab was closed or asleep: grade what was saved. */
export const isExpired = (s: Session, now: number) => s.status === "active" && !!s.deadline && now >= s.deadline;

/* ---------------- Question states and spaced review ---------------- */
export const REVIEW_STEPS = [1, 3, 7] as const;
export interface QState {
  qid: string;
  attempts: number;
  firstCorrect: boolean;
  lastCorrect: boolean;
  lastDay: string;
  /** null = not in mistake review. Otherwise how many review steps have been passed. */
  step: number | null;
  due: string | null;
  mastered: boolean;
}
export function buildQStates(attempts: Attempt[]): Map<string, QState> {
  const m = new Map<string, QState>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    let s = m.get(a.qid);
    if (!s) {
      s = { qid: a.qid, attempts: 0, firstCorrect: a.correct, lastCorrect: a.correct, lastDay: a.day, step: null, due: null, mastered: false };
      m.set(a.qid, s);
    }
    s.attempts++;
    s.lastCorrect = a.correct;
    s.lastDay = a.day;
    if (!a.correct) {
      s.step = 0;
      s.due = addDays(a.day, REVIEW_STEPS[0]);
      s.mastered = false;
    } else if (s.step !== null && s.due && a.day >= s.due) {
      // a correct answer only counts once the review is actually due: no cramming on one day
      s.step += 1;
      if (s.step >= REVIEW_STEPS.length) {
        s.mastered = true;
        s.due = null;
      } else s.due = addDays(a.day, REVIEW_STEPS[s.step]);
    }
  }
  return m;
}
export const dueQids = (states: Map<string, QState>, today: string) =>
  [...states.values()].filter((s) => s.due && s.due <= today && !s.mastered).map((s) => s.qid);
export const openMistakes = (states: Map<string, QState>) => [...states.values()].filter((s) => s.step !== null && !s.mastered);

export const seenSet = (attempts: Attempt[]) => new Set(attempts.map((a) => a.qid));

/* ---------------- Topic x level ladder ---------------- */
export interface Cell {
  topic: string;
  level: Level;
  total: number;
  seen: number;
  firstAttempts: number;
  firstCorrect: number;
  acc: number | null;
  cleared: boolean;
  mastered: number;
}
/** A cell is cleared when every question has been seen and at least 2/3 were right on the first try. */
export const CLEAR_ACC = 2 / 3;
export function ladder(attempts: Attempt[], bank: NvQuestion[]): Map<string, Cell> {
  const states = buildQStates(attempts);
  const firstTry = new Map<string, boolean>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) if (!firstTry.has(a.qid)) firstTry.set(a.qid, a.correct);
  const out = new Map<string, Cell>();
  for (const q of bank) {
    const k = `${q.topic}|${q.level}`;
    const c = out.get(k) ?? { topic: q.topic, level: q.level, total: 0, seen: 0, firstAttempts: 0, firstCorrect: 0, acc: null, cleared: false, mastered: 0 };
    c.total++;
    const ft = firstTry.get(q.id);
    if (ft !== undefined) {
      c.seen++;
      c.firstAttempts++;
      if (ft) c.firstCorrect++;
    }
    if (states.get(q.id)?.mastered) c.mastered++;
    out.set(k, c);
  }
  for (const c of out.values()) {
    c.acc = c.firstAttempts ? c.firstCorrect / c.firstAttempts : null;
    c.cleared = c.seen === c.total && (c.acc ?? 0) >= CLEAR_ACC;
  }
  return out;
}
export type CellStatus = "cleared" | "open" | "next" | "locked";
/** Soft gating: a level is only *recommended* once the one below is cleared. Nothing is blocked. */
export function cellStatus(cells: Map<string, Cell>, topic: string, level: Level): CellStatus {
  const c = cells.get(`${topic}|${level}`);
  if (c?.cleared) return "cleared";
  const i = LEVELS.indexOf(level);
  if (i === 0) return c && c.seen > 0 ? "open" : "next";
  const prev = cells.get(`${topic}|${LEVELS[i - 1]}`);
  if (!prev?.cleared) return "locked";
  return c && c.seen > 0 ? "open" : "next";
}

/* ---------------- Metrics ---------------- */
export interface Tally { c: number; t: number }
export const pct = (x: Tally) => (x.t ? Math.round((100 * x.c) / x.t) : 0);

export interface Score {
  total: number;
  answered: number;
  correct: number;
  pct: number;
  byDomain: Record<DomainId, Tally>;
  byTopic: Record<string, Tally>;
  byLevel: Record<Level, Tally>;
}
/** Unanswered questions count as wrong: that is how a timed exam is marked. */
export function scoreSession(s: Session, byId: ById): Score {
  const byDomain = Object.fromEntries(DOMAINS.map((d) => [d.id, { c: 0, t: 0 }])) as Record<DomainId, Tally>;
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, { c: 0, t: 0 }])) as Record<Level, Tally>;
  const byTopic: Record<string, Tally> = {};
  let correct = 0, answered = 0;
  for (const qid of s.qids) {
    const q = byId.get(qid);
    if (!q) continue;
    const a = s.answers[qid];
    const ok = !!a && isCorrect(q, a.letter);
    if (a) answered++;
    if (ok) correct++;
    byDomain[q.domain].t++; byLevel[q.level].t++;
    (byTopic[q.topic] ??= { c: 0, t: 0 }).t++;
    if (ok) { byDomain[q.domain].c++; byLevel[q.level].c++; byTopic[q.topic].c++; }
  }
  const total = s.qids.length;
  return { total, answered, correct, pct: total ? Math.round((100 * correct) / total) : 0, byDomain, byTopic, byLevel };
}

/** First-attempt accuracy per topic (only topics with at least `min` first attempts). */
export function topicAccuracy(attempts: Attempt[], min = 3) {
  const seen = new Set<string>();
  const t: Record<string, Tally> = {};
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (seen.has(a.qid)) continue;
    seen.add(a.qid);
    (t[a.topic] ??= { c: 0, t: 0 });
    t[a.topic].t++;
    if (a.correct) t[a.topic].c++;
  }
  return Object.entries(t).filter(([, v]) => v.t >= min).map(([topic, v]) => ({ topic, ...v, acc: v.c / v.t })).sort((a, b) => a.acc - b.acc);
}
export const weakTopics = (attempts: Attempt[], n = 3) => topicAccuracy(attempts).slice(0, n).map((x) => x.topic);

/** Calibration: how often "high confidence" answers were right (first attempts only). */
export function calibration(attempts: Attempt[]) {
  const res: Record<Confidence, Tally> = { low: { c: 0, t: 0 }, medium: { c: 0, t: 0 }, high: { c: 0, t: 0 } };
  for (const a of attempts) if (a.first && a.confidence) { res[a.confidence].t++; if (a.correct) res[a.confidence].c++; }
  return res;
}

/* ---------------- Question picking ---------------- */
export interface PickOpts { count: number; seed: string; states: Map<string, QState>; today: string; seen: Set<string> }
/** Priority: due mistakes, then unseen, then open mistakes, then everything else. Seeded so it is stable. */
export function pick(pool: NvQuestion[], o: PickOpts): string[] {
  const rng = mulberry32(hashStr(o.seed));
  const rank = (q: NvQuestion) => {
    const st = o.states.get(q.id);
    if (st?.due && st.due <= o.today && !st.mastered) return 0;
    if (!o.seen.has(q.id)) return 1;
    if (st && st.step !== null && !st.mastered) return 2;
    return 3 + (st?.attempts ?? 0);
  };
  const keyed = pool.map((q) => ({ q, r: rank(q), j: rng() })).sort((a, b) => a.r - b.r || a.j - b.j);
  return shuffle(keyed.slice(0, o.count).map((k) => k.q.id), rng);
}

/* ---------------- Mocks ---------------- */
export interface MockDef {
  id: string;
  n: number;
  name: string;
  blurb: string;
  /** Share of each difficulty level, in percent (sums to 100). */
  mix: Record<Level, number>;
}
export const MOCKS: MockDef[] = [
  { id: "m1", n: 1, name: "Mock 1: Baseline", blurb: "Gentle mix. Tells you where you really stand.", mix: { beginner: 20, easy: 45, medium: 35, hard: 0, legendary: 0 } },
  { id: "m2", n: 2, name: "Mock 2: Building", blurb: "Mostly medium, a taste of hard.", mix: { beginner: 0, easy: 30, medium: 50, hard: 20, legendary: 0 } },
  { id: "m3", n: 3, name: "Mock 3: Exam-like", blurb: "Closest to the exam's expected difficulty.", mix: { beginner: 0, easy: 15, medium: 50, hard: 35, legendary: 0 } },
  { id: "m4", n: 4, name: "Mock 4: Pressure", blurb: "Hard-heavy with some legendary stretch.", mix: { beginner: 0, easy: 0, medium: 35, hard: 45, legendary: 20 } },
  { id: "m5", n: 5, name: "Mock 5: Final dress rehearsal", blurb: "Harder than the exam is likely to be. If you hold up here, the real one should feel kinder.", mix: { beginner: 0, easy: 0, medium: 30, hard: 40, legendary: 30 } },
];
export const MOCK_BY_ID = new Map(MOCKS.map((m) => [m.id, m]));

/** Largest-remainder split of `n` according to percentages. */
export function split(n: number, shares: Record<string, number>): Record<string, number> {
  const keys = Object.keys(shares);
  const sum = keys.reduce((a, k) => a + shares[k], 0) || 1;
  const exact = keys.map((k) => ({ k, x: (shares[k] / sum) * n }));
  const out: Record<string, number> = Object.fromEntries(exact.map((e) => [e.k, Math.floor(e.x)]));
  let left = n - Object.values(out).reduce((a, b) => a + b, 0);
  for (const e of [...exact].sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)) || a.k.localeCompare(b.k))) {
    if (left-- <= 0) break;
    out[e.k]++;
  }
  return out;
}

/**
 * Build a 60-question mock: official domain weights (18/8/13/15/6) x the mock's level mix.
 * Prefers questions the learner has not seen; if a level runs short it borrows from the nearest level.
 */
export function buildMock(def: MockDef, bank: NvQuestion[], seen: Set<string>, seed: string, total = 60): string[] {
  const rng = mulberry32(hashStr(`${def.id}:${seed}`));
  const weights = Object.fromEntries(DOMAINS.map((d) => [d.id, d.weight]));
  const perDomain = total === 60 ? Object.fromEntries(DOMAINS.map((d) => [d.id, d.mockCount])) : split(total, weights);
  const chosen: string[] = [];
  for (const d of DOMAINS) {
    const need = perDomain[d.id];
    const quota = split(need, def.mix);
    const pool = bank.filter((q) => q.domain === d.id);
    const taken = new Set<string>();
    const take = (level: Level, n: number) => {
      const cands = pool.filter((q) => q.level === level && !taken.has(q.id))
        .map((q) => ({ q, r: seen.has(q.id) ? 1 : 0, j: rng() })).sort((a, b) => a.r - b.r || a.j - b.j);
      for (const c of cands.slice(0, n)) taken.add(c.q.id);
      return Math.min(n, cands.length);
    };
    let short = 0;
    for (const lv of LEVELS) short += quota[lv] - take(lv, quota[lv]);
    // borrow from the nearest level that still has questions
    for (let guard = 0; short > 0 && guard < 10; guard++) {
      for (const lv of [...LEVELS].sort((a, b) => Math.abs(LEVELS.indexOf(a) - 2) - Math.abs(LEVELS.indexOf(b) - 2))) {
        if (short <= 0) break;
        short -= take(lv, short);
      }
    }
    chosen.push(...taken);
  }
  return shuffle(chosen, rng);
}

/* ---------------- Readiness ---------------- */
export interface Readiness {
  index: number | null;
  band: "no-data" | "not-yet" | "building" | "close" | "ready";
  mock: number | null;
  accuracy: number | null;
  coverage: number;
  weakestDomain: DomainId | null;
  note: string;
}
/**
 * 50% recent mock score, 30% first-attempt accuracy on medium+ questions, 20% coverage of the bank.
 * It is a study-progress indicator. NVIDIA does not publish a passing score here, so there is no pass probability.
 */
export function readiness(sessions: Session[], attempts: Attempt[], byId: ById, bankSize: number): Readiness {
  const mocks = sessions.filter((s) => s.kind === "mock" && s.status !== "active").sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
  const recent = mocks.slice(-2).map((s) => scoreSession(s, byId));
  const mock = recent.length ? Math.round(recent.reduce((a, s) => a + s.pct, 0) / recent.length) : null;
  const seen = new Set<string>();
  let t = 0, c = 0;
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (seen.has(a.qid)) continue;
    seen.add(a.qid);
    if (a.level === "medium" || a.level === "hard" || a.level === "legendary") { t++; if (a.correct) c++; }
  }
  const accuracy = t >= 10 ? Math.round((100 * c) / t) : null;
  const coverage = bankSize ? Math.round((100 * seen.size) / bankSize) : 0;
  let weakestDomain: DomainId | null = null;
  if (recent.length) {
    const agg = Object.fromEntries(DOMAINS.map((d) => [d.id, { c: 0, t: 0 }])) as Record<DomainId, Tally>;
    for (const s of recent) for (const d of DOMAINS) { agg[d.id].c += s.byDomain[d.id].c; agg[d.id].t += s.byDomain[d.id].t; }
    weakestDomain = [...DOMAINS].filter((d) => agg[d.id].t).sort((a, b) => pct(agg[a.id]) - pct(agg[b.id]))[0]?.id ?? null;
  }
  if (mock === null) {
    return { index: null, band: "no-data", mock, accuracy, coverage, weakestDomain, note: "Take a mock to get a readiness index." };
  }
  const index = Math.round(0.5 * mock + 0.3 * (accuracy ?? mock) + 0.2 * coverage);
  const band = index >= 80 ? "ready" : index >= 65 ? "close" : index >= 50 ? "building" : "not-yet";
  const note = {
    ready: "Strong by this app's own measure. Keep reviewing mistakes; do not coast.",
    close: "Close. Repair the weakest domain and keep taking timed mocks.",
    building: "Building. Spend the next days on your weakest topics, not on re-reading what you know.",
    "not-yet": "Not there yet. That is normal this early: do the ladders, review mistakes, retake a mock in a few days.",
  }[band];
  return { index, band, mock, accuracy, coverage, weakestDomain, note };
}

/* ---------------- Small helpers used by the UI ---------------- */
export const daysUntil = (today: string, target: string) => diffDays(today, target);
export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
