import { describe, expect, it } from "vitest";
import {
  ALLOC_20, ALLOC_MOCK, DOMAINS, type Session,
} from "../src/lib/types";
import {
  buildOrder, buildQStates, computeMetrics, correctLetter, createSession, displayOptions, finalizeExam, isCorrect, learningPool,
  mockAvailability, objectiveMastery, practicePool, readiness, remainingMs, scoreSession, selectByAllocation, submitAnswer, usedMocks, applyFilters,
} from "../src/lib/engine";
import { mkAttempt, mkBank, mkQ } from "./helpers";

const bank = mkBank();
const byKey = new Map(bank.map((q) => [q.key, q]));
const NOW = Date.parse("2026-10-14T09:00:00Z");

describe("option shuffling and grading", () => {
  it("keeps option identity: grading follows the letter chosen, not the displayed position", () => {
    for (const q of bank.slice(0, 40)) {
      const order = buildOrder("session-x", [q.key])[q.key];
      expect([...order].sort()).toEqual(["A", "B", "C", "D"]);
      const shown = displayOptions(q, order);
      const correctShown = shown.find((o) => o.is_correct)!;
      expect(isCorrect(q, correctShown.option_letter)).toBe(true);
      expect(correctShown.option_letter).toBe(correctLetter(q));
      for (const o of shown.filter((x) => !x.is_correct)) expect(isCorrect(q, o.option_letter)).toBe(false);
    }
  });
  it("shuffles deterministically per session and actually moves options", () => {
    const keys = bank.slice(0, 30).map((q) => q.key);
    expect(buildOrder("s1", keys)).toEqual(buildOrder("s1", keys));
    const orders = Object.values(buildOrder("s1", keys)).map((o) => o.join(""));
    expect(new Set(orders).size).toBeGreaterThan(5);
  });
  it("selected answers survive reshuffling because they are stored as original letters", () => {
    const q = bank[0];
    const s = createSession({ kind: "practice", label: "x", qkeys: [q.key], now: NOW });
    s.answers[q.key] = { letter: correctLetter(q), at: NOW, submitted: false };
    const r = submitAnswer(s, q, new Set(), NOW);
    expect(r.attempt?.correct).toBe(true);
    expect(r.attempt?.letter).toBe(correctLetter(q));
  });
});

describe("weighted allocation", () => {
  it("default mixed set uses 6/7/4/3", () => {
    const pool = learningPool(bank);
    const sel = selectByAllocation(pool, ALLOC_20, new Map(), "2026-10-14", "seed");
    expect(sel.qkeys).toHaveLength(20);
    const counts = Object.fromEntries(DOMAINS.map((d) => [d, sel.qkeys.filter((k) => byKey.get(k)!.exam_domain === d).length]));
    expect(counts).toEqual({ Fundamentals: 6, "Google Cloud Offerings": 7, "Output Improvement": 4, "Business Strategy & Security": 3 });
  });
  it("reports shortfall instead of silently padding", () => {
    const small = bank.filter((q) => q.meta.mock === null && q.exam_domain !== "Output Improvement");
    const sel = selectByAllocation(small, ALLOC_20, new Map(), "2026-10-14", "s");
    expect(sel.shortfall["Output Improvement"]).toBe(4);
    expect(sel.qkeys).toHaveLength(16);
  });
  it("mock availability requires exactly 18/21/12/9", () => {
    expect(mockAvailability(bank, 1).ready).toBe(true);
    expect(mockAvailability(bank.slice(1), 1).ready).toBe(false);
    for (const n of [1, 2, 3] as const) {
      const have = DOMAINS.map((d) => bank.filter((q) => q.meta.mock === n && q.exam_domain === d).length);
      expect(have).toEqual(DOMAINS.map((d) => ALLOC_MOCK[d]));
    }
  });
});

