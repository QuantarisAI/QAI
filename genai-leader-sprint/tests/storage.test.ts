import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { Db, makeBackup } from "../src/lib/db";
import { createSession } from "../src/lib/engine";
import { parseBankJson, validateBackup, validateBankFile } from "../src/lib/validate";
import { mkAttempt, mkBank } from "./helpers";
import { DOMAINS } from "../src/lib/types";

const NOW = Date.parse("2026-10-14T09:00:00Z");
const bank = mkBank(2);
let idb: IDBFactory;
beforeEach(() => { idb = new IDBFactory(); });

const goodFile = () => ({
  quiz_metadata: { target_certification: "Google Cloud Generative AI Leader", total_questions: 2 },
  questions: [1, 2].map((id) => ({
    id, exam_domain: "Fundamentals", scenario_question: `S${id}`, hint: "h",
    options: ["A", "B", "C", "D"].map((l, i) => ({ option_letter: l, text: `T${l}`, is_correct: i === 0, business_rationale: `R${l}` })),
  })),
});

describe("persistence", () => {
  it("survives closing and reopening the database (reload)", async () => {
    const db = await Db.open(idb);
    const s = createSession({ kind: "exam", label: "Mock 1", qkeys: [bank[0].key], now: NOW, mockNo: 1 });
    s.answers[bank[0].key] = { letter: "B", at: NOW, submitted: false };
    await db.putSession(s, [mkAttempt(bank[0], { correct: true })]);
    await db.setKv("settings", { startDate: "2026-10-14", examDate: "2026-10-25", minutesPerDay: 120, language: "en" });
    await db.setKv("bookmarks", ["3"]);
    db.close();
    const snap = await (await Db.open(idb)).load();
    expect(snap.sessions[0].deadline).toBe(s.deadline);
    expect(snap.sessions[0].answers[bank[0].key].letter).toBe("B");
    expect(snap.attempts).toHaveLength(1);
    expect(snap.settings?.examDate).toBe("2026-10-25");
    expect(snap.bookmarks).toEqual(["3"]);
  });
});

describe("import validation", () => {
  it("accepts the base contract", () => {
    expect(validateBankFile(goodFile()).ok).toBe(true);
  });
  it("reports actionable errors for every kind of problem", () => {
    const f = goodFile() as unknown as { quiz_metadata: { total_questions: number }; questions: { id: number; exam_domain: string; hint: string; options: { option_letter: string; is_correct: boolean; text: string }[] }[] };
    f.quiz_metadata.total_questions = 5;
    f.questions[1].id = 1;
    f.questions[0].exam_domain = "Cooking";
    f.questions[0].options[1].is_correct = true;
    f.questions[1].options[2].option_letter = "A";
    f.questions[1].options[3].text = "  ";
    f.questions[1].hint = "";
    const r = validateBankFile(f);
    expect(r.ok).toBe(false);
    const all = r.errors.join("\n");
    for (const needle of ["total_questions", "duplicate", "exam_domain", "exactly one correct", "repeated", "text must be non-empty", "hint"]) expect(all).toContain(needle);
  });
  it("rejects wrong option counts, non-positive ids and bad JSON", () => {
    const f = goodFile() as unknown as { quiz_metadata: { total_questions: number }; questions: { id: number; exam_domain: string; hint: string; options: { option_letter: string; is_correct: boolean; text: string }[] }[] };
    f.questions[0].options.pop();
    f.questions[1].id = 0;
    const r = validateBankFile(f);
    expect(r.errors.join(" ")).toMatch(/exactly 4 options/);
    expect(r.errors.join(" ")).toMatch(/positive integer/);
    expect(parseBankJson("{nope").ok).toBe(false);
    expect(validateBankFile([]).ok).toBe(false);
  });
  it("rejected import leaves stored data untouched (validation precedes any write)", async () => {
    const db = await Db.open(idb);
    await db.setKv("imported", { importedAt: 1, questions: goodFile().questions });
    const bad = JSON.stringify({ ...goodFile(), quiz_metadata: { target_certification: "x", total_questions: 99 } });
    const parsed = parseBankJson(bad);
    expect(parsed.ok).toBe(false);
    // the app only writes after parse succeeds
    const snap = await db.load();
    expect(snap.imported?.questions).toHaveLength(2);
  });
});

describe("backup and restore", () => {
  it("round-trips everything and replaces existing data atomically", async () => {
    const db = await Db.open(idb);
    const s = createSession({ kind: "practice", label: "p", qkeys: [bank[1].key], now: NOW });
    await db.putSession(s, [mkAttempt(bank[1], { correct: false })]);
    await db.setKv("bookmarks", ["9"]);
    const b = makeBackup(await db.load());
    expect(validateBackup(JSON.parse(JSON.stringify(b))).ok).toBe(true);

    const other = await Db.open(new IDBFactory());
    const s2 = createSession({ kind: "practice", label: "old", qkeys: [bank[2].key], now: NOW });
    await other.putSession(s2, [mkAttempt(bank[2], { correct: true })]);
    await other.replaceAll({ settings: b.settings, sessions: b.sessions, attempts: b.attempts, bookmarks: b.bookmarks, imported: b.imported });
    const after = await other.load();
    expect(after.sessions.map((x) => x.id)).toEqual([s.id]);
    expect(after.attempts).toHaveLength(1);
    expect(after.bookmarks).toEqual(["9"]);
  });
  it("rejects malformed backups with errors", () => {
    expect(validateBackup({ app: "other" }).ok).toBe(false);
    expect(validateBackup({ app: "genai-leader-sprint", version: 1, settings: null, sessions: [{}], attempts: [], bookmarks: [] }).errors.join()).toContain("sessions[0]");
  });
  it("failed restore does not corrupt data: replaceAll aborts as a unit", async () => {
    const db = await Db.open(idb);
    const s = createSession({ kind: "practice", label: "keep", qkeys: [bank[0].key], now: NOW });
    await db.putSession(s, [mkAttempt(bank[0], { correct: true })]);
    // a record without the 'id' keyPath makes the transaction abort
    await expect(db.replaceAll({ settings: null, sessions: [{ nope: 1 } as unknown as never], attempts: [], bookmarks: [], imported: null })).rejects.toBeTruthy();
    const snap = await db.load();
    expect(snap.sessions.map((x) => x.label)).toEqual(["keep"]);
    expect(snap.attempts).toHaveLength(1);
  });
  it("reset clears progress but keeps settings and imported set", async () => {
    const db = await Db.open(idb);
    await db.putSession(createSession({ kind: "practice", label: "p", qkeys: [bank[0].key], now: NOW }), [mkAttempt(bank[0], { correct: true })]);
    await db.setKv("settings", { startDate: "2026-10-14", examDate: "2026-10-25", minutesPerDay: 90, language: "hinglish" });
    await db.setKv("imported", { importedAt: 1, questions: goodFile().questions });
    await db.resetProgress(true);
    const snap = await db.load();
    expect(snap.sessions).toHaveLength(0);
    expect(snap.attempts).toHaveLength(0);
    expect(snap.settings?.language).toBe("hinglish");
    expect(snap.imported).not.toBeNull();
  });
});

describe("domains constant", () => { it("has the four allowed domains", () => { expect(DOMAINS).toHaveLength(4); }); });
