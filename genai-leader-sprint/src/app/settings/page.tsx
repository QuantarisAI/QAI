"use client";
import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { isValidDay, TZ } from "@/lib/dates";
import { BUILT_IN_BANK } from "@/lib/bank";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function Page() {
  const app = useApp();
  const [form, setForm] = useState(app.settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null);
  const [importText, setImportText] = useState("");
  const [confirmReset, setConfirmReset] = useState("");
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!isValidDay(form.startDate) || !isValidDay(form.examDate)) return setMsg({ ok: false, text: "Enter valid dates." });
    if (form.examDate < form.startDate) return setMsg({ ok: false, text: "Exam date must be on or after the start date." });
    if (!(form.minutesPerDay >= 15 && form.minutesPerDay <= 600)) return setMsg({ ok: false, text: "Daily study time must be between 15 and 600 minutes." });
    await app.saveSettings(form); setMsg({ ok: true, text: "Settings saved." });
  };
  const doImport = async (text: string) => {
    const r = await app.importBank(text);
    setMsg(r.ok ? { ok: true, text: `Imported ${r.count} questions as a separate practice-only set. Existing data was not changed.` } : { ok: false, text: "Import rejected. Nothing was changed.", list: r.errors.slice(0, 25) });
  };
  const readFile = (f: File | undefined, cb: (t: string) => void) => { if (!f) return; const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsText(f); };

  return (
    <div>
      <h1>Settings</h1>
      {msg && <div className={`callout ${msg.ok ? "okc" : "err"}`} role="alert">{msg.text}{msg.list && <ul>{msg.list.map((e, i) => <li key={i}>{e}</li>)}</ul>}</div>}
      <section className="card" aria-labelledby="s-plan">
        <h2 id="s-plan" style={{ marginTop: 0 }}>Plan and language</h2>
        <div className="row">
          <label>Program start date<br /><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>Exam date<br /><input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} /></label>
          <label>Study minutes per day<br /><input type="number" min={15} max={600} value={form.minutesPerDay} onChange={(e) => setForm({ ...form, minutesPerDay: Number(e.target.value) })} /></label>
        </div>
        <p className="small muted">Dates are interpreted in {TZ}.</p>
        <fieldset><legend>Explanation language</legend>
          <label><input type="radio" name="lang" checked={form.language === "en"} onChange={() => setForm({ ...form, language: "en" })} /> English</label>
          <label><input type="radio" name="lang" checked={form.language === "hinglish"} onChange={() => setForm({ ...form, language: "hinglish" })} /> Simple Hinglish for decision principles (falls back to English where unavailable)</label>
        </fieldset>
        <button type="button" className="btn" onClick={save}>Save settings</button>
      </section>

      <section className="card" aria-labelledby="s-imp">
        <h2 id="s-imp" style={{ marginTop: 0 }}>Import / export questions</h2>
        <p>Import validates the whole file first and rejects it atomically if anything is wrong. Imported questions go into a separate practice-only set ({app.imported ? `${app.imported.questions.length} currently loaded` : "none loaded"}) and never overwrite the built-in bank. IDs must be positive and unique within the file.</p>
        <textarea aria-label="Paste question JSON" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"quiz_metadata": {...}, "questions": [...]}' />
        <div className="row">
          <button type="button" className="btn" disabled={!importText.trim()} onClick={() => void doImport(importText)}>Validate and import pasted JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => readFile(e.target.files?.[0], (t) => void doImport(t))} />
          <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>Import from file…</button>
          {app.imported && <button type="button" className="btn secondary" onClick={() => void app.clearImported()}>Remove imported set</button>}
        </div>
        <div className="row" style={{ marginTop: ".8rem" }}>
          <button type="button" className="btn secondary" onClick={() => download("genai-leader-sprint-questions.json", BUILT_IN_BANK)}>Export built-in bank (base contract, {BUILT_IN_BANK.questions.length} questions)</button>
          {app.imported && <button type="button" className="btn secondary" onClick={() => download("imported-questions.json", { quiz_metadata: { target_certification: "Google Cloud Generative AI Leader", total_questions: app.imported!.questions.length }, questions: app.imported!.questions })}>Export imported set</button>}
        </div>
        <p className="small muted">The bank ships inside the page, so correctness is visible to anyone who inspects it. This is a self-study tool, not an anti-cheating boundary.</p>
      </section>

      <section className="card" aria-labelledby="s-bak">
        <h2 id="s-bak" style={{ marginTop: 0 }}>Backup and restore</h2>
        <div className="row">
          <button type="button" className="btn secondary" onClick={() => download(`genai-leader-sprint-backup-${app.today}.json`, app.makeBackupObject())}>Download backup</button>
          <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={(e) => readFile(e.target.files?.[0], (t) => setPendingRestore(t))} />
          <button type="button" className="btn secondary" onClick={() => restoreRef.current?.click()}>Restore from file…</button>
        </div>
        {pendingRestore && (
          <div className="callout" role="alert">Restoring replaces ALL current progress. Continue?{" "}
            <button type="button" className="btn danger" onClick={async () => { const r = await app.restoreBackup(pendingRestore); setPendingRestore(null); setMsg(r.ok ? { ok: true, text: "Backup restored." } : { ok: false, text: "Restore rejected. Current data was not changed.", list: r.errors }); }}>Yes, restore</button>{" "}
            <button type="button" className="btn secondary" onClick={() => setPendingRestore(null)}>Cancel</button></div>
        )}
      </section>

      <section className="card" aria-labelledby="s-reset">
        <h2 id="s-reset" style={{ marginTop: 0 }}>Reset progress</h2>
        <p>Deletes all attempts, sessions and bookmarks. Settings and any imported set are kept. Type <strong>RESET</strong> to confirm.</p>
        <div className="row">
          <label>Confirmation<br /><input type="text" value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} autoComplete="off" /></label>
          <button type="button" className="btn danger" disabled={confirmReset !== "RESET"} onClick={async () => { await app.resetProgress(); setConfirmReset(""); setMsg({ ok: true, text: "Progress reset." }); }}>Reset progress</button>
        </div>
      </section>
    </div>
  );
}
