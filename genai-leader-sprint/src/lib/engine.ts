import { addDays, diffDays, stockholmDay } from "./dates";
import { hashStr, mulberry32, shuffle, uid } from "./rng";
import {
  ALLOC_MOCK,
  DOMAINS,
  LETTERS,
  MOCK_MINUTES,
  type AnswerRec,
  type AppQuestion,
  type Attempt,
  type Confidence,
  type Domain,
  type Letter,
  type Session,
  type SessionKind,
} from "./types";
import { OBJECTIVES } from "@/data/objectives";

export const REVIEW_INTERVALS = [1, 3, 7] as const;

/* ------------------------------------------------------------------ */
/* Option order & grading                                               */
/* ------------------------------------------------------------------ */
export function buildOrder(sessionId: string, qkeys: string[]): Record<string, Letter[]> {
  const out: Record<string, Letter[]> = {};
  for (const k of qkeys) out[k] = shuffle(LETTERS, mulberry32(hashStr(`${sessionId}:${k}`)));
  return out;
}
export const isCorrect = (q: AppQuestion, letter: Letter | undefined | null) =>
  !!letter && q.options.some((o) => o.option_letter === letter && o.is_correct);
export const correctLetter = (q: AppQuestion): Letter => q.options.find((o) => o.is_correct)!.option_letter;

export function displayOptions(q: AppQuestion, order: Letter[]) {
  return order.map((letter, i) => {
    const o = q.options.find((x) => x.option_letter === letter)!;
    return { label: LETTERS[i], ...o };
  });
}

/* ------------------------------------------------------------------ */
/* Per-question state derived from the attempt log                      */
/* ------------------------------------------------------------------ */
export interface QState {
  qkey: string;
  attempts: Attempt[];
  seen: boolean;
  everWrong: boolean;
  everLowConf: boolean;
  lastWrong?: Attempt;
  inNotebook: boolean;
  stage: number; // consecutive good reviews since last non-good answer
  due: string | null; // YYYY-MM-DD; null if not in notebook or resolved
  resolved: boolean;
}
/** "good" = correct and not marked low confidence. Lucky guesses are not good. */
export const isGood = (a: Attempt) => a.correct && a.confidence !== "low";

