import { describe, expect, it } from "vitest";
import { addDays, diffDays, isValidDay, stockholmDay } from "../src/lib/dates";
import { programView } from "../src/lib/program";
import { createSession, scoreSession } from "../src/lib/engine";
import { scaleAlloc } from "../src/lib/store";
import { mkAttempt, mkQ } from "./helpers";

describe("dates (Europe/Stockholm)", () => {
  it("rolls the day at Stockholm midnight, not UTC", () => {
    expect(stockholmDay(Date.parse("2026-10-14T21:30:00Z"))).toBe("2026-10-14"); // 23:30 CEST
    expect(stockholmDay(Date.parse("2026-10-14T22:30:00Z"))).toBe("2026-10-15"); // 00:30 CEST
  });
  it("adds and diffs days, validates calendar dates", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(diffDays("2026-10-14", "2026-10-25")).toBe(11);
    expect(isValidDay("2026-02-30")).toBe(false);
  });
});

describe("10-day program", () => {
  const q = mkQ("Fundamentals");
  const mkMany = (n: number) => Array.from({ length: n }, () => mkAttempt(q, { correct: true, mode: "practice" }));
  it("marks days missed and carries the work over instead of completing it", () => {
    const v = programView("2026-10-14", "2026-10-17", mkMany(10), []);
    expect(v.todayIndex).toBe(4);
    expect(v.days[0].status).toBe("missed");
    expect(v.days[1].status).toBe("missed");
    expect(v.days[3].status).toBe("today");
    expect(v.carryOver).toBe(30 + 40 + 40 - 10);
    expect(v.todayRemaining).toBe(30 + 40 + 40 + 40 - 10);
  });
  it("completes day 1 only with the diagnostic and enough questions", () => {
    const diag = { ...createSession({ kind: "diagnostic", label: "d", qkeys: [], now: 1 }), submittedAt: 2 };
    expect(programView("2026-10-14", "2026-10-14", mkMany(30), []).days[0].status).toBe("today");
    expect(programView("2026-10-14", "2026-10-14", mkMany(30), [diag]).days[0].status).toBe("done");
  });
  it("mock days need the mock to be submitted", () => {
    const v = programView("2026-10-14", "2026-10-21", mkMany(300), []);
    expect(v.days[6].status).toBe("missed");
    const mock = { ...createSession({ kind: "exam", label: "m", qkeys: [], now: 1, mockNo: 1 }), submittedAt: 2 };
    expect(programView("2026-10-14", "2026-10-21", mkMany(300), [mock]).days[6].status).toBe("done");
  });
});

describe("scaled allocation", () => {
  it("keeps 6/7/4/3 at 20 and sums to n otherwise", () => {
    expect(Object.values(scaleAlloc(20))).toEqual([6, 7, 4, 3]);
    for (const n of [5, 10, 30]) expect(Object.values(scaleAlloc(n)).reduce((a, b) => a + b, 0)).toBe(n);
  });
});

describe("scoring edge cases", () => {
  it("empty session scores zero without dividing by zero", () => {
    const s = createSession({ kind: "practice", label: "p", qkeys: [], now: 1 });
    expect(scoreSession(s, new Map()).accuracy).toBe(0);
  });
});
