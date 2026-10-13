"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useLauncher } from "@/components/Launcher";
import { BANK_TARGET, DOMAINS, DOMAIN_WEIGHTS } from "@/lib/types";
import { diffDays, TZ } from "@/lib/dates";
import { OBJECTIVES } from "@/data/objectives";
import { BUILT_IN_BANK } from "@/lib/bank";

const pct = (a: { pct: number | null; n: number }) => (a.pct === null ? "no data" : `${Math.round(a.pct * 100)}% (n=${a.n})`);

export default function Dashboard() {
  const app = useApp();
  const { run, banner } = useLauncher();
  const { program, settings, metrics, today } = app;
  const daysToExam = diffDays(today, settings.examDate);
  const day = program.days.find((d) => d.day === program.todayIndex);
  const due = [...app.states.values()].filter((s) => s.due && s.due <= today).length;
  const authored = BUILT_IN_BANK.questions.length;
  const recent = [...app.sessions].filter((s) => s.submittedAt || s.status === "active").sort((a, b) => (b.submittedAt ?? b.startedAt) - (a.submittedAt ?? a.startedAt)).slice(0, 8);
  const perDomainTotal = (d: string) => app.questions.filter((q) => !q.imported && q.exam_domain === d).length;
  const perDomainSeen = (d: string) => new Set(app.attempts.filter((a) => app.byKey.get(a.qkey)?.exam_domain === d).map((a) => a.qkey)).size;
  return (
    <div>
      <h1>GenAI Leader Sprint</h1>
      <div className="callout" role="note">
        <strong>Question bank status:</strong> {authored} of 360 target questions are written ({app.mockStatus.filter((m) => m.ready).length} of 3 mocks complete). <strong>All are unverified drafts</strong>: the official exam guide and Google product documentation could not be read when the bank was written, no expert review has taken place, and objective IDs are this app&apos;s own. Use them to practise reasoning, and confirm product details against the official learning path. See the README.
      </div>
      {banner}
      <div className="grid">
        <section className="card" aria-label="Countdown">
          <h2 style={{ marginTop: 0 }}>Exam countdown</h2>
          <p style={{ fontSize: "2rem", margin: 0 }}><strong>{daysToExam >= 0 ? daysToExam : 0}</strong> day{daysToExam === 1 ? "" : "s"}</p>
          <p className="small muted">Exam date {settings.examDate} ({TZ}). Program day {Math.max(0, Math.min(program.todayIndex, 11))} of 10. <Link href="/settings">Change dates</Link></p>
        </section>
        <section className="card" aria-label="Today's task">
          <h2 style={{ marginTop: 0 }}>Today&apos;s task</h2>
          {program.todayIndex < 1 && <p>Your program starts on {settings.startDate}.</p>}
          {program.todayIndex > 10 && <p>The 10-day program window has ended. Use targeted revision, the notebook and cards until your exam.</p>}
          {day && <><p><strong>Day {day.day}: {day.title}</strong></p><ul>{day.tips.map((t) => <li key={t}>{t}</li>)}</ul></>}
          {program.carryOver > 0 && <div className="callout" role="note"><strong>Carried over:</strong> {program.carryOver} question(s) from missed days are added to today. Missed work stays visible and is never marked done automatically.</div>}
          <p className="small">Questions still owed to stay on plan: <strong>{program.todayRemaining}</strong> · budget ~{settings.minutesPerDay} min/day.</p>
          <div className="row">
            {day?.diagnostic && <Link className="btn" href="/diagnostic">Diagnostic</Link>}
            {day?.mock && <Link className="btn" href="/exam">Mock {day.mock}</Link>}
            <button type="button" className="btn secondary" onClick={() => run(() => app.startPractice({ kind: "mixed", count: 20, filters: {} }))}>Mixed 20</button>
          </div>
        </section>
        <section className="card" aria-label="Due reviews">
          <h2 style={{ marginTop: 0 }}>Due reviews</h2>
          <p style={{ fontSize: "2rem", margin: 0 }}><strong>{due}</strong></p>
          <p className="small muted">1 / 3 / 7-day schedule. Includes uncertain correct answers.</p>
          <button type="button" className="btn" disabled={!due} onClick={() => run(app.startReviewDue)}>Review now</button>
        </section>
      </div>

      <h2>Accuracy</h2>
      <div className="table-wrap"><table>
        <caption className="sr">Accuracy by attempt type</caption>
        <tbody>
          <tr><th scope="row">First-attempt accuracy (all questions)</th><td>{pct(metrics.firstAttempt)}</td></tr>
          <tr><th scope="row">Unseen, no-hint accuracy (first attempts without a hint)</th><td>{pct(metrics.unseenNoHint)}</td></tr>
          <tr><th scope="row">Repeat-attempt accuracy (questions seen before)</th><td>{pct(metrics.repeat)}</td></tr>
        </tbody>
      </table></div>
      <p className="small muted">Repeat accuracy is kept separate because re-answering a remembered question is not evidence of understanding.</p>

      <h2>Progress by domain</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Domain (official weight)</th><th>Questions tried</th><th>First-attempt accuracy</th><th>Objectives with evidence</th></tr></thead>
        <tbody>{DOMAINS.map((d) => {
          const objs = OBJECTIVES.filter((o) => o.domain === d);
          const ok = objs.filter((o) => ["learning", "mastered"].includes(app.mastery[o.id]?.status)).length;
          const mastered = objs.filter((o) => app.mastery[o.id]?.status === "mastered").length;
          const seen = perDomainSeen(d), tot = perDomainTotal(d);
          return (
            <tr key={d}>
              <th scope="row">{d} ({DOMAIN_WEIGHTS[d]})</th>
              <td>{seen}/{tot} <span className="small muted">(target {BANK_TARGET[d]})</span><div className="bar" aria-hidden><span style={{ width: `${tot ? (100 * seen) / tot : 0}%` }} /></div></td>
              <td>{pct(metrics.byDomainFirst[d])}</td>
              <td>{ok}/{objs.length} with enough evidence · {mastered} mastered</td>
            </tr>
          );
        })}</tbody>
      </table></div>

      <h2>Preparation targets</h2>
      <div className="card">
        <p className="small">These are this app&apos;s own practice goals. They are <strong>not</strong> Google&apos;s passing threshold, not a probability of passing, and not a guarantee.</p>
        <ul className="clean">{app.ready_.checks.map((c) => <li key={c.label}>{c.ok ? "✔ Met" : "○ Not yet"} — {c.label} <span className="muted">({c.detail})</span></li>)}</ul>
        <p><strong>{app.ready_.ready ? "All three preparation targets are met. Consider booking, and keep reviewing." : "Keep practising: targets not yet met."}</strong></p>
      </div>

      <h2>10-day program</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Day</th><th>Date</th><th>Focus</th><th>Status</th></tr></thead>
        <tbody>{program.days.map((d) => (
          <tr key={d.day}><td>{d.day}</td><td>{d.date}</td><td>{d.title}</td>
            <td>{d.status === "done" ? "✔ Done" : d.status === "today" ? "▶ Today" : d.status === "missed" ? "⚠ Missed: rescheduled into today" : "○ Upcoming"}</td></tr>
        ))}</tbody>
      </table></div>

      <h2>Recent activity</h2>
      {recent.length === 0 ? <p className="muted">No activity yet. Start with the diagnostic.</p> : (
        <ul>{recent.map((s) => <li key={s.id}>{s.status === "active" ? <Link href={s.kind === "exam" ? `/exam/run?id=${s.id}` : `/session?id=${s.id}`}>{s.label} (in progress)</Link> : <Link href={`/results?id=${s.id}`}>{s.label}</Link>} <span className="muted small">· {new Date(s.submittedAt ?? s.startedAt).toLocaleString()}</span></li>)}</ul>
      )}
      <h2>Official resources</h2>
      <ul>
        <li><a href="https://cloud.google.com/learn/certification/generative-ai-leader" target="_blank" rel="noreferrer">Certification page, learning path and official sample questions</a></li>
        <li><a href="https://services.google.com/fh/files/misc/generative_ai_leader_exam_guide_english.pdf" target="_blank" rel="noreferrer">Official exam guide (PDF)</a></li>
        <li><a href="https://services.google.com/fh/files/misc/generative_ai_leader_study_guide_english.pdf" target="_blank" rel="noreferrer">Official study guide (PDF)</a></li>
      </ul>
    </div>
  );
}
