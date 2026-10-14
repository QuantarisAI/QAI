import type { Attempt, Backup, ImportedSet, Session, Settings } from "./types";

const DB_NAME = "genai-leader-sprint";
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

export interface Snapshot {
  settings: Settings | null;
  sessions: Session[];
  attempts: Attempt[];
  bookmarks: string[];
  imported: ImportedSet | null;
}

export class Db {
  private constructor(private db: IDBDatabase) {}
  static async open(idb: IDBFactory = indexedDB) {
    return new Db(await open(idb));
  }
  close() {
    this.db.close();
  }
  async load(): Promise<Snapshot> {
    const tx = this.db.transaction([...STORES], "readonly");
    const [sessions, attempts, settings, bookmarks, imported] = await Promise.all([
      reqP(tx.objectStore("sessions").getAll()),
      reqP(tx.objectStore("attempts").getAll()),
      reqP(tx.objectStore("kv").get("settings")),
      reqP(tx.objectStore("kv").get("bookmarks")),
      reqP(tx.objectStore("kv").get("imported")),
    ]);
    return { sessions, attempts, settings: settings ?? null, bookmarks: bookmarks ?? [], imported: imported ?? null };
  }
  async putSession(s: Session, attempts: Attempt[] = []) {
    const tx = this.db.transaction(["sessions", "attempts"], "readwrite");
    tx.objectStore("sessions").put(s);
    for (const a of attempts) tx.objectStore("attempts").put(a);
    await done(tx);
  }
  async setKv(key: "settings" | "bookmarks" | "imported", value: unknown) {
    const tx = this.db.transaction(["kv"], "readwrite");
    if (value === null || value === undefined) tx.objectStore("kv").delete(key);
    else tx.objectStore("kv").put(value, key);
    await done(tx);
  }
  /** Replace everything in ONE transaction: either all of it lands or none of it does. */
  async replaceAll(b: Omit<Backup, "app" | "version" | "exportedAt">) {
    const tx = this.db.transaction([...STORES], "readwrite");
    const finished = done(tx);
    finished.catch(() => undefined); // avoid an unhandled rejection when we abort deliberately
    try {
      tx.objectStore("sessions").clear();
      tx.objectStore("attempts").clear();
      tx.objectStore("kv").clear();
      for (const s of b.sessions) tx.objectStore("sessions").put(s);
      for (const a of b.attempts) tx.objectStore("attempts").put(a);
      const kv = tx.objectStore("kv");
      if (b.settings) kv.put(b.settings, "settings");
      kv.put(b.bookmarks, "bookmarks");
      if (b.imported) kv.put(b.imported, "imported");
    } catch (e) {
      // A synchronous failure (e.g. a record missing its key) must roll back the earlier clear() calls.
      try { tx.abort(); } catch { /* already finished */ }
      await finished.catch(() => undefined);
      throw e;
    }
    await finished;
  }
  async resetProgress(keepImported = true) {
    const snap = await this.load();
    await this.replaceAll({ settings: snap.settings, sessions: [], attempts: [], bookmarks: [], imported: keepImported ? snap.imported : null });
  }
}

export function makeBackup(s: Snapshot): Backup {
  return { app: "genai-leader-sprint", version: 1, exportedAt: Date.now(), ...s };
}