describe("reserved mock questions", () => {
  it("are excluded from learning and from practice until that mock is submitted", () => {
    expect(learningPool(bank).every((q) => q.meta.mock === null)).toBe(true);
    expect(practicePool(bank, new Set()).some((q) => q.meta.mock)).toBe(false);
    const after = practicePool(bank, new Set([1]));
    expect(after.some((q) => q.meta.mock === 1)).toBe(true);
    expect(after.some((q) => q.meta.mock === 2)).toBe(false);
  });
  it("mocks are disjoint", () => {
    const sets = [1, 2, 3].map((n) => new Set(bank.filter((q) => q.meta.mock === n).map((q) => q.key)));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect([...sets[i]].some((k) => sets[j].has(k))).toBe(false);
  });
  it("selection never returns reserved questions from the practice pool", () => {
    const sel = selectByAllocation(practicePool(bank, new Set()), ALLOC_20, new Map(), "2026-10-14", "x");
    expect(sel.qkeys.every((k) => byKey.get(k)!.meta.mock === null)).toBe(true);
  });
  it("usedMocks only counts submitted exams", () => {
    const a = createSession({ kind: "exam", label: "m", qkeys: [], now: NOW, mockNo: 1 });
    const b = { ...createSession({ kind: "exam", label: "m", qkeys: [], now: NOW, mockNo: 2 }), submittedAt: NOW };
    expect([...usedMocks([a, b])]).toEqual([2]);
  });
});

describe("exam timer, expiry and scoring", () => {
  const qs = bank.filter((q) => q.meta.mock === 1);
  const mk = () => createSession({ kind: "exam", label: "Mock 1", qkeys: qs.map((q) => q.key), now: NOW, mockNo: 1 });
  it("uses a persisted deadline of 90 minutes", () => {
    const s = mk();
    expect(s.deadline).toBe(NOW + 90 * 60_000);
    expect(remainingMs(s, NOW)).toBe(90 * 60_000);
    // simulate reload 30 minutes later: remaining is derived, not decremented
    expect(remainingMs(JSON.parse(JSON.stringify(s)), NOW + 30 * 60_000)).toBe(60 * 60_000);
    expect(remainingMs(s, NOW + 91 * 60_000)).toBe(0);
  });
  it("creates no attempts (no feedback data) before submission", () => {
    const s = mk();
    s.answers[qs[0].key] = { letter: correctLetter(qs[0]), at: NOW, submitted: false };
    expect(s.submittedAt).toBeUndefined();
    expect(s.status).toBe("active");
  });
  it("auto-submits at the deadline on reopening and counts unanswered as incorrect", () => {
    const s = mk();
    for (const q of qs.slice(0, 30)) s.answers[q.key] = { letter: correctLetter(q), at: NOW, submitted: false };
    const late = NOW + 5 * 3600_000;
    const r = finalizeExam(s, byKey, new Set(), late);
    expect(r.session.status).toBe("expired");
    expect(r.session.submittedAt).toBe(s.deadline); // stamped at deadline, not at reopen time
    expect(r.attempts).toHaveLength(30);
    const sc = scoreSession(r.session, byKey);
    expect(sc.total).toBe(60);
    expect(sc.correct).toBe(30);
    expect(sc.unanswered).toBe(30);
    expect(sc.accuracy).toBeCloseTo(0.5);
    const d = sc.byDomain.Fundamentals;
    expect(d.correct + d.unanswered + (d.answered - d.correct)).toBe(18);
  });
  it("manual submission before the deadline is 'submitted', and finalizing twice is a no-op", () => {
    const s = mk();
    const r = finalizeExam(s, byKey, new Set(), NOW + 1000);
    expect(r.session.status).toBe("submitted");
    expect(finalizeExam(r.session, byKey, new Set(), NOW + 2000).attempts).toHaveLength(0);
  });
  it("flags high-confidence errors", () => {
    const s = mk();
    const q = qs[0];
    const wrong = (["A", "B", "C", "D"] as const).find((l) => l !== correctLetter(q))!;
    s.answers[q.key] = { letter: wrong, confidence: "high", at: NOW, submitted: false };
    const r = finalizeExam(s, byKey, new Set(), NOW + 10);
    expect(scoreSession(r.session, byKey).highConfidenceErrors).toEqual([q.key]);
  });
});

