import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { NV_BANK, NV_BY_ID, validateBank } from "@/nvidia/bank";
import { DOMAINS, LEVELS, type Attempt } from "@/nvidia/types";
import { TOPICS } from "@/nvidia/topics";
import {
  MOCKS, buildMock, buildQStates, cellStatus, correctLetter, dueQids, finalize, isExpired, ladder, makeSession, readiness,
  scoreSession, setMockAnswer, split, submitAnswer,
} from "@/nvidia/engine";
import { PLAN, PLAN_DAYS, hoursFor, planPosition } from "@/nvidia/roadmap";
import { NvDb, makeBackup, validateBackup } from "@/nvidia/db";

const D = (day: string, h = 10) => Date.parse(`${day}T${String(h).padStart(2, "0")}:00:00Z`);
const att = (qid: string, correct: boolean, day: string, h = 10): Attempt => {
  const q = NV_BY_ID.get(qid)!;
  return { id: `${qid}:${day}:${h}`, sessionId: "s", qid, topic: q.topic, domain: q.domain, level: q.level, letter: "A", correct, hintUsed: false, at: D(day, h), day, first: true, mode: "practice" };
};

describe("bank", () => {
  it("has no validation errors and the intended shape", () => {
    const r = validateBank(NV_BANK);
    expect(r.problems.filter((p) => p.kind === "error")).toEqual([]);
    expect(NV_BANK.length).toBe(300);
    expect(TOPICS.length).toBe(20);
    for (const t of TOPICS) for (const l of LEVELS) expect(NV_BANK.filter((q) => q.topic === t.id && q.level === l).length).toBeGreaterThanOrEqual(3);
  });
  it("does not give away the answer by length or position", () => {
    const r = validateBank(NV_BANK);
    expect(r.stats.longestIsCorrectPct).toBeLessThanOrEqual(40);
    const pos = [r.stats.posA, r.stats.posB, r.stats.posC, r.stats.posD];
    expect(Math.max(...pos) - Math.min(...pos)).toBeLessThanOrEqual(20);
  });
  it("every question has exactly one correct option and an explanation for each option", () => {
    for (const q of NV_BANK) {
      expect(q.options.filter((o) => o.correct).length).toBe(1);
      for (const o of q.options) expect(o.why.length).toBeGreaterThan(5);
    }
  });
  it("is marked as an unverified draft, never as verified", () => {
    expect(NV_BANK.every((q) => q.review !== "verified")).toBe(true);
  });
});

describe("mock builder", () => {
  for (const def of MOCKS) {
    it(`${def.id} uses the official weights and its level mix`, () => {
      const qids = buildMock(def, NV_BANK, new Set(), "t");
      expect(qids.length).toBe(60);
      expect(new Set(qids).size).toBe(60);
      for (const d of DOMAINS) expect(qids.filter((id) => NV_BY_ID.get(id)!.domain === d.id).length).toBe(d.mockCount);
      for (const lv of LEVELS) {
        const got = qids.filter((id) => NV_BY_ID.get(id)!.level === lv).length;
        expect(Math.abs(got - (60 * def.mix[lv]) / 100)).toBeLessThanOrEqual(5); // rounding per domain
      }
      if (def.mix.legendary === 0) expect(qids.some((id) => NV_BY_ID.get(id)!.level === "legendary")).toBe(false);
    });
  }
  it("prefers unseen questions", () => {
    const first = buildMock(MOCKS[2], NV_BANK, new Set(), "a");
    const seen = new Set(first);
    const second = buildMock(MOCKS[2], NV_BANK, seen, "b");
    expect(second.filter((q) => seen.has(q)).length).toBeLessThan(20);
  });
  it("split() keeps the total", () => {
    expect(Object.values(split(18, { a: 20, b: 45, c: 35 })).reduce((x, y) => x + y, 0)).toBe(18);
  });
});

