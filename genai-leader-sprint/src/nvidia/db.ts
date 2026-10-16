import type { Attempt, NvBackup, NvSettings, Session } from "./types";

const DB_NAME = "nca-genl-prep";
const VERSION = 1;
const STORES = ["sessions", "attempts", "kv"] as const;

function open(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = idb.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("sessions", { keyPath: "id" });
      db.createObjectStore("attempts", { keyPath: "id" });
      db.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error("transaction aborted"));
  });
const reqP = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

export interface NvSnapshot {
  settings: NvSettings | null;
  sessions: Session[];
  attempts: Attempt[];
  bookmarks: string[];
}

export class NvDb {
  private constructor(private db: IDBDatabase) {}
  static async open(idb: IDBFactory = indexedDB) {
    return new NvDb(await open(idb));
  }
  close() {
    this.db.close();
  }
  async load(): Promise<NvSnapshot> {
    const tx = this.db.transaction([...STORES], "readonly");
    const [sessions, attempts, settings, bookmarks] = await Promise.all([
      reqP(tx.objectStore("sessions").getAll()),
      reqP(tx.objectStore("attempts").getAll()),
      reqP(tx.objectStore("kv").get("settings")),
      reqP(tx.objectStore("kv").get("bookmarks")),
    ]);
    return { sessions, attempts, settings: settings ?? null, bookmarks: bookmarks ?? [] };
  }
  async putSession(s: Session, attempts: Attempt[] = []) {
    const tx = this.db.transaction(["sessions", "attempts"], "readwrite");
    tx.objectStore("sessions").put(s);
    for (const a of attempts) tx.objectStore("attempts").put(a);
    await done(tx);
  }
  async setKv(key: "settings" | "bookmarks", value: unknown) {
    const tx = this.db.transaction(["kv"], "readwrite");
    if (value === null || value === undefined) tx.objectStore("kv").delete(key);
    else tx.objectStore("kv").put(value, key);
    await done(tx);
  }
  /** Replace everything in ONE transaction: either all of it lands or none of it does. */
  async replaceAll(b: NvSnapshot) {
    const tx = this.db.transaction([...STORES], "readwrite");
    const finished = done(tx);
    finished.catch(() => undefined);
    try {
      tx.objectStore("sessions").clear();
      tx.objectStore("attempts").clear();
      tx.objectStore("kv").clear();
      for (const s of b.sessions) tx.objectStore("sessions").put(s);
      for (const a of b.attempts) tx.objectStore("attempts").put(a);
      const kv = tx.objectStore("kv");
      if (b.settings) kv.put(b.settings, "settings");
      kv.put(b.bookmarks, "bookmarks");
    } catch (e) {
      try { tx.abort(); } catch { /* already finished */ }
      await finished.catch(() => undefined);
      throw e;
    }
    await finished;
  }
  async resetProgress() {
    const snap = await this.load();
    await this.replaceAll({ settings: snap.settings, sessions: [], attempts: [], bookmarks: [] });
  }
}

export function makeBackup(s: NvSnapshot): NvBackup {
  return { app: "nca-genl-prep", version: 1, exportedAt: Date.now(), ...s };
}

/* ---------------- Backup validation (restore must never trust the file) ---------------- */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function validateBackup(text: string, knownQids: Set<string>): { ok: true; backup: NvBackup } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (text.length > 20_000_000) return { ok: false, errors: ["File is too large."] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ["Not valid JSON."] }; }
  if (!isObj(raw) || raw.app !== "nca-genl-prep" || raw.version !== 1) return { ok: false, errors: ["This is not a backup from this app."] };
  const { settings, sessions, attempts, bookmarks } = raw as Record<string, unknown>;
  if (settings !== null && !(isObj(settings) && typeof settings.startDate === "string" && DAY.test(settings.startDate) && typeof settings.examDate === "string" && DAY.test(settings.examDate))) errors.push("settings are invalid");
  if (!Array.isArray(sessions)) errors.push("sessions must be a list");
  if (!Array.isArray(attempts)) errors.push("attempts must be a list");
  if (!Array.isArray(bookmarks) || !bookmarks.every((b) => typeof b === "string")) errors.push("bookmarks must be a list of ids");
  if (errors.length) return { ok: false, errors };
  const ids = new Set<string>();
  for (const [i, s] of (sessions as unknown[]).entries()) {
    if (!isObj(s) || typeof s.id !== "string" || !Array.isArray(s.qids) || !isObj(s.answers) || typeof s.startedAt !== "number" || !["practice", "mock", "review"].includes(s.kind as string) || !["active", "submitted", "expired"].includes(s.status as string)) { errors.push(`session ${i} is malformed`); continue; }
    if (ids.has(s.id)) errors.push(`duplicate session id ${s.id}`);
    ids.add(s.id);
    if (!(s.qids as unknown[]).every((q) => typeof q === "string" && knownQids.has(q))) errors.push(`session ${i} refers to unknown questions`);
  }
  const aids = new Set<string>();
  for (const [i, a] of (attempts as unknown[]).entries()) {
    if (!isObj(a) || typeof a.id !== "string" || typeof a.qid !== "string" || typeof a.correct !== "boolean" || typeof a.at !== "number" || typeof a.day !== "string" || !DAY.test(a.day) || !knownQids.has(a.qid)) { errors.push(`attempt ${i} is malformed`); continue; }
    if (aids.has(a.id)) errors.push(`duplicate attempt id ${a.id}`);
    aids.add(a.id);
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };
  return { ok: true, backup: raw as unknown as NvBackup };
}