describe("first-attempt vs repeat metrics", () => {
  it("keeps them separate and never lets a repeat change first-attempt accuracy", () => {
    const [a, b] = bank.slice(0, 2);
    const attempts = [
      mkAttempt(a, { correct: false, first: true }),
      mkAttempt(b, { correct: true, first: true, hintUsed: true }),
      mkAttempt(a, { correct: true, first: false, day: "2026-10-15" }),
      mkAttempt(a, { correct: true, first: false, day: "2026-10-16" }),
    ];
    const m = computeMetrics(attempts, byKey);
    expect(m.firstAttempt).toMatchObject({ n: 2, correct: 1 });
    expect(m.unseenNoHint).toMatchObject({ n: 1, correct: 0 });
    expect(m.repeat).toMatchObject({ n: 2, correct: 2 });
    expect(m.distinctSeen).toBe(2);
  });
  it("submitAnswer marks the first attempt only for unseen questions", () => {
    const q = bank[3];
    const s = createSession({ kind: "practice", label: "p", qkeys: [q.key], now: NOW });
    s.answers[q.key] = { letter: "A", at: NOW, submitted: false };
    expect(submitAnswer(s, q, new Set(), NOW).attempt?.first).toBe(true);
    expect(submitAnswer(s, q, new Set([q.key]), NOW).attempt?.first).toBe(false);
  });
  it("submitAnswer is idempotent", () => {
    const q = bank[4];
    const s = createSession({ kind: "practice", label: "p", qkeys: [q.key], now: NOW });
    s.answers[q.key] = { letter: "A", at: NOW, submitted: false };
    const r1 = submitAnswer(s, q, new Set(), NOW);
    expect(submitAnswer(r1.session, q, new Set(), NOW).attempt).toBeNull();
  });
});

describe("review schedule and lucky guesses", () => {
  const q = mkQ("Fundamentals");
  it("wrong answers return after 1, then 3, then 7 days, then resolve", () => {
    let st = buildQStates([mkAttempt(q, { correct: false, day: "2026-10-14" })]).get(q.key)!;
    expect(st.due).toBe("2026-10-15");
    st = buildQStates([mkAttempt(q, { correct: false, day: "2026-10-14" }), mkAttempt(q, { correct: true, day: "2026-10-15", first: false })]).get(q.key)!;
    expect(st.due).toBe("2026-10-18");
    st = buildQStates([
      mkAttempt(q, { correct: false, day: "2026-10-14" }), mkAttempt(q, { correct: true, day: "2026-10-15", first: false }), mkAttempt(q, { correct: true, day: "2026-10-18", first: false }),
    ]).get(q.key)!;
    expect(st.due).toBe("2026-10-25");
    st = buildQStates([
      mkAttempt(q, { correct: false, day: "2026-10-14" }), mkAttempt(q, { correct: true, day: "2026-10-15", first: false }),
      mkAttempt(q, { correct: true, day: "2026-10-18", first: false }), mkAttempt(q, { correct: true, day: "2026-10-25", first: false }),
    ]).get(q.key)!;
    expect(st.resolved).toBe(true);
    expect(st.due).toBeNull();
  });
  it("a correct low-confidence answer enters the notebook and is not treated as mastered", () => {
    const st = buildQStates([mkAttempt(q, { correct: true, confidence: "low", day: "2026-10-14" })]).get(q.key)!;
    expect(st.inNotebook).toBe(true);
    expect(st.everWrong).toBe(false);
    expect(st.due).toBe("2026-10-15");
  });
  it("a confident correct first answer stays out of the notebook", () => {
    expect(buildQStates([mkAttempt(q, { correct: true, confidence: "high" })]).get(q.key)!.inNotebook).toBe(false);
  });
  it("a miss resets the review stage", () => {
    const st = buildQStates([
      mkAttempt(q, { correct: false, day: "2026-10-14" }), mkAttempt(q, { correct: true, day: "2026-10-15", first: false }), mkAttempt(q, { correct: false, day: "2026-10-18", first: false }),
    ]).get(q.key)!;
    expect(st.stage).toBe(0);
    expect(st.due).toBe("2026-10-19");
  });
  it("due filter and priority pick due items first", () => {
    const pool = learningPool(bank).filter((x) => x.exam_domain === "Fundamentals");
    const attempts = [mkAttempt(pool[0], { correct: false, day: "2026-10-10" })];
    const states = buildQStates(attempts);
    const sel = selectByAllocation(pool, { ...ALLOC_20, Fundamentals: 3, "Google Cloud Offerings": 0, "Output Improvement": 0, "Business Strategy & Security": 0 }, states, "2026-10-14", "s");
    expect(sel.qkeys).toContain(pool[0].key);
    expect(applyFilters(pool, { status: "due" }, states, new Set(), "2026-10-14").map((x) => x.key)).toEqual([pool[0].key]);
  });
});

