"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useLauncher } from "@/components/Launcher";
import { DOMAINS } from "@/lib/types";

export default function Page() {
  const app = useApp();
  const { run, banner } = useLauncher();
  return (
    <div>
      <h1>Exam mode</h1>
      <p>Three disjoint 60-question mocks (18 / 21 / 12 / 9 by domain), 90 minutes each. Hints and feedback stay hidden until you submit; unanswered questions count as incorrect. The deadline is stored, so a reload does not pause the clock.</p>
      <p className="small muted">The 18/21/12/9 split is this app&apos;s practice allocation based on approximate official weights, not a claim about the real exam&apos;s exact counts.</p>
      {banner}
      <div className="grid">
        {app.mockStatus.map((m) => {
          const active = app.sessions.find((s) => s.kind === "exam" && s.mockNo === m.mockNo && s.status === "active");
          const done = app.sessions.filter((s) => s.kind === "exam" && s.mockNo === m.mockNo && s.submittedAt);
          return (
            <section key={m.mockNo} className="card" aria-label={`Mock ${m.mockNo}`}>
              <h2 style={{ marginTop: 0 }}>Mock {m.mockNo}</h2>
              <p className="small">{m.ready ? "60 of 60 questions ready." : <strong>Not available: {m.total} of 60 questions authored.</strong>}</p>
              {!m.ready && <p className="small muted">{DOMAINS.map((d) => `${d}: ${m.have[d]}/${m.need[d]}`).join(" · ")}</p>}
              {done.length > 0 && <p className="small">Taken {done.length}×. {done.map((s) => <Link key={s.id} href={`/certifications/google/results?id=${s.id}`}>result </Link>)}</p>}
              {active ? <Link className="btn" href={`/certifications/google/exam/run?id=${active.id}`}>Resume (deadline saved)</Link>
                : <button type="button" className="btn" disabled={!m.ready} onClick={() => run(() => app.startExam(m.mockNo))}>{done.length ? "Retake (repeated, not unseen)" : "Start mock"}</button>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
