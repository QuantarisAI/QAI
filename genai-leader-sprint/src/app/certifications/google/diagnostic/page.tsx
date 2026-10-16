"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useLauncher } from "@/components/Launcher";

export default function Page() {
  const app = useApp();
  const { run, banner } = useLauncher();
  const active = app.sessions.filter((s) => s.kind === "diagnostic" && s.status === "active");
  const done = app.sessions.filter((s) => s.kind === "diagnostic" && s.submittedAt);
  return (
    <div>
      <h1>Diagnostic</h1>
      <p>Twenty questions split 6 / 7 / 4 / 3 across Fundamentals, Google Cloud Offerings, Output Improvement and Business Strategy &amp; Security, drawn only from the learning pool (never from reserved mock questions).</p>
      <div className="callout">A 20-question sample is a small, noisy signal about where to start. It is <strong>not</strong> a reliable prediction of exam readiness or of passing.</div>
      {banner}
      {active.map((s) => <p key={s.id}><Link className="btn" href={`/certifications/google/session?id=${s.id}`}>Resume diagnostic</Link></p>)}
      <button type="button" className="btn" onClick={() => run(app.startDiagnostic)}>{done.length ? "Take another diagnostic" : "Start diagnostic"}</button>
      {done.length > 0 && <><h2>Previous diagnostics</h2><ul>{done.map((s) => <li key={s.id}><Link href={`/certifications/google/results?id=${s.id}`}>{s.label} · {new Date(s.submittedAt!).toLocaleString()}</Link></li>)}</ul></>}
    </div>
  );
}
