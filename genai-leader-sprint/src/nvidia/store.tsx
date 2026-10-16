"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { stockholmDay } from "@/lib/dates";
import { NV_BANK, NV_BY_ID } from "./bank";
import { NvDb, makeBackup, validateBackup, type NvSnapshot } from "./db";
import {
  MOCK_BY_ID, buildMock, buildQStates, dueQids, finalize, isExpired, ladder, makeSession, markHinted, pick, readiness, seenSet,
  setMockAnswer, submitAnswer, toggleFlag, weakTopics, type Cell, type QState, type Readiness,
} from "./engine";
import { NV_EXAM, type Attempt, type Confidence, type DomainId, type Letter, type Level, type NvBackup, type NvQuestion, type NvSettings, type Session } from "./types";

export const defaultSettings = (): NvSettings => ({ startDate: NV_EXAM.defaultStartDate, examDate: NV_EXAM.defaultExamDate });

export type LaunchSpec =
  | { kind: "ladder"; topic: string; level?: Level }
  | { kind: "weak" }
  | { kind: "due" }
  | { kind: "mixed"; count: number }
  | { kind: "domain"; domain: DomainId; count: number };

interface Ctx {
  ready: boolean;
  dbError: string | null;
  settings: NvSettings;
  sessions: Session[];
  attempts: Attempt[];
  bookmarks: Set<string>;
  bank: NvQuestion[];
  byId: Map<string, NvQuestion>;
  states: Map<string, QState>;
  cells: Map<string, Cell>;
  today: string;
  due: string[];
  seen: Set<string>;
  readiness: Readiness;
  activeSession: (mockId?: string) => Session | undefined;
  getSession: (id: string) => Session | undefined;
  saveSettings: (s: NvSettings) => Promise<void>;
  launch: (spec: LaunchSpec) => Promise<{ session?: Session; error?: string }>;
  startMock: (mockId: string) => Promise<{ session?: Session; error?: string }>;
  persist: (s: Session) => Promise<void>;
  answer: (s: Session, q: NvQuestion, letter: Letter, c?: Confidence) => Promise<Session>;
  mockAnswer: (s: Session, qid: string, letter: Letter | null) => Promise<Session>;
  flag: (s: Session, qid: string) => Promise<Session>;
  hint: (s: Session, qid: string) => Promise<Session>;
  finish: (s: Session) => Promise<Session>;
  toggleBookmark: (qid: string) => Promise<void>;
  exportBackup: () => NvBackup;
  restore: (text: string) => Promise<{ ok: boolean; errors: string[] }>;
  resetProgress: () => Promise<void>;
}
const NvCtx = createContext<Ctx | null>(null);
export const useNv = () => {
  const c = useContext(NvCtx);
  if (!c) throw new Error("useNv outside provider");
  return c;
};

