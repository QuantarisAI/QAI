"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { useLauncher } from "@/components/Launcher";
import { objectiveById } from "@/data/objectives";
import { SourceList } from "@/components/QuestionView";

export default function Page() {
  const app = useApp();
  const { run, banner } = useLauncher();
  const [showResolved, setShowResolved] = useState(false);
  const entries = [...app.states.values()].filter((s) => s.inNotebook && (showResolved || !s.resolved))
    .map((s) => ({ s, q: app.byKey.get(s.qkey)! })).filter((e) => e.q)
    .sort((a, b) => (a.s.due ?? "9999").localeCompare(b.s.due ?? "9999"));
  const dueCount = entries.filter((e) => e.s.due && e.s.due <= app.today).length;
  return (
    <div>
      <h1>Mistake notebook</h1>
      <p>Includes wrong answers <strong>and</strong> correct answers you marked low-confidence, so lucky guesses are not treated as mastered. Reviews come back after 1, 3 and 7 days; a question leaves the active list after three good reviews (correct and not low-confidence) in a row.</p>
      {banner}
      <div className="row">
        <button type="button" className="btn" disabled={!dueCount} onClick={() => run(app.startReviewDue)}>Review {dueCount} due now</button>
        <label className="row" style={{ margin: 0 }}><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} style={{ width: 22, height: 22 }} /> Show resolved</label>
      </div>
      {entries.length === 0 && <p className="muted">Nothing here yet. Answer some questions, and mistakes and uncertain answers will collect here.</p>}
      {entries.map(({ s, q }) => {
        const last = s.attempts[s.attempts.length - 1];
        const wrong = s.lastWrong;
        const wrongText = wrong ? q.options.find((o) => o.option_letter === wrong.letter)?.text : undefined;
        const right = q.options.find((o) => o.is_correct)!;
        const lucky = !s.everWrong;
        const obj = objectiveById(q.meta.objective);
        return (
          <article key={s.qkey} className="card">
            <p className="small"><span className="badge">{q.exam_domain}</span> <span className="badge">{lucky ? "uncertain correct" : "incorrect"}</span> {s.resolved ? <span className="badge">resolved ✔</span> : <span className="badge">next review {s.due}{s.due && s.due <= app.today ? " (due)" : ""}</span>}</p>
            <p>{q.scenario_question}</p>
            {wrongText && <p><strong>Your chosen answer:</strong> {wrongText}<br /><strong>Misconception:</strong> {(q.meta.distractor_tags?.[wrong!.letter] ?? "not tagged").replace(/-/g, " ")}</p>}
            {lucky && <p>You answered correctly but with low confidence ({last.day}).</p>}
            <p><strong>Best answer:</strong> {right.text}<br /><strong>Decision principle:</strong> {(app.settings.language === "hinglish" && q.meta.principle_hinglish) || q.meta.principle || "—"}</p>
            <p className="small muted">{obj ? `${obj.id} ${obj.title}` : q.meta.objective} · attempts: {s.attempts.length} · review stage {s.stage}/3</p>
            <SourceList q={q} />
          </article>
        );
      })}
    </div>
  );
}
