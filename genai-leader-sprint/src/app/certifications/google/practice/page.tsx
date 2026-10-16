"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useLauncher } from "@/components/Launcher";
import { DOMAINS, type Domain } from "@/lib/types";
import { applyFilters, practicePool, type StatusFilter } from "@/lib/engine";

export default function Page() {
  const app = useApp();
  const { run, banner } = useLauncher();
  const [domain, setDomain] = useState<Domain | "all">("all");
  const [tag, setTag] = useState("");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [count, setCount] = useState(20);
  const pool = useMemo(() => practicePool(app.questions, app.used), [app.questions, app.used]);
  const tags = useMemo(() => [...new Set(pool.flatMap((q) => q.meta.tags))].sort(), [pool]);
  const matching = useMemo(() => applyFilters(pool, { domain, tag, difficulty, status }, app.states, app.bookmarks, app.today), [pool, domain, tag, difficulty, status, app.states, app.bookmarks, app.today]);
  const reserved = app.questions.filter((q) => q.meta.mock && !app.used.has(q.meta.mock)).length;
  const active = app.sessions.filter((s) => (s.kind === "practice" || s.kind === "drill" || s.kind === "learn") && s.status === "active");
  const filtered = domain !== "all" || tag || difficulty !== "all" || status !== "any";
  return (
    <div>
      <h1>Practice</h1>
      <p className="small muted">{pool.length} questions in the practice pool. {reserved} questions are reserved for mocks and stay hidden until that mock is first submitted.</p>
      {banner}
      {active.length > 0 && <div className="card"><h2 style={{ marginTop: 0 }}>Resume</h2><ul>{active.map((s) => <li key={s.id}><Link href={`/certifications/google/session?id=${s.id}`}>{s.label}</Link></li>)}</ul></div>}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Quick starts</h2>
        <div className="row">
          <button type="button" className="btn" onClick={() => run(() => app.startPractice({ kind: "mixed", count: 20, filters: {} }))}>Mixed set of 20 (6/7/4/3)</button>
          <button type="button" className="btn secondary" onClick={() => run(() => app.startPractice({ kind: "weak", count: 20, filters: {} }))}>Weak-area drill (not exam-weighted)</button>
          <button type="button" className="btn secondary" onClick={() => run(app.startReviewDue)}>Due reviews</button>
        </div>
        <p className="small muted">Mixed sets follow the 6/7/4/3 domain weights and prioritise due reviews and unseen questions. Weak-area drills deliberately depart from those weights and are labelled that way.</p>
      </div>
      <form className="card" onSubmit={(e) => { e.preventDefault(); void run(() => app.startPractice({ kind: filtered ? "filtered" : "mixed", count, filters: { domain, tag, difficulty, status } })); }}>
        <h2 style={{ marginTop: 0 }}>Custom set</h2>
        <div className="row">
          <label>Domain<br /><select value={domain} onChange={(e) => setDomain(e.target.value as Domain | "all")}><option value="all">All</option>{DOMAINS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Topic<br /><select value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Any</option>{tags.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Difficulty<br /><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="all">Any</option><option>foundation</option><option>intermediate</option><option>advanced</option></select></label>
          <label>Status<br /><select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="any">Any</option><option value="unseen">Unseen</option><option value="incorrect">Previously incorrect</option><option value="lowconf">Low confidence</option><option value="bookmarked">Bookmarked</option><option value="due">Due for review</option></select></label>
          <label>Size<br /><select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 20, 30].map((n) => <option key={n}>{n}</option>)}</select></label>
        </div>
        <p role="status">{matching.length} matching question(s). {filtered && "Filtered sets do not follow exam domain weights."}</p>
        <button type="submit" className="btn" disabled={!matching.length}>Start set</button>
      </form>
    </div>
  );
}
