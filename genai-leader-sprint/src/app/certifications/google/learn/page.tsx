"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { useLauncher } from "@/components/Launcher";
import { OBJECTIVES } from "@/data/objectives";
import { LESSONS } from "@/data/lessons";
import { DOMAINS } from "@/lib/types";

const LABEL = { none: "not started", insufficient: "insufficient evidence", learning: "in progress", mastered: "evidence of mastery" } as const;

export default function Page() {
  const app = useApp();
  const { run, banner } = useLauncher();
  const [sel, setSel] = useState(OBJECTIVES[0].id);
  const o = OBJECTIVES.find((x) => x.id === sel)!;
  const l = LESSONS[sel];
  const m = app.mastery[sel];
  const avail = app.questions.filter((q) => !q.imported && q.meta.mock === null && q.meta.objective === sel).length;
  return (
    <div>
      <h1>Learn</h1>
      <div className="callout">Objectives below are this app&apos;s own coverage checklist. The official exam-guide PDF could not be read when this app was built, so these IDs are <strong>not</strong> official objective identifiers, and lesson text is unverified.</div>
      <div className="learn-grid">
        <nav aria-label="Objectives">
          {DOMAINS.map((d) => (
            <div key={d}><h2 style={{ fontSize: "1rem" }}>{d}</h2>
              <ul className="clean">{OBJECTIVES.filter((x) => x.domain === d).map((x) => (
                <li key={x.id}><button type="button" className="btn secondary" style={{ width: "100%", justifyContent: "flex-start", margin: ".15rem 0", background: sel === x.id ? "var(--surface-2)" : "transparent" }} aria-current={sel === x.id} onClick={() => setSel(x.id)}>{x.id} · {x.title}</button></li>
              ))}</ul></div>
          ))}
        </nav>
        <section className="card" aria-live="polite">
          <p className="small muted">{o.domain}</p>
          <h2 style={{ marginTop: 0 }}>{o.id} · {o.title}</h2>
          <p>{o.summary}</p>
          {l && <><ul>{l.points.map((p) => <li key={p}>{p}</li>)}</ul><p><strong>Watch out:</strong> {l.watch}</p></>}
          <p className="small">Evidence: <span className="badge">{LABEL[m?.status ?? "none"]}</span> · {m?.distinctAttempted ?? 0} distinct questions tried · {avail} learning questions available.</p>
          {banner}
          <button type="button" className="btn" disabled={!avail} onClick={() => run(() => app.startLearn(sel))}>{avail ? `Start up to 10 questions` : "No questions for this objective yet"}</button>
          <p className="small muted" style={{ marginTop: ".8rem" }}>Official resources: <a href="https://cloud.google.com/learn/certification/generative-ai-leader" target="_blank" rel="noreferrer">certification page, learning path and sample questions</a>.</p>
        </section>
      </div>
    </div>
  );
}