export function NvProvider({ children }: { children: ReactNode }) {
  const dbRef = useRef<NvDb | null>(null);
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NvSettings>(defaultSettings);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const apply = useCallback((s: NvSnapshot) => {
    setSessions(s.sessions);
    setAttempts(s.attempts);
    setBookmarks(s.bookmarks);
    if (s.settings) setSettings(s.settings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await NvDb.open();
        dbRef.current = db;
        const snap = await db.load();
        const seen = seenSet(snap.attempts);
        const now = Date.now();
        for (let i = 0; i < snap.sessions.length; i++) {
          const s = snap.sessions[i];
          if (isExpired(s, now)) {
            // deadline passed while the tab was closed: grade what was saved, using the persisted deadline
            const r = finalize(s, NV_BY_ID, seen, now, "expired");
            await db.putSession(r.session, r.attempts);
            r.attempts.forEach((a) => seen.add(a.qid));
            snap.sessions[i] = r.session;
            snap.attempts.push(...r.attempts);
          }
        }
        if (!cancelled) { apply(snap); setReady(true); }
      } catch (e) {
        if (!cancelled) {
          setDbError(`Local storage (IndexedDB) is unavailable: ${(e as Error).message}. Your progress will not be saved.`);
          setReady(true);
        }
      }
    })();
    const iv = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [apply]);

  const today = useMemo(() => stockholmDay(nowTs), [nowTs]);
  const states = useMemo(() => buildQStates(attempts), [attempts]);
  const cells = useMemo(() => ladder(attempts, NV_BANK), [attempts]);
  const seen = useMemo(() => seenSet(attempts), [attempts]);
  const due = useMemo(() => dueQids(states, today), [states, today]);
  const ready_ = useMemo(() => readiness(sessions, attempts, NV_BY_ID, NV_BANK.length), [sessions, attempts]);
  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  const persist = useCallback(async (s: Session, newAttempts: Attempt[] = []) => {
    setSessions((prev) => (prev.some((x) => x.id === s.id) ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s]));
    if (newAttempts.length) setAttempts((prev) => [...prev, ...newAttempts]);
    try { await dbRef.current?.putSession(s, newAttempts); } catch (e) { setDbError(`Could not save: ${(e as Error).message}`); }
  }, []);

  const getSession = useCallback((id: string) => sessions.find((s) => s.id === id), [sessions]);
  const activeSession = useCallback((mockId?: string) => sessions.find((s) => s.status === "active" && (mockId ? s.mockId === mockId : true)), [sessions]);

  const saveSettings = useCallback(async (s: NvSettings) => {
    setSettings(s);
    try { await dbRef.current?.setKv("settings", s); } catch (e) { setDbError(`Could not save: ${(e as Error).message}`); }
  }, []);

  const launch: Ctx["launch"] = useCallback(async (spec) => {
    const now = Date.now();
    const seed = `${spec.kind}:${now}`;
    let pool: NvQuestion[] = [];
    let count = 15;
    let label = "Practice";
    let topic: string | undefined;
    let level: Level | undefined;
    let kind: Session["kind"] = "practice";
    if (spec.kind === "ladder") {
      pool = NV_BANK.filter((q) => q.topic === spec.topic && (!spec.level || q.level === spec.level));
      count = pool.length;
      topic = spec.topic; level = spec.level;
      label = `${spec.topic}${spec.level ? ` · ${spec.level}` : " · all levels"}`;
    } else if (spec.kind === "weak") {
      const weak = weakTopics(attempts, 3);
      const topics = weak.length ? weak : [];
      pool = topics.length ? NV_BANK.filter((q) => topics.includes(q.topic)) : [];
      count = 15; label = `Weak-topic drill${topics.length ? ` (${topics.join(", ")})` : ""}`;
      if (!pool.length) return { error: "Not enough answers yet to find your weakest topics. Work a few topic ladders first (at least 3 questions in a topic)." };
    } else if (spec.kind === "due") {
      pool = due.map((id) => NV_BY_ID.get(id)).filter(Boolean) as NvQuestion[];
      count = Math.min(20, pool.length); label = "Due mistake review"; kind = "review";
      if (!pool.length) return { error: "No mistakes are due for review today." };
    } else if (spec.kind === "mixed") {
      pool = NV_BANK; count = spec.count; label = `Mixed drill (${spec.count})`;
    } else {
      pool = NV_BANK.filter((q) => q.domain === spec.domain); count = spec.count; label = `Domain drill: ${spec.domain}`;
    }
    const qids = pick(pool, { count: Math.min(count, pool.length), seed, states, today, seen });
    if (!qids.length) return { error: "No questions matched." };
    const session = makeSession({ kind, label, qids, now, seen, topic, level });
    await persist(session);
    return { session };
  }, [attempts, due, persist, seen, states, today]);

  const startMock: Ctx["startMock"] = useCallback(async (mockId) => {
    const def = MOCK_BY_ID.get(mockId);
    if (!def) return { error: "Unknown mock." };
    const existing = sessions.find((s) => s.status === "active" && s.mockId === mockId);
    if (existing) return { session: existing };
    const now = Date.now();
    const qids = buildMock(def, NV_BANK, seen, `${seen.size}:${now}`);
    if (qids.length !== NV_EXAM.mockQuestions) return { error: `Could only assemble ${qids.length} of ${NV_EXAM.mockQuestions} questions.` };
    const session = makeSession({
      kind: "mock", label: def.name, qids, now, seen, mockId,
      deadline: now + NV_EXAM.mockMinutes * 60_000,
    });
    await persist(session);
    return { session };
  }, [persist, seen, sessions]);

  const answer: Ctx["answer"] = useCallback(async (s, q, letter, c) => {
    const r = submitAnswer(s, q, letter, Date.now(), seen, c);
    await persist(r.session, [r.attempt]);
    return r.session;
  }, [persist, seen]);
  const mockAnswer: Ctx["mockAnswer"] = useCallback(async (s, qid, letter) => {
    const n = setMockAnswer(s, qid, letter, Date.now());
    await persist(n);
    return n;
  }, [persist]);
  const flag: Ctx["flag"] = useCallback(async (s, qid) => { const n = toggleFlag(s, qid); await persist(n); return n; }, [persist]);
  const hint: Ctx["hint"] = useCallback(async (s, qid) => { const n = markHinted(s, qid); await persist(n); return n; }, [persist]);
  const finish: Ctx["finish"] = useCallback(async (s) => {
    const r = finalize(s, NV_BY_ID, seen, Date.now(), s.deadline && Date.now() >= s.deadline ? "expired" : "submitted");
    await persist(r.session, r.attempts);
    return r.session;
  }, [persist, seen]);

  const toggleBookmark = useCallback(async (qid: string) => {
    const next = bookmarks.includes(qid) ? bookmarks.filter((b) => b !== qid) : [...bookmarks, qid];
    setBookmarks(next);
    try { await dbRef.current?.setKv("bookmarks", next); } catch (e) { setDbError(`Could not save: ${(e as Error).message}`); }
  }, [bookmarks]);

  const exportBackup = useCallback(() => makeBackup({ settings, sessions, attempts, bookmarks }), [settings, sessions, attempts, bookmarks]);
  const restore: Ctx["restore"] = useCallback(async (text) => {
    const v = validateBackup(text, new Set(NV_BANK.map((q) => q.id)));
    if (!v.ok) return { ok: false, errors: v.errors };
    const snap: NvSnapshot = { settings: v.backup.settings, sessions: v.backup.sessions, attempts: v.backup.attempts, bookmarks: v.backup.bookmarks };
    try { await dbRef.current?.replaceAll(snap); } catch (e) { return { ok: false, errors: [(e as Error).message] }; }
    apply(snap);
    return { ok: true, errors: [] };
  }, [apply]);
  const resetProgress = useCallback(async () => {
    try { await dbRef.current?.resetProgress(); } catch (e) { setDbError(`Could not reset: ${(e as Error).message}`); return; }
    setSessions([]); setAttempts([]); setBookmarks([]);
  }, []);

  const value: Ctx = {
    ready, dbError, settings, sessions, attempts, bookmarks: bookmarkSet, bank: NV_BANK, byId: NV_BY_ID, states, cells, today, due, seen,
    readiness: ready_, activeSession, getSession, saveSettings, launch, startMock, persist, answer, mockAnswer, flag, hint, finish,
    toggleBookmark, exportBackup, restore, resetProgress,
  };
  return <NvCtx.Provider value={value}>{children}</NvCtx.Provider>;
}