describe("spaced review", () => {
  const qid = "C1-B1";
  it("a mistake is due the next day, then 3 days, then 7 days, then mastered", () => {
    let s = buildQStates([att(qid, false, "2026-10-19")]).get(qid)!;
    expect(s.due).toBe("2026-10-20");
    s = buildQStates([att(qid, false, "2026-10-19"), att(qid, true, "2026-10-20")]).get(qid)!;
    expect(s.due).toBe("2026-10-23");
    s = buildQStates([att(qid, false, "2026-10-19"), att(qid, true, "2026-10-20"), att(qid, true, "2026-10-23")]).get(qid)!;
    expect(s.due).toBe("2026-10-30");
    s = buildQStates([att(qid, false, "2026-10-19"), att(qid, true, "2026-10-20"), att(qid, true, "2026-10-23"), att(qid, true, "2026-10-30")]).get(qid)!;
    expect(s.mastered).toBe(true);
    expect(s.due).toBeNull();
  });
  it("cramming on one day does not count as mastery", () => {
    const s = buildQStates([att(qid, false, "2026-10-19", 9), att(qid, true, "2026-10-19", 10), att(qid, true, "2026-10-19", 11), att(qid, true, "2026-10-19", 12)]).get(qid)!;
    expect(s.mastered).toBe(false);
    expect(s.due).toBe("2026-10-20");
  });
  it("a new mistake resets progress", () => {
    const s = buildQStates([att(qid, false, "2026-10-19"), att(qid, true, "2026-10-20"), att(qid, false, "2026-10-23")]).get(qid)!;
    expect(s.step).toBe(0);
    expect(s.due).toBe("2026-10-24");
  });
  it("dueQids only lists what is due", () => {
    const st = buildQStates([att(qid, false, "2026-10-19")]);
    expect(dueQids(st, "2026-10-19")).toEqual([]);
    expect(dueQids(st, "2026-10-20")).toEqual([qid]);
  });
});

describe("ladder", () => {
  const ids = (t: string, l: string) => NV_BANK.filter((q) => q.topic === t && q.level === l).map((q) => q.id);
  it("clears a level only when all questions are seen and at least 2/3 are right first time", () => {
    const [a, b, c] = ids("C1", "beginner");
    let cells = ladder([att(a, true, "2026-10-19"), att(b, true, "2026-10-19")], NV_BANK);
    expect(cells.get("C1|beginner")!.cleared).toBe(false);
    cells = ladder([att(a, true, "2026-10-19"), att(b, true, "2026-10-19"), att(c, false, "2026-10-19")], NV_BANK);
    expect(cells.get("C1|beginner")!.cleared).toBe(true);
    expect(cellStatus(cells, "C1", "easy")).toBe("next");
    expect(cellStatus(cells, "C1", "medium")).toBe("locked");
  });
  it("retrying a miss does not improve first-attempt accuracy", () => {
    const [a, b, c] = ids("C1", "beginner");
    const cells = ladder([att(a, false, "2026-10-19"), att(a, true, "2026-10-19", 11), att(b, false, "2026-10-19"), att(c, true, "2026-10-19")], NV_BANK);
    expect(cells.get("C1|beginner")!.firstCorrect).toBe(1);
    expect(cells.get("C1|beginner")!.cleared).toBe(false);
  });
});

