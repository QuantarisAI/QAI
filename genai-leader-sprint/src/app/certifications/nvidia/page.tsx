"use client";
import Link from "next/link";
import { useNv } from "@/nvidia/store";
import { DOMAINS, NV_EXAM } from "@/nvidia/types";
import { PHASE_LABEL, PLAN, PLAN_DAYS, dateOf, hoursFor, planPosition } from "@/nvidia/roadmap";
import { calibration, daysUntil, pct, topicAccuracy } from "@/nvidia/engine";
import { TOPIC_BY_ID, topicsOf } from "@/nvidia/topics";
import { LaunchButton } from "@/nvidia/ui/LaunchButton";

const BAND_TEXT = { "no-data": "No data yet", "not-yet": "Not yet", building: "Building", close: "Close", ready: "Ready by this app's measure" } as const;

export default function Page() {
  const nv = useNv();
  const { settings, today, attempts, cells, readiness: r, due, sessions } = nv;
  const toExam = daysUntil(today, settings.examDate);
  const pos = planPosition(settings.startDate, today);
  const day = pos.state === "active" ? PLAN[pos.n - 1] : null;
  const active = sessions.filter((s) => s.status === "active");
  const acc = topicAccuracy(attempts, 1);
  const weak = topicAccuracy(attempts, 3).slice(0, 3);
  const cal = calibration(attempts);
  const firstTry = new Map<string, { c: number; t: number }>();
  const seenQ = new Set<string>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    if (seenQ.has(a.qid)) continue;
    seenQ.add(a.qid);
    const v = firstTry.get(a.domain) ?? { c: 0, t: 0 };
    v.t++; if (a.correct) v.c++;
    firstTry.set(a.domain, v);
  }

  return (
    <div>
      <section className="nv-hero" aria-labelledby="count">
        <h1 id="count" className="sr">Dashboard</h1>
        {toExam > 0 ? (
          <div className="nv-big">{toExam} <small>day{toExam === 1 ? "" : "s"} to the exam · {settings.examDate}</small></div>
        ) : toExam === 0 ? (
          <div className="nv-big">Exam day <small>{settings.examDate}. Breathe. You prepared.</small></div>
        ) : (
          <div className="nv-big">Exam date passed <small>{settings.examDate}. Update it in Settings if it moved.</small></div>
        )}
        <p className="small muted" style={{ margin: ".4rem 0 0" }}>{NV_EXAM.name} ({NV_EXAM.code}). Per NVIDIA&rsquo;s page (checked {NV_EXAM.verifiedOn}): 50 to 60 multiple-choice questions in 1 hour. Check the official page again before you book or sit it.</p>
      </section>

      {active.length > 0 && (
        <div className="callout" role="status">
          <strong>Unfinished:</strong>{" "}
          {active.map((s) => (
            <Link key={s.id} href={s.kind === "mock" ? `/certifications/nvidia/exam?id=${s.id}` : `/certifications/nvidia/session?id=${s.id}`} style={{ marginRight: ".8rem" }}>
              Resume {s.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid">
        <section className="card" aria-labelledby="today">
          <h2 id="today" style={{ marginTop: 0 }}>Today</h2>
          {pos.state === "before" && (
            <p>Your 40-day plan starts on <strong>{settings.startDate}</strong> ({daysUntil(today, settings.startDate)} days). You do not have to wait: pick a topic and start.</p>
          )}
          {pos.state === "after" && <p>The 40-day plan is over. Keep clearing due reviews and re-take a mock if you still have days left.</p>}
          {day && (
            <>
              <p className="small muted">Day {day.n} of {PLAN_DAYS} · {dateOf(settings.startDate, day.n)} · {hoursFor(today)} h · {PHASE_LABEL[day.phase]}</p>
              <h3 style={{ margin: ".1rem 0 .4rem" }}>{day.title}</h3>
              <ul>{day.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
              <div className="row">
                {day.action.kind === "topics" && <Link className="btn" href={`/certifications/nvidia/topics#t-${day.action.topic}`}>Open {day.topics.join(", ")}</Link>}
                {day.action.kind === "mock" && <Link className="btn" href="/certifications/nvidia/mocks">Go to the mock</Link>}
                {day.action.kind === "weak" && <LaunchButton spec={{ kind: "weak" }}>Start weak-topic drill</LaunchButton>}
                {day.action.kind === "mixed" && <LaunchButton spec={{ kind: "mixed", count: 30 }}>Start mixed drill (30)</LaunchButton>}
                {day.action.kind === "review" && <LaunchButton spec={{ kind: "due" }} disabled={due.length === 0}>Review due mistakes ({due.length})</LaunchButton>}
                <Link className="btn secondary" href="/certifications/nvidia/roadmap">Full roadmap</Link>
              </div>
            </>
          )}
        </section>

        <section className="card" aria-labelledby="ready">
          <h2 id="ready" style={{ marginTop: 0 }}>Readiness index</h2>
          <div className="nv-big">{r.index ?? "–"}<small> / 100 · {BAND_TEXT[r.band]}</small></div>
          <p>{r.note}</p>
          <ul className="small">
            <li>Recent mocks: {r.mock === null ? "none yet" : `${r.mock}%`} (50% of the index)</li>
            <li>First-try accuracy on medium and harder: {r.accuracy === null ? "needs 10 questions" : `${r.accuracy}%`} (30%)</li>
            <li>Bank coverage: {r.coverage}% seen (20%)</li>
          </ul>
          <p className="small muted">This is a study-progress number made up by this app. It is <strong>not</strong> a pass probability, and NVIDIA publishes no passing score on the page this was built from.</p>
        </section>

        <section className="card" aria-labelledby="rev">
          <h2 id="rev" style={{ marginTop: 0 }}>Mistake reviews</h2>
          <div className="nv-big">{due.length} <small>due today</small></div>
          <p className="small muted">Mistakes come back after 1, 3 and 7 days. A question counts as mastered only after correct answers on separate days.</p>
          <div className="row">
            <LaunchButton spec={{ kind: "due" }} disabled={due.length === 0}>Review now</LaunchButton>
            <Link className="btn secondary" href="/certifications/nvidia/notebook">Notebook</Link>
          </div>
        </section>
      </div>

      <h2>Exam domains</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Domain</th><th>Exam weight</th><th>Questions in a 60-q mock</th><th>Your first-try accuracy</th><th>Cleared levels</th></tr></thead>
          <tbody>
            {DOMAINS.map((d) => {
              const f = firstTry.get(d.id);
              const ts = topicsOf(d.id);
              const cleared = ts.reduce((n, t) => n + (["beginner", "easy", "medium", "hard", "legendary"] as const).filter((l) => cells.get(`${t.id}|${l}`)?.cleared).length, 0);
              return (
                <tr key={d.id}>
                  <td>{d.name}</td><td>{d.weight}%</td><td>{d.mockCount}</td>
                  <td>{f ? `${pct(f)}% (${f.t} q)` : "–"}</td><td>{cleared}/{ts.length * 5}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {weak.length > 0 && (
        <>
          <h2>Weakest topics so far</h2>
          <ul>{weak.map((w) => <li key={w.topic}><strong>{w.topic}</strong> {TOPIC_BY_ID[w.topic]?.title}: {Math.round(w.acc * 100)}% first try ({w.t} q)</li>)}</ul>
          <LaunchButton spec={{ kind: "weak" }}>Drill my weakest topics</LaunchButton>
        </>
      )}
      {acc.length === 0 && <p className="muted">No answers yet. Start with <Link href="/certifications/nvidia/topics">Topics</Link>: Beginner level first.</p>}

      {(cal.high.t >= 5 || cal.low.t >= 5) && (
        <>
          <h2>Are you sure when you say you are sure?</h2>
          <p className="small">High confidence: {cal.high.t ? `${pct(cal.high)}% right (${cal.high.t} q)` : "–"} · Medium: {cal.medium.t ? `${pct(cal.medium)}%` : "–"} · Low: {cal.low.t ? `${pct(cal.low)}%` : "–"}. If high-confidence answers are wrong often, that is the thing to fix: slow down on questions that feel obvious.</p>
        </>
      )}
    </div>
  );
}
