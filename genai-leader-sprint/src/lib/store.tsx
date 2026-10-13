"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BUILT_IN_BANK, BUILT_IN_META, buildQuestions } from "./bank";
import { Db, makeBackup, type Snapshot } from "./db";
import { addDays, stockholmDay } from "./dates";
import {
  ALLOC_20, ALLOC_MOCK, DOMAINS, type AppQuestion, type Attempt, type Backup, type Domain, type ImportedSet, type Session, type Settings,
} from "./types";
import {
  buildQStates, computeMetrics, createSession, finalizeExam, learningPool, mockAvailability, objectiveMastery, practicePool, readiness,
  selectByAllocation, selectWeakDrill, submitAnswer as engineSubmit, usedMocks, weakestDomains, pickPrioritised, applyFilters, type Filters, type MockAvailability,
} from "./engine";
import { hashStr, mulberry32, shuffle } from "./rng";
import { parseBankJson, validateBackup } from "./validate";
import { programView } from "./program";

export function defaultSettings(now = Date.now()): Settings {
  const today = stockholmDay(now);
  return { startDate: today, examDate: addDays(today, 11), minutesPerDay: 120, language: "en" };
}

/** Largest-remainder scaling of the 6/7/4/3 allocation to n questions. */
export function scaleAlloc(n: number): Record<Domain, number> {
  const base = DOMAINS.map((d) => ({ d, exact: (ALLOC_20[d] / 20) * n }));
  const out = Object.fromEntries(base.map((b) => [b.d, Math.floor(b.exact)])) as Record<Domain, number>;
  let left = n - Object.values(out).reduce((a, b) => a + b, 0);
  for (const b of [...base].sort((x, y) => y.exact - Math.floor(y.exact) - (x.exact - Math.floor(x.exact)))) {
    if (left-- <= 0) break;
    out[b.d]++;
  }
  return out;
}

export interface PracticeRequest {
  kind: "mixed" | "filtered" | "weak";
  count: number;
  filters: Filters;
}
export interface Launch { session?: Session; error?: string; note?: string }

