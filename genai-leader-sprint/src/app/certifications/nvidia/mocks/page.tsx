"use client";
import Link from "next/link";
import { useNv } from "@/nvidia/store";
import { DOMAINS, LEVELS, LEVEL_LABEL, NV_EXAM } from "@/nvidia/types";
import { MOCKS, pct, scoreSession } from "@/nvidia/engine";
import { LaunchButton } from "@/nvidia/ui/LaunchButton";

export default function Page() {
  const nv = useNv();
  const { sessions, byId } = nv;
  const done = sessions.filter((s) => s.kind === "mock" && s.status !== "active").sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
  return (
    <div>
      <h1>Mock exams</h1>
      <p>Each mock is {NV_EXAM.mockQuestions} questions in {NV_EXAM.mockMinutes} minutes, built with the official domain weights ({DOMAINS.map((d) => `${d.mockCount}`).join(" / ")} questions across the five domains). The clock is saved: closing the tab does not pause it, and unanswered questions count as wrong. No hints, no feedback until you submit.</p>
      <p>Mocks use questions you have not seen yet whenever possible, so get through the topic ladders before spending a mock. They get harder from Mock 1 to Mock 5 on purpose.</p>
      <div className="grid">
        {MOCKS.map((m) => {
          const running = sessions.find((s) => s.status === "active" && s.mockId === m.id);
          const tries = done.filter((s) => s.mockId === m.id);
          return (
            <section className="card" key={m.id} aria-labelledby={`m-${m.id}`}>
              <h2 id={`m-${m.id}`} style={{ marginTop: 0 }}>{m.name}</h2>
              <p>{m.blurb}</p>
              <p className="small muted">Mix: {LEVELS.filter((l) => m.mix[l]).map((l) => `${LEVEL_LABEL[l]} ${m.mix[l]}%`).join(", ")}</p>
              <div className="row">
                <LaunchButton mockId={m.id}>{running ? "Resume (clock is running)" : tries.length ? "Take again" : "Start"}</LaunchButton>
              </div>
              {tries.length > 0 && <p className="small">Last: {pct({ c: scoreSession(tries[0], byId).correct, t: scoreSession(tries[0], byId).total })}%</p>}
            </section>
          );
        })}
      </div>
      <h2>History</h2>
      {done.length === 0 ? <p className="muted">No completed mocks yet.</p> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Mock</th><th>Date</th><th>Score</th><th>Unanswered</th><th /></tr></thead>
          <tbody>{done.map((s) => {
            const sc = scoreSession(s, byId);
            return <tr key={s.id}><td>{s.label}{s.status === "expired" ? " (time ran out)" : ""}</td><td>{new Date(s.submittedAt ?? s.startedAt).toLocaleString()}</td><td>{sc.pct}% ({sc.correct}/{sc.total})</td><td>{sc.total - sc.answered}</td><td><Link href={`/certifications/nvidia/results?id=${s.id}`}>Review</Link></td></tr>;
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}
