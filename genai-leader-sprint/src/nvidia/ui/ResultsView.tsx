"use client";
import Link from "next/link";
import { useState } from "react";
import { useNv } from "../store";
import { DOMAINS, LEVELS, LEVEL_LABEL } from "../types";
import { TOPIC_BY_ID } from "../topics";
import { isCorrect, pct, scoreSession, type Tally } from "../engine";
import { QuestionCard } from "./QuestionCard";

const Row = ({ label, t }: { label: string; t: Tally }) => (
  <tr><td>{label}</td><td>{t.c}/{t.t}</td><td>{pct(t)}%</td>
    <td style={{ width: "40%" }}><div className="bar" aria-hidden="true"><span style={{ width: `${pct(t)}%` }} /></div></td></tr>
);

export function ResultsView({ id }: { id: string }) {
  const nv = useNv();
  const s = nv.getSession(id);
  const [filter, setFilter] = useState<"all" | "wrong" | "unanswered" | "flagged">("wrong");
  if (!s) return <div className="callout err">That result was not found. <Link href="/certifications/nvidia">Back to the dashboard</Link>.</div>;
  if (s.status === "active") return <div className="callout">This session is still running. <Link href={s.kind === "mock" ? "/certifications/nvidia/mocks" : `/certifications/nvidia/session?id=${s.id}`}>Continue it</Link>.</div>;
  const sc = scoreSession(s, nv.byId);
  const isMock = s.kind === "mock";
  const items = s.qids.map((qid, i) => {
    const q = nv.byId.get(qid)!;
    const a = s.answers[qid];
    return { qid, i, q, a, ok: !!a && isCorrect(q, a.letter) };
  }).filter((x) => x.q);
  const shown = items.filter((x) => filter === "all" ? true : filter === "wrong" ? x.a && !x.ok : filter === "unanswered" ? !x.a : s.flags.includes(x.qid));
  return (
    <div>
      <h1>{s.label}: results</h1>
      {s.status === "expired" && <div className="callout" role="note">Time ran out. Your saved answers were graded; unanswered questions count as wrong.</div>}
      <div className="nv-hero">
        <div className="nv-big">{sc.pct}% <small>{sc.correct} of {sc.total} correct{sc.answered < sc.total ? `, ${sc.total - sc.answered} unanswered` : ""}</small></div>
        {isMock && <p className="small muted">This is your score on this app&rsquo;s practice mock. It is not a prediction of your result on the real exam: NVIDIA does not publish a passing score on the exam page this app was built from.</p>}
      </div>
      {isMock && (
        <>
          <h2>By exam domain</h2>
          <div className="table-wrap"><table><thead><tr><th>Domain (official weight)</th><th>Score</th><th>%</th><th /></tr></thead><tbody>
            {DOMAINS.map((d) => <Row key={d.id} label={`${d.short} (${d.weight}%)`} t={sc.byDomain[d.id]} />)}
          </tbody></table></div>
        </>
      )}
      <h2>By topic</h2>
      <div className="table-wrap"><table><thead><tr><th>Topic</th><th>Score</th><th>%</th><th /></tr></thead><tbody>
        {Object.entries(sc.byTopic).sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => <Row key={t} label={`${t} ${TOPIC_BY_ID[t]?.title ?? ""}`} t={v} />)}
      </tbody></table></div>
      <h2>By level</h2>
      <div className="table-wrap"><table><thead><tr><th>Level</th><th>Score</th><th>%</th><th /></tr></thead><tbody>
        {LEVELS.filter((l) => sc.byLevel[l].t).map((l) => <Row key={l} label={LEVEL_LABEL[l]} t={sc.byLevel[l]} />)}
      </tbody></table></div>

      <h2>Review your answers</h2>
      <div className="row" role="group" aria-label="Filter questions">
        {(["wrong", "unanswered", "flagged", "all"] as const).map((f) => (
          <button key={f} className={`btn ${filter === f ? "" : "secondary"}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "wrong" ? "Wrong" : f === "unanswered" ? "Unanswered" : f === "flagged" ? "Flagged" : "All"}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">Nothing in this filter.</p>}
      {shown.map((x) => (
        <div className="review-q" key={x.qid}>
          <QuestionCard q={x.q} order={s.order[x.qid]} name={`r-${x.qid}`} number={x.i + 1} value={x.a?.letter} reveal disabled showLevel />
          <div className={`callout ${x.ok ? "okc" : ""}`}><strong>{x.ok ? "Correct." : x.a ? "Wrong." : "Unanswered."}</strong> {x.q.takeaway}</div>
        </div>
      ))}
      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href="/certifications/nvidia">Dashboard</Link>
        <Link className="btn secondary" href="/certifications/nvidia/notebook">Notebook (mistake reviews)</Link>
        <Link className="btn secondary" href="/certifications/nvidia/topics">Topics</Link>
      </div>
    </div>
  );
}
