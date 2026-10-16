"use client";
import { useState } from "react";
import { useNv } from "@/nvidia/store";
import { isValidDay } from "@/lib/dates";
import { NV_BANK } from "@/nvidia/bank";

export default function Page() {
  const nv = useNv();
  const [start, setStart] = useState(nv.settings.startDate);
  const [exam, setExam] = useState(nv.settings.examDate);
  const [msg, setMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const valid = isValidDay(start) && isValidDay(exam) && start <= exam;

  const save = async () => { await nv.saveSettings({ startDate: start, examDate: exam }); setMsg("Saved."); };
  const download = () => {
    const blob = new Blob([JSON.stringify(nv.exportBackup(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nca-genl-prep-backup-${nv.today}.json`; a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup downloaded.");
  };
  const restore = async (f: File | undefined) => {
    if (!f) return;
    const r = await nv.restore(await f.text());
    setMsg(r.ok ? "Backup restored." : `Could not restore: ${r.errors.join("; ")}`);
  };
  return (
    <div>
      <h1>Settings</h1>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Dates</h2>
        <label>Plan start date <input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Exam date <input type="date" value={exam} onChange={(e) => setExam(e.target.value)} /></label>
        {!valid && <p className="small" role="alert" style={{ color: "var(--bad)" }}>Use valid dates, with the start on or before the exam.</p>}
        <button className="btn" onClick={save} disabled={!valid}>Save dates</button>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Backup</h2>
        <p className="small">Your progress lives only in this browser. Clearing site data, or switching browser or device, loses it. Download a backup now and then.</p>
        <div className="row">
          <button className="btn" onClick={download}>Download backup</button>
          <label className="btn secondary" style={{ margin: 0 }}>Restore from file
            <input type="file" accept="application/json,.json" className="sr" onChange={(e) => restore(e.target.files?.[0])} />
          </label>
        </div>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Reset progress</h2>
        {!confirmReset ? <button className="btn danger" onClick={() => setConfirmReset(true)}>Reset all progress…</button> : (
          <div role="alertdialog" aria-label="Confirm reset">
            <p><strong>This deletes every attempt, mock and bookmark in this browser.</strong> Download a backup first if you might want it.</p>
            <div className="row">
              <button className="btn danger" onClick={async () => { await nv.resetProgress(); setConfirmReset(false); setMsg("Progress reset."); }}>Yes, delete everything</button>
              <button className="btn secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>About this app</h2>
        <ul className="small">
          <li>Unofficial and independent. Not affiliated with, endorsed by or sponsored by NVIDIA. NVIDIA and product names belong to their owners.</li>
          <li>{NV_BANK.length} original practice questions. No real exam content. Not expert-reviewed.</li>
          <li>The answers ship to your browser with the page, so this is a self-study tool, not a secure test.</li>
          <li>Nothing you do here is sent to a server. There are no accounts and no analytics.</li>
          <li>Site safety: a strict content-security policy, detection of injected scripts or frames, and a remote off switch the owner can flip. If something looks wrong the site shows a lock screen instead of running. Your saved progress is not touched by a lock.</li>
        </ul>
      </section>
      <div role="status" aria-live="polite">{msg && <div className="callout">{msg}</div>}</div>
    </div>
  );
}
