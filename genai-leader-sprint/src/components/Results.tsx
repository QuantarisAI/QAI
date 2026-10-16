"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { displayOptions, scoreSession } from "@/lib/engine";
import { DOMAINS } from "@/lib/types";
import { objectiveById } from "@/data/objectives";
import { Feedback } from "./QuestionView";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mmss = (ms: number) => `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`;

export function Results({ id }: { id: string }) {
  const app = useApp();
  const s = app.getSession(id);
  if (!s) return <p>Results not found.</p>;
  const sc = scoreSession(s, app.byKey);
  const isExam = s.kind === "exam";
  const scoreLabel = isExam ? "Score (unanswered counted as incorrect)" : "Score on all questions in this set";
  return (
    <div>
      <h1>Results · {s.label}</h1>
      {s.repeat && <div className="callout">This is a <strong>repeated</strong> mock. You have seen these questions before, so the score is not an unseen measure.</div>}
      {s.kind === "diagnostic" && <div className="callout">A 20-question diagnostic is a small sample: treat it as an initial signal, not a reliable readiness prediction.</div>}
      {s.status === "expired" && <div className="callout err" role="alert">Time expired. The exam was submitted automatically at the deadline.</div>}
      <div className="grid">
        <div className="card"><h3>{scoreLabel}</h3><p style={{ fontSize: "2rem", margin: 0 }}><strong>{sc.correct}/{sc.total}</strong> · {pct(sc.accuracy)}</p></div>
        <div className="card"><h3>Answered / unanswered</h3><p style={{ fontSize: "1.4rem", margin: 0 }}>{sc.answered} / {sc.unanswered}</p></div>
        <div className="card"><h3>Pacing</h3><p style={{ margin: 0 }}>Time used: {mmss(sc.pacing.usedMs)}<br />Avg per answered question: {sc.pacing.avgAnsweredSec.toFixed(0)} s</p></div>
      </div>
      <h2>By domain</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Domain</th><th>Correct</th><th>Answered</th><th>Unanswered</th><th>Accuracy</th></tr></thead>
        <tbody>{DOMAINS.map((d) => { const x = sc.byDomain[d]; return x.total ? <tr key={d}><td>{d}</td><td>{x.correct}/{x.total}</td><td>{x.answered}</td><td>{x.unanswered}</td><td>{pct(x.accuracy)}{isExam && x.accuracy < 0.8 ? " · below 80% prep target" : ""}</td></tr> : null; })}</tbody>
      </table></div>
      {sc.highConfidenceErrors.length > 0 && (
        <><h2>High-confidence errors ({sc.highConfidenceErrors.length})</h2><p className="muted small">You were sure and wrong: these are the most valuable misconceptions to fix.</p>
          <ul>{sc.highConfidenceErrors.map((k) => <li key={k}>{app.byKey.get(k)?.scenario_question.slice(0, 110)}…</li>)}</ul></>
      )}
      {sc.objectiveGaps.length > 0 && (
        <><h2>Objective gaps</h2><ul>{sc.objectiveGaps.map((g) => <li key={g.objective}>{g.objective} {objectiveById(g.objective)?.title ?? ""}: {g.wrong} of {g.total} missed</li>)}</ul></>
      )}
      <h2>Review every question</h2>
      {s.qkeys.map((k, i) => {
        const q = app.byKey.get(k); if (!q) return null;
        const a = s.answers[k];
        const label = displayOptions(q, s.order[k]).find((o) => o.option_letter === a?.letter)?.label;
        return (
          <details key={k} className="card">
            <summary><strong>{i + 1}.</strong> {q.exam_domain} · {a?.letter ? (q.options.find((o) => o.option_letter === a.letter)?.is_correct ? "✔ correct" : `✘ incorrect (you chose ${label})`) : "✘ unanswered"}{a?.confidence ? ` · confidence ${a.confidence}` : ""}</summary>
            <p>{q.scenario_question}</p>
            <Feedback q={q} order={s.order[k]} chosen={a?.letter} settings={app.settings} bookmarked={app.bookmarks.has(k)} onBookmark={() => app.toggleBookmark(k)} />
          </details>
        );
      })}
      <div className="row"><Link className="btn" href="/certifications/google">Dashboard</Link><Link className="btn secondary" href="/certifications/google/notebook">Mistake notebook</Link></div>
    </div>
  );
}