describe("objective mastery requires different questions on separate days", () => {
  const qs = ["a", "b", "c", "d"].map((k) => mkQ("Fundamentals", { objective: "F1", key: "m" + k }));
  const m = new Map(qs.map((q) => [q.key, q]));
  it("repeated recall of one question is not mastery", () => {
    const at = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"].map((d, i) => mkAttempt(qs[0], { correct: true, day: d, first: i === 0 }));
    expect(objectiveMastery(at, m).F1.status).toBe("insufficient");
  });
  it("needs >=3 distinct questions and good answers on >=2 questions across >=2 days", () => {
    const sameDay = qs.slice(0, 3).map((q) => mkAttempt(q, { correct: true, day: "2026-10-14" }));
    expect(objectiveMastery(sameDay, m).F1.status).toBe("learning");
    const separate = [mkAttempt(qs[0], { correct: true, day: "2026-10-14" }), mkAttempt(qs[1], { correct: true, day: "2026-10-16" }), mkAttempt(qs[2], { correct: false, day: "2026-10-16" })];
    expect(objectiveMastery(separate, m).F1.status).toBe("mastered");
  });
  it("low-confidence correct answers do not count toward mastery", () => {
    const at = qs.slice(0, 3).map((q, i) => mkAttempt(q, { correct: true, confidence: "low", day: `2026-10-1${4 + i}` }));
    expect(objectiveMastery(at, m).F1.status).toBe("learning");
  });
  it("labels untouched and thin objectives", () => {
    expect(objectiveMastery([], m).F1.status).toBe("none");
    expect(objectiveMastery([mkAttempt(qs[0], { correct: true })], m).F1.status).toBe("insufficient");
  });
});

describe("readiness targets", () => {
  const mocks = (n: 1 | 2 | 3) => bank.filter((q) => q.meta.mock === n);
  function sessionWith(n: 1 | 2 | 3, acc: number, repeat = false): Session {
    const qs = mocks(n);
    const s = createSession({ kind: "exam", label: "m", qkeys: qs.map((q) => q.key), now: NOW + n * 1e6, mockNo: n, repeat });
    qs.forEach((q, i) => {
      if (i / qs.length < acc) s.answers[q.key] = { letter: correctLetter(q), at: NOW, submitted: true };
    });
    return { ...s, submittedAt: NOW + n * 1e6 + 100, status: "submitted" };
  }
  it("is not met with fewer than two unseen mocks", () => {
    expect(readiness([sessionWith(1, 0.95)], byKey, objectiveMastery([], byKey)).ready).toBe(false);
  });
  it("repeated mocks never count as unseen", () => {
    const r = readiness([sessionWith(1, 0.95, true), sessionWith(2, 0.95, true)], byKey, objectiveMastery([], byKey));
    expect(r.unseenMocks).toBe(0);
    expect(r.checks[0].ok).toBe(false);
  });
  it("checks 85% overall per mock and 80% per domain; coverage is a separate gate", () => {
    const r = readiness([sessionWith(1, 1), sessionWith(2, 1)], byKey, objectiveMastery([], byKey));
    expect(r.checks[0].ok).toBe(true);
    expect(r.checks[1].ok).toBe(true);
    expect(r.checks[2].ok).toBe(false);
    expect(r.ready).toBe(false);
    const low = readiness([sessionWith(1, 0.8), sessionWith(2, 1)], byKey, objectiveMastery([], byKey));
    expect(low.checks[0].ok).toBe(false);
  });
});