export function buildQStates(attempts: Attempt[]): Map<string, QState> {
  const by = new Map<string, Attempt[]>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (!by.has(a.qkey)) by.set(a.qkey, []);
    by.get(a.qkey)!.push(a);
  }
  const out = new Map<string, QState>();
  for (const [qkey, list] of by) {
    let stage = 0;
    let inNotebook = false;
    let lastWrong: Attempt | undefined;
    for (const a of list) {
      if (isGood(a)) stage = Math.min(stage + 1, 3);
      else {
        stage = 0;
        inNotebook = true;
      }
      if (!a.correct) lastWrong = a;
    }
    const last = list[list.length - 1];
    const resolved = inNotebook && stage >= 3;
    out.set(qkey, {
      qkey,
      attempts: list,
      seen: true,
      everWrong: list.some((a) => !a.correct),
      everLowConf: list.some((a) => a.confidence === "low"),
      lastWrong,
      inNotebook,
      stage,
      due: inNotebook && !resolved ? addDays(last.day, REVIEW_INTERVALS[Math.min(stage, 2)]) : null,
      resolved,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Pools & selection                                                    */
/* ------------------------------------------------------------------ */
export function usedMocks(sessions: Session[]): Set<number> {
  return new Set(sessions.filter((s) => s.kind === "exam" && s.mockNo && s.submittedAt).map((s) => s.mockNo!));
}
/** Learning pool: never includes mock-reserved questions. Used by diagnostic and learn. */
export const learningPool = (qs: AppQuestion[]) => qs.filter((q) => q.meta.mock === null);
/** Practice pool: learning pool + questions of mocks that have already been submitted once. */
export const practicePool = (qs: AppQuestion[], used: Set<number>) =>
  qs.filter((q) => q.meta.mock === null || used.has(q.meta.mock));

export type StatusFilter = "any" | "unseen" | "incorrect" | "lowconf" | "bookmarked" | "due";
export interface Filters {
  domain?: Domain | "all";
  tag?: string;
  difficulty?: string;
  status?: StatusFilter;
}
export function applyFilters(
  pool: AppQuestion[],
  f: Filters,
  states: Map<string, QState>,
  bookmarks: Set<string>,
  today: string,
): AppQuestion[] {
  return pool.filter((q) => {
    if (f.domain && f.domain !== "all" && q.exam_domain !== f.domain) return false;
    if (f.tag && !q.meta.tags.includes(f.tag)) return false;
    if (f.difficulty && f.difficulty !== "all" && q.meta.difficulty !== f.difficulty) return false;
    const st = states.get(q.key);
    switch (f.status ?? "any") {
      case "unseen":
        return !st;
      case "incorrect":
        return !!st?.everWrong;
      case "lowconf":
        return !!st?.everLowConf;
      case "bookmarked":
        return bookmarks.has(q.key);
      case "due":
        return !!st?.due && st.due <= today;
      default:
        return true;
    }
  });
}

/**
 * Pick n questions from candidates. Priority (transparent):
 * 1) notebook items due today or earlier, but at most half of the slots,
 * 2) unseen questions (keeps coverage of new topics),
 * 3) everything else (seen, resolved, or not yet due), least recently attempted first.
 */
export function pickPrioritised(cands: AppQuestion[], n: number, states: Map<string, QState>, today: string, rng: () => number): AppQuestion[] {
  const due: AppQuestion[] = [];
  const unseen: AppQuestion[] = [];
  const rest: AppQuestion[] = [];
  for (const q of shuffle(cands, rng)) {
    const st = states.get(q.key);
    if (!st) unseen.push(q);
    else if (st.due && st.due <= today) due.push(q);
    else rest.push(q);
  }
  rest.sort((a, b) => (states.get(a.key)!.attempts.at(-1)!.at - states.get(b.key)!.attempts.at(-1)!.at));
  const picked: AppQuestion[] = [];
  const take = (arr: AppQuestion[], max: number) => {
    for (const q of arr) {
      if (picked.length >= n || max-- <= 0) break;
      picked.push(q);
    }
  };
  take(due, Math.ceil(n / 2));
  take(unseen, n);
  take(due.filter((q) => !picked.includes(q)), n);
  take(rest, n);
  return picked;
}

export interface Selection {
  qkeys: string[];
  shortfall: Partial<Record<Domain, number>>;
}
/** Weighted selection by domain allocation. Order is shuffled across domains. */
export function selectByAllocation(
  pool: AppQuestion[],
  alloc: Record<Domain, number>,
  states: Map<string, QState>,
  today: string,
  seed: string,
): Selection {
  const rng = mulberry32(hashStr(seed));
  const picked: AppQuestion[] = [];
  const shortfall: Partial<Record<Domain, number>> = {};
  for (const d of DOMAINS) {
    const got = pickPrioritised(pool.filter((q) => q.exam_domain === d), alloc[d], states, today, rng);
    if (got.length < alloc[d]) shortfall[d] = alloc[d] - got.length;
    picked.push(...got);
  }
  return { qkeys: shuffle(picked, rng).map((q) => q.key), shortfall };
}
/** Weak-area drill: n questions from the weakest domains (intentionally off-weight). */
export function selectWeakDrill(pool: AppQuestion[], weakDomains: Domain[], n: number, states: Map<string, QState>, today: string, seed: string): string[] {
  const rng = mulberry32(hashStr(seed));
  const cands = pool.filter((q) => weakDomains.includes(q.exam_domain));
  return pickPrioritised(cands, n, states, today, rng).map((q) => q.key);
}

/* ------------------------------------------------------------------ */
/* Mocks                                                                */
/* ------------------------------------------------------------------ */
export interface MockAvailability {
  mockNo: 1 | 2 | 3;
  have: Record<Domain, number>;
  need: Record<Domain, number>;
  ready: boolean;
  total: number;
}
export function mockAvailability(qs: AppQuestion[], mockNo: 1 | 2 | 3): MockAvailability {
  const have = Object.fromEntries(DOMAINS.map((d) => [d, 0])) as Record<Domain, number>;
  for (const q of qs) if (q.meta.mock === mockNo) have[q.exam_domain]++;
  const ready = DOMAINS.every((d) => have[d] === ALLOC_MOCK[d]);
  return { mockNo, have, need: ALLOC_MOCK, ready, total: DOMAINS.reduce((s, d) => s + have[d], 0) };
}

/* ------------------------------------------------------------------ */
/* Sessions                                                             */
/* ------------------------------------------------------------------ */
export function createSession(p: {
  kind: SessionKind;
  label: string;
  qkeys: string[];
  now: number;
  mockNo?: 1 | 2 | 3;
  repeat?: boolean;
  objective?: string;
}): Session {
  const id = uid(p.kind);
  return {
    id,
    kind: p.kind,
    label: p.label,
    mockNo: p.mockNo,
    repeat: p.repeat,
    qkeys: p.qkeys,
    order: buildOrder(id, p.qkeys),
    answers: {},
    flags: [],
    timeMs: {},
    startedAt: p.now,
    deadline: p.kind === "exam" ? p.now + MOCK_MINUTES * 60_000 : undefined,
    status: "active",
    cursor: 0,
    objective: p.objective,
  };
}

function makeAttempt(s: Session, qkey: string, a: AnswerRec, q: AppQuestion, seenBefore: Set<string>, at: number): Attempt {
  return {
    id: uid("att"),
    sessionId: s.id,
    qkey,
    letter: a.letter,
    correct: isCorrect(q, a.letter),
    confidence: a.confidence,
    hintUsed: !!a.hintUsed,
    at,
    day: stockholmDay(at),
    first: !seenBefore.has(qkey),
    mode: s.kind,
    repeatMock: !!s.repeat,
  };
}

/** Non-exam: lock in an answer and create its attempt. Idempotent per question per session. */
export function submitAnswer(s: Session, q: AppQuestion, seenBefore: Set<string>, now: number): { session: Session; attempt: Attempt | null } {
  const a = s.answers[q.key];
  if (!a || a.submitted) return { session: s, attempt: null };
  const next: Session = { ...s, answers: { ...s.answers, [q.key]: { ...a, submitted: true, at: now } } };
  return { session: next, attempt: makeAttempt(s, q.key, a, q, seenBefore, now) };
}

/** Exam: finalize. Unanswered questions create no attempt (they stay unseen) but score as incorrect. */
export function finalizeExam(s: Session, byKey: Map<string, AppQuestion>, seenBefore: Set<string>, now: number): { session: Session; attempts: Attempt[] } {
  if (s.submittedAt) return { session: s, attempts: [] };
  const expired = s.deadline !== undefined && now >= s.deadline;
  const at = expired ? s.deadline! : now;
  const attempts: Attempt[] = [];
  const seen = new Set(seenBefore);
  for (const k of s.qkeys) {
    const a = s.answers[k];
    const q = byKey.get(k);
    if (!a || !q) continue;
    attempts.push(makeAttempt(s, k, a, q, seen, at));
    seen.add(k);
  }
  const session: Session = {
    ...s,
    submittedAt: at,
    status: expired ? "expired" : "submitted",
    answers: Object.fromEntries(Object.entries(s.answers).map(([k, v]) => [k, { ...v, submitted: true }])),
  };
  return { session, attempts };
}
export const remainingMs = (s: Session, now: number) => (s.deadline ? Math.max(0, s.deadline - now) : 0);

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */
export interface DomainScore { total: number; correct: number; answered: number; unanswered: number; accuracy: number }
export interface SessionScore {
  total: number;
  correct: number;
  answered: number;
  unanswered: number;
  accuracy: number;
  byDomain: Record<Domain, DomainScore>;
  highConfidenceErrors: string[];
  objectiveGaps: { objective: string; wrong: number; total: number }[];
  pacing: { usedMs: number; avgAnsweredSec: number; slowest: { qkey: string; sec: number }[] };
}
export function scoreSession(s: Session, byKey: Map<string, AppQuestion>): SessionScore {
  const blank = (): DomainScore => ({ total: 0, correct: 0, answered: 0, unanswered: 0, accuracy: 0 });
  const byDomain = Object.fromEntries(DOMAINS.map((d) => [d, blank()])) as Record<Domain, DomainScore>;
  const gaps = new Map<string, { wrong: number; total: number }>();
  const hce: string[] = [];
  let correct = 0, answered = 0;
  for (const k of s.qkeys) {
    const q = byKey.get(k);
    if (!q) continue;
    const a = s.answers[k];
    const d = byDomain[q.exam_domain];
    d.total++;
    const g = gaps.get(q.meta.objective) ?? { wrong: 0, total: 0 };
    g.total++;
    if (a) {
      d.answered++; answered++;
      if (isCorrect(q, a.letter)) { d.correct++; correct++; }
      else { g.wrong++; if (a.confidence === "high") hce.push(k); }
    } else { d.unanswered++; g.wrong++; }
    gaps.set(q.meta.objective, g);
  }
  for (const d of DOMAINS) byDomain[d].accuracy = byDomain[d].total ? byDomain[d].correct / byDomain[d].total : 0;
  const total = s.qkeys.length;
  const times = Object.entries(s.timeMs).filter(([k]) => s.answers[k]);
  const sumAns = times.reduce((t, [, v]) => t + v, 0);
  return {
    total, correct, answered, unanswered: total - answered,
    accuracy: total ? correct / total : 0,
    byDomain, highConfidenceErrors: hce,
    objectiveGaps: [...gaps].map(([objective, v]) => ({ objective, ...v })).filter((g) => g.wrong > 0).sort((a, b) => b.wrong / b.total - a.wrong / a.total),
    pacing: {
      usedMs: Math.max(0, (s.submittedAt ?? s.startedAt) - s.startedAt),
      avgAnsweredSec: answered ? sumAns / answered / 1000 : 0,
      slowest: Object.entries(s.timeMs).map(([qkey, v]) => ({ qkey, sec: v / 1000 })).sort((a, b) => b.sec - a.sec).slice(0, 5),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Progress metrics                                                     */
/* ------------------------------------------------------------------ */
export interface Acc { n: number; correct: number; pct: number | null }
const acc = (xs: Attempt[]): Acc => {
  const c = xs.filter((a) => a.correct).length;
  return { n: xs.length, correct: c, pct: xs.length ? c / xs.length : null };
};
export interface Metrics {
  firstAttempt: Acc;
  unseenNoHint: Acc;
  repeat: Acc;
  byDomainFirst: Record<Domain, Acc>;
  distinctSeen: number;
}
export function computeMetrics(attempts: Attempt[], byKey: Map<string, AppQuestion>): Metrics {
  const first = attempts.filter((a) => a.first);
  const byDomainFirst = Object.fromEntries(
    DOMAINS.map((d) => [d, acc(first.filter((a) => byKey.get(a.qkey)?.exam_domain === d))]),
  ) as Record<Domain, Acc>;
  return {
    firstAttempt: acc(first),
    unseenNoHint: acc(first.filter((a) => !a.hintUsed)),
    repeat: acc(attempts.filter((a) => !a.first)),
    byDomainFirst,
    distinctSeen: new Set(attempts.map((a) => a.qkey)).size,
  };
}

export type MasteryStatus = "none" | "insufficient" | "learning" | "mastered";
export interface ObjMastery { id: string; status: MasteryStatus; distinctAttempted: number; goodQuestions: number; goodDays: number }
/**
 * Mastery needs evidence from DIFFERENT questions on SEPARATE days: at least 3 distinct
 * questions attempted, and good (correct, not low-confidence) answers to >= 2 distinct
 * questions that fall on >= 2 distinct days. Re-answering one question never counts twice.
 */
export function objectiveMastery(attempts: Attempt[], byKey: Map<string, AppQuestion>): Record<string, ObjMastery> {
  const out: Record<string, ObjMastery> = {};
  for (const o of OBJECTIVES) {
    const mine = attempts.filter((a) => byKey.get(a.qkey)?.meta.objective === o.id);
    const distinct = new Set(mine.map((a) => a.qkey));
    const goodFirstDay = new Map<string, string>();
    for (const a of [...mine].sort((x, y) => x.at - y.at)) if (isGood(a) && !goodFirstDay.has(a.qkey)) goodFirstDay.set(a.qkey, a.day);
    const days = new Set(goodFirstDay.values());
    let status: MasteryStatus = "none";
    if (distinct.size > 0) status = distinct.size < 3 ? "insufficient" : goodFirstDay.size >= 2 && days.size >= 2 ? "mastered" : "learning";
    out[o.id] = { id: o.id, status, distinctAttempted: distinct.size, goodQuestions: goodFirstDay.size, goodDays: days.size };
  }
  return out;
}

export interface Readiness {
  ready: boolean;
  unseenMocks: number;
  checks: { label: string; ok: boolean; detail: string }[];
}
/** App preparation targets only. NOT Google's passing score and NOT a probability of passing. */
export function readiness(sessions: Session[], byKey: Map<string, AppQuestion>, mastery: Record<string, ObjMastery>): Readiness {
  const firstRuns = sessions
    .filter((s) => s.kind === "exam" && s.submittedAt && !s.repeat)
    .sort((a, b) => a.submittedAt! - b.submittedAt!);
  const scores = firstRuns.map((s) => scoreSession(s, byKey));
  const last2 = scores.slice(-2);
  const twoOk = last2.length === 2 && last2.every((x) => x.accuracy >= 0.85);
  const pooled = Object.fromEntries(DOMAINS.map((d) => [d, { c: 0, t: 0 }])) as Record<Domain, { c: number; t: number }>;
  for (const sc of last2) for (const d of DOMAINS) { pooled[d].c += sc.byDomain[d].correct; pooled[d].t += sc.byDomain[d].total; }
  const domOk = last2.length === 2 && DOMAINS.every((d) => pooled[d].t > 0 && pooled[d].c / pooled[d].t >= 0.8);
  const covered = OBJECTIVES.filter((o) => ["learning", "mastered"].includes(mastery[o.id]?.status)).length;
  const covOk = covered / OBJECTIVES.length >= 0.9;
  const checks = [
    { label: "Two unseen timed mocks at 85% or higher", ok: twoOk, detail: `${last2.map((x) => Math.round(x.accuracy * 100) + "%").join(", ") || "no unseen mocks submitted yet"}` },
    { label: "Each domain at 80% or higher across those two mocks", ok: domOk, detail: last2.length === 2 ? DOMAINS.map((d) => `${d.split(" ")[0]} ${Math.round((pooled[d].c / Math.max(1, pooled[d].t)) * 100)}%`).join(" · ") : "needs two unseen mocks" },
    { label: "Objective coverage sufficient (90% of objectives with enough evidence)", ok: covOk, detail: `${covered} of ${OBJECTIVES.length} objectives` },
  ];
  return { ready: checks.every((c) => c.ok), unseenMocks: firstRuns.length, checks };
}

export function weakestDomains(m: Metrics, k = 2): Domain[] {
  return [...DOMAINS]
    .filter((d) => m.byDomainFirst[d].n > 0)
    .sort((a, b) => (m.byDomainFirst[a].pct ?? 1) - (m.byDomainFirst[b].pct ?? 1))
    .slice(0, k);
}
export { diffDays };
export type { Confidence };