describe("sessions and exams", () => {
  it("practice answers are graded immediately and cannot be changed", () => {
    const q = NV_BANK[0];
    const s = makeSession({ kind: "practice", label: "t", qids: [q.id], now: D("2026-10-19"), seen: new Set() });
    const r = submitAnswer(s, q, correctLetter(q), D("2026-10-19"), new Set());
    expect(r.attempt.correct).toBe(true);
    expect(r.attempt.first).toBe(true);
    expect(() => submitAnswer(r.session, q, "A", D("2026-10-19"), new Set())).toThrow();
  });
  it("mock answers become attempts only on finalize, and unanswered count as wrong", () => {
    const qids = buildMock(MOCKS[0], NV_BANK, new Set(), "x");
    let s = makeSession({ kind: "mock", label: "m", qids, now: D("2026-10-19"), seen: new Set(), mockId: "m1", deadline: D("2026-10-19") + 3_600_000 });
    for (const qid of qids.slice(0, 30)) s = setMockAnswer(s, qid, correctLetter(NV_BY_ID.get(qid)!), D("2026-10-19"));
    const r = finalize(s, NV_BY_ID, new Set(), D("2026-10-19") + 1000);
    expect(r.attempts.length).toBe(30);
    const sc = scoreSession(r.session, NV_BY_ID);
    expect(sc.correct).toBe(30);
    expect(sc.total).toBe(60);
    expect(sc.pct).toBe(50);
  });
  it("an expired exam is detected from the persisted deadline and graded at the deadline time", () => {
    const qids = buildMock(MOCKS[0], NV_BANK, new Set(), "x");
    let s = makeSession({ kind: "mock", label: "m", qids, now: D("2026-10-19"), seen: new Set(), mockId: "m1", deadline: D("2026-10-19") + 3_600_000 });
    s = setMockAnswer(s, qids[0], "A", D("2026-10-19"));
    expect(isExpired(s, D("2026-10-19") + 3_599_000)).toBe(false);
    expect(isExpired(s, D("2026-10-20"))).toBe(true);
    const r = finalize(s, NV_BY_ID, new Set(), D("2026-10-20"), "expired");
    expect(r.session.status).toBe("expired");
    expect(r.attempts[0].at).toBe(D("2026-10-19") + 3_600_000);
    expect(finalize(r.session, NV_BY_ID, new Set(), D("2026-10-21")).attempts).toEqual([]); // idempotent
  });
  it("readiness is null without a mock and never claims a pass probability", () => {
    expect(readiness([], [], NV_BY_ID, 300).index).toBeNull();
    const src = JSON.stringify(readiness([], [], NV_BY_ID, 300));
    expect(src.toLowerCase()).not.toContain("probab");
  });
});

describe("roadmap", () => {
  it("covers 19 Oct to 27 Nov in 40 days with 2h weekdays and 3h weekends", () => {
    expect(PLAN_DAYS).toBe(40);
    expect(PLAN.map((d) => d.n)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(hoursFor("2026-10-19")).toBe(2); // Monday
    expect(hoursFor("2026-10-24")).toBe(3); // Saturday
    expect(hoursFor("2026-10-25")).toBe(3); // Sunday
    expect(planPosition("2026-10-19", "2026-11-27")).toEqual({ state: "active", n: 40 });
    expect(planPosition("2026-10-19", "2026-10-18").state).toBe("before");
    expect(planPosition("2026-10-19", "2026-11-28").state).toBe("after");
  });
  it("schedules each of the five mocks exactly once and every topic at least once", () => {
    const mocks = PLAN.filter((d) => d.action.kind === "mock").map((d) => d.action.mock);
    expect(mocks).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    const topics = new Set(PLAN.flatMap((d) => d.topics));
    for (const t of TOPICS) expect(topics.has(t.id)).toBe(true);
  });
});

describe("storage", () => {
  it("round-trips through IndexedDB and validates backups", async () => {
    const db = await NvDb.open(new IDBFactory());
    const qid = NV_BANK[0].id;
    const s = makeSession({ kind: "practice", label: "t", qids: [qid], now: 1, seen: new Set() });
    await db.putSession(s, [att(qid, true, "2026-10-19")]);
    await db.setKv("bookmarks", [qid]);
    const snap = await db.load();
    expect(snap.sessions.length).toBe(1);
    expect(snap.attempts.length).toBe(1);
    const text = JSON.stringify(makeBackup(snap));
    const ids = new Set(NV_BANK.map((q) => q.id));
    expect(validateBackup(text, ids).ok).toBe(true);
    expect(validateBackup("{}", ids).ok).toBe(false);
    expect(validateBackup("nope", ids).ok).toBe(false);
    const bad = JSON.parse(text);
    bad.attempts[0].qid = "ZZ-NOPE";
    expect(validateBackup(JSON.stringify(bad), ids).ok).toBe(false);
    await db.resetProgress();
    expect((await db.load()).attempts.length).toBe(0);
  });
});