interface Ctx {
  ready: boolean;
  dbError: string | null;
  settings: Settings;
  sessions: Session[];
  attempts: Attempt[];
  bookmarks: Set<string>;
  imported: ImportedSet | null;
  questions: AppQuestion[];
  byKey: Map<string, AppQuestion>;
  states: ReturnType<typeof buildQStates>;
  metrics: ReturnType<typeof computeMetrics>;
  mastery: ReturnType<typeof objectiveMastery>;
  ready_: ReturnType<typeof readiness>;
  program: ReturnType<typeof programView>;
  today: string;
  used: Set<number>;
  mockStatus: MockAvailability[];
  getSession: (id: string) => Session | undefined;
  saveSettings: (s: Settings) => Promise<void>;
  persistSession: (s: Session, newAttempts?: Attempt[]) => Promise<void>;
  submitQuestion: (s: Session, q: AppQuestion) => Promise<Session>;
  finishSession: (s: Session) => Promise<Session>;
  finishExam: (s: Session) => Promise<Session>;
  toggleBookmark: (key: string) => Promise<void>;
  startDiagnostic: () => Promise<Launch>;
  startLearn: (objective: string) => Promise<Launch>;
  startPractice: (r: PracticeRequest) => Promise<Launch>;
  startReviewDue: () => Promise<Launch>;
  startExam: (n: 1 | 2 | 3) => Promise<Launch>;
  importBank: (text: string) => Promise<{ ok: boolean; errors: string[]; count?: number }>;
  clearImported: () => Promise<void>;
  makeBackupObject: () => Backup;
  restoreBackup: (text: string) => Promise<{ ok: boolean; errors: string[] }>;
  resetProgress: () => Promise<void>;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const dbRef = useRef<Db | null>(null);
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(() => defaultSettings());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [imported, setImported] = useState<ImportedSet | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now()); // refreshed each minute so "today" stays current

  const applySnapshot = useCallback((s: Snapshot) => {
    setSessions(s.sessions);
    setAttempts(s.attempts);
    setBookmarks(s.bookmarks);
    setImported(s.imported);
    if (s.settings) setSettings(s.settings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await Db.open();
        dbRef.current = db;
        const snap = await db.load();
        // Handle exams whose persisted deadline passed while the app was closed.
        const qs = buildQuestions(BUILT_IN_BANK, BUILT_IN_META, snap.imported);
        const byKey = new Map(qs.map((q) => [q.key, q]));
        const seen = new Set(snap.attempts.map((a) => a.qkey));
        const now = Date.now();
        for (let i = 0; i < snap.sessions.length; i++) {
          const s = snap.sessions[i];
          if (s.kind === "exam" && s.status === "active" && s.deadline && now >= s.deadline) {
            const r = finalizeExam(s, byKey, seen, now);
            await db.putSession(r.session, r.attempts);
            r.attempts.forEach((a) => seen.add(a.qkey));
            snap.sessions[i] = r.session;
            snap.attempts.push(...r.attempts);
          }
        }
        if (!cancelled) {
          applySnapshot(snap);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setDbError(`Local storage (IndexedDB) is unavailable: ${(e as Error).message}. Progress will not be saved.`);
          setReady(true);
        }
      }
    })();
    const iv = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [applySnapshot]);

  const questions = useMemo(() => buildQuestions(BUILT_IN_BANK, BUILT_IN_META, imported), [imported]);
  const byKey = useMemo(() => new Map(questions.map((q) => [q.key, q])), [questions]);
  const states = useMemo(() => buildQStates(attempts), [attempts]);
  const metrics = useMemo(() => computeMetrics(attempts, byKey), [attempts, byKey]);
  const mastery = useMemo(() => objectiveMastery(attempts, byKey), [attempts, byKey]);
  const ready_ = useMemo(() => readiness(sessions, byKey, mastery), [sessions, byKey, mastery]);
  const today = useMemo(() => stockholmDay(nowTs), [nowTs]);
  const program = useMemo(() => programView(settings.startDate, today, attempts, sessions), [settings.startDate, today, attempts, sessions]);
  const used = useMemo(() => usedMocks(sessions), [sessions]);
  const mockStatus = useMemo(() => ([1, 2, 3] as const).map((n) => mockAvailability(questions.filter((q) => !q.imported), n)), [questions]);
  const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

  const sessionsRef = useRef(sessions);
  const attemptsRef = useRef(attempts);
  useEffect(() => { sessionsRef.current = sessions; attemptsRef.current = attempts; });

  const persistSession = useCallback(async (s: Session, newAttempts: Attempt[] = []) => {
    sessionsRef.current = sessionsRef.current.some((x) => x.id === s.id)
      ? sessionsRef.current.map((x) => (x.id === s.id ? s : x))
      : [...sessionsRef.current, s];
    attemptsRef.current = [...attemptsRef.current, ...newAttempts];
    setSessions(sessionsRef.current);
    setAttempts(attemptsRef.current);
    await dbRef.current?.putSession(s, newAttempts);
  }, []);

  const seenSet = () => new Set(attemptsRef.current.map((a) => a.qkey));

  const submitQuestion = useCallback(async (s: Session, q: AppQuestion) => {
    const r = engineSubmit(s, q, seenSet(), Date.now());
    await persistSession(r.session, r.attempt ? [r.attempt] : []);
    return r.session;
  }, [persistSession]);

  const finishSession = useCallback(async (s: Session) => {
    const next: Session = { ...s, status: "submitted", submittedAt: Date.now() };
    await persistSession(next);
    return next;
  }, [persistSession]);

  const finishExam = useCallback(async (s: Session) => {
    const r = finalizeExam(s, byKey, seenSet(), Date.now());
    await persistSession(r.session, r.attempts);
    return r.session;
  }, [byKey, persistSession]);

  const saveSettings = useCallback(async (s: Settings) => {
    setSettings(s);
    await dbRef.current?.setKv("settings", s);
  }, []);

  const toggleBookmark = useCallback(async (key: string) => {
    const next = bookmarks.includes(key) ? bookmarks.filter((k) => k !== key) : [...bookmarks, key];
    setBookmarks(next);
    await dbRef.current?.setKv("bookmarks", next);
  }, [bookmarks]);

  const seed = (label: string) => `${label}:${Date.now()}`;

  const launch = useCallback(async (s: Session): Promise<Launch> => {
    await persistSession(s);
    return { session: s };
  }, [persistSession]);

  const startDiagnostic = useCallback(async (): Promise<Launch> => {
    const pool = learningPool(questions.filter((q) => !q.imported));
    const sel = selectByAllocation(pool, ALLOC_20, states, today, seed("diag"));
    if (!sel.qkeys.length) return { error: "No diagnostic questions are available in the bank yet." };
    const short = Object.keys(sel.shortfall).length > 0;
    const s = createSession({ kind: "diagnostic", label: `Diagnostic (${sel.qkeys.length} questions)`, qkeys: sel.qkeys, now: Date.now() });
    return { ...(await launch(s)), note: short ? "The bank does not yet have enough questions in every domain for the 6/7/4/3 split; the diagnostic is smaller than 20." : undefined };
  }, [questions, states, today, launch]);

  const startLearn = useCallback(async (objective: string): Promise<Launch> => {
    const pool = learningPool(questions.filter((q) => !q.imported)).filter((q) => q.meta.objective === objective);
    const rng = mulberry32(hashStr(seed("learn")));
    const picked = pickPrioritised(pool, 10, states, today, rng);
    if (!picked.length) return { error: "No learning questions exist for this objective yet." };
    const s = createSession({ kind: "learn", label: `Learn set · ${objective}`, qkeys: picked.map((q) => q.key), now: Date.now(), objective });
    return launch(s);
  }, [questions, states, today, launch]);

  const startPractice = useCallback(async (r: PracticeRequest): Promise<Launch> => {
    const pool = practicePool(questions, used);
    const rng = mulberry32(hashStr(seed("prac")));
    const filtersActive = !!(r.filters.domain && r.filters.domain !== "all") || !!r.filters.tag || (r.filters.difficulty && r.filters.difficulty !== "all") || (r.filters.status && r.filters.status !== "any");
    if (r.kind === "weak") {
      const weak = weakestDomains(metrics, 2);
      if (!weak.length) return { error: "Weak-area drills need some first-attempt results. Take the diagnostic or a practice set first." };
      const qkeys = selectWeakDrill(pool, weak, r.count, states, today, seed("weak"));
      if (!qkeys.length) return { error: "No questions available in your weakest domains." };
      return launch(createSession({ kind: "drill", label: `Weak-area drill · ${weak.join(" + ")} (non-standard weights)`, qkeys, now: Date.now() }));
    }
    if (r.kind === "mixed" && !filtersActive) {
      const sel = selectByAllocation(pool, scaleAlloc(r.count), states, today, seed("mix"));
      if (!sel.qkeys.length) return { error: "No questions available." };
      return { ...(await launch(createSession({ kind: "practice", label: `Mixed practice (${sel.qkeys.length}, 6/7/4/3 weights)`, qkeys: sel.qkeys, now: Date.now() }))), note: Object.keys(sel.shortfall).length ? "Some domains do not have enough questions yet, so the set is smaller or off the standard weights." : undefined };
    }
    const cands = applyFilters(pool, r.filters, states, bookmarkSet, today);
    const picked = pickPrioritised(cands, r.count, states, today, rng);
    if (!picked.length) return { error: "No questions match these filters." };
    return launch(createSession({ kind: "practice", label: `Filtered practice (${picked.length}, not standard weights)`, qkeys: shuffle(picked.map((q) => q.key), rng), now: Date.now() }));
  }, [questions, used, states, today, metrics, bookmarkSet, launch]);

  const startReviewDue = useCallback(async (): Promise<Launch> => startPractice({ kind: "filtered", count: 20, filters: { status: "due" } }), [startPractice]);

  const startExam = useCallback(async (n: 1 | 2 | 3): Promise<Launch> => {
    const existing = sessionsRef.current.find((s) => s.kind === "exam" && s.mockNo === n && s.status === "active");
    if (existing) return { session: existing };
    const av = mockStatus[n - 1];
    if (!av.ready) return { error: `Mock ${n} is not available: only ${av.total} of 60 questions are authored.` };
    const qs = questions.filter((q) => !q.imported && q.meta.mock === n);
    const rng = mulberry32(hashStr(seed("exam" + n)));
    const repeat = used.has(n);
    return launch(createSession({ kind: "exam", label: `Mock exam ${n}${repeat ? " (repeated)" : ""}`, qkeys: shuffle(qs.map((q) => q.key), rng), now: Date.now(), mockNo: n, repeat }));
  }, [mockStatus, questions, used, launch]);

  const importBank = useCallback(async (text: string) => {
    const r = parseBankJson(text);
    if (!r.ok) return { ok: false, errors: r.errors };
    const set: ImportedSet = { importedAt: Date.now(), questions: r.bank.questions };
    await dbRef.current?.setKv("imported", set); // single put: atomic
    setImported(set);
    return { ok: true, errors: [], count: set.questions.length };
  }, []);
  const clearImported = useCallback(async () => {
    await dbRef.current?.setKv("imported", null);
    setImported(null);
  }, []);

  const makeBackupObject = useCallback(
    () => makeBackup({ settings, sessions: sessionsRef.current, attempts: attemptsRef.current, bookmarks, imported }),
    [settings, bookmarks, imported],
  );

  const restoreBackup = useCallback(async (text: string) => {
    let data: unknown;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }; }
    const v = validateBackup(data);
    if (!v.ok) return { ok: false, errors: v.errors };
    const b = data as Backup;
    await dbRef.current?.replaceAll({ settings: b.settings, sessions: b.sessions, attempts: b.attempts, bookmarks: b.bookmarks, imported: b.imported ?? null });
    sessionsRef.current = b.sessions; attemptsRef.current = b.attempts;
    applySnapshot({ settings: b.settings, sessions: b.sessions, attempts: b.attempts, bookmarks: b.bookmarks, imported: b.imported ?? null });
    return { ok: true, errors: [] };
  }, [applySnapshot]);

  const resetProgress = useCallback(async () => {
    await dbRef.current?.resetProgress(true);
    sessionsRef.current = []; attemptsRef.current = [];
    setSessions([]); setAttempts([]); setBookmarks([]);
  }, []);

  const value: Ctx = {
    ready, dbError, settings, sessions, attempts, bookmarks: bookmarkSet, imported, questions, byKey, states, metrics, mastery, ready_, program, today, used, mockStatus,
    getSession: (id) => sessionsRef.current.find((s) => s.id === id) ?? sessions.find((s) => s.id === id),
    saveSettings, persistSession, submitQuestion, finishSession, finishExam, toggleBookmark,
    startDiagnostic, startLearn, startPractice, startReviewDue, startExam,
    importBank, clearImported, makeBackupObject, restoreBackup, resetProgress,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
export { ALLOC_MOCK };
