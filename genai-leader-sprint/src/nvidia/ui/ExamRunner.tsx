"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNv } from "../store";
import type { Letter } from "../types";
import { fmtClock } from "../engine";
import { QuestionCard } from "./QuestionCard";

export function ExamRunner({ id }: { id: string }) {
  const nv = useNv();
  const router = useRouter();
  // The store is the single source of truth: it updates synchronously, then saves to IndexedDB.
  const s = nv.getSession(id);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const finishing = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const deadline = s?.deadline ?? 0;
  const left = deadline - now;
  const active = s?.status === "active";
  const mins = Math.ceil(left / 60000);
  // Screen-reader announcement changes only at 10, 5 and 1 minutes left, so it is not read out every second.
  const announce = active && left > 0 && [10, 5, 1].includes(mins) ? `${mins} minute${mins > 1 ? "s" : ""} left` : "";

  // Auto-submit when the persisted deadline passes. The clock comes from the stored deadline, so a reload cannot reset it.
  useEffect(() => {
    if (!s || !active || !deadline || left > 0 || finishing.current) return;
    finishing.current = true;
    (async () => {
      const done = await nv.finish(s);
      router.replace(`/certifications/nvidia/results?id=${done.id}`);
    })();
  }, [s, active, deadline, left, nv, router]);

  if (!s) return <div className="callout err">That exam was not found. <Link href="/certifications/nvidia/mocks">Back to mocks</Link>.</div>;
  if (!active) { router.replace(`/certifications/nvidia/results?id=${s.id}`); return <p role="status">Opening results…</p>; }

  const qid = s.qids[s.cursor];
  const q = nv.byId.get(qid);
  if (!q) return <div className="callout err">Question data is missing.</div>;
  const answered = Object.keys(s.answers).length;
  const flagged = new Set(s.flags);

  const go = (i: number) => nv.persist({ ...s, cursor: Math.max(0, Math.min(s.qids.length - 1, i)) });
  const choose = (l: Letter) => nv.mockAnswer(s, qid, l);
  const submit = async () => {
    if (finishing.current) return;
    finishing.current = true;
    const done = await nv.finish(s);
    router.push(`/certifications/nvidia/results?id=${done.id}`);
  };
  const low = left < 5 * 60000;

  return (
    <div>
      <div className="sticky row" style={{ justifyContent: "space-between" }}>
        <strong>{s.label}</strong>
        <span className="timer" role="timer" aria-label="Time remaining" style={{ color: low ? "var(--bad)" : undefined }}>{fmtClock(left)}</span>
        <span className="badge">{answered}/{s.qids.length} answered</span>
      </div>
      <p className="sr" role="status" aria-live="polite">{announce}</p>
      <div className="learn-grid" style={{ marginTop: ".8rem" }}>
        <aside aria-label="Question palette">
          <div className="palette">
            {s.qids.map((id2, i) => (
              <button
                key={id2} className={`pal ${s.answers[id2] ? "ans" : ""} ${i === s.cursor ? "cur" : ""}`}
                onClick={() => go(i)} aria-label={`Question ${i + 1}${s.answers[id2] ? ", answered" : ", not answered"}${flagged.has(id2) ? ", flagged" : ""}`}
                aria-current={i === s.cursor ? "true" : undefined}
              >
                {i + 1}{flagged.has(id2) && <span className="f" aria-hidden="true">⚑</span>}
              </button>
            ))}
          </div>
        </aside>
        <section className="card" style={{ margin: 0 }}>
          <QuestionCard key={qid} q={q} order={s.order[qid]} name={`q-${qid}`} number={s.cursor + 1} value={s.answers[qid]?.letter} onChange={choose} />
          <div className="row">
            <button className="btn secondary" onClick={() => go(s.cursor - 1)} disabled={s.cursor === 0}>Previous</button>
            <button className="btn secondary" onClick={() => go(s.cursor + 1)} disabled={s.cursor === s.qids.length - 1}>Next</button>
            <button className="btn secondary" aria-pressed={flagged.has(qid)} onClick={() => nv.flag(s, qid)}>{flagged.has(qid) ? "⚑ Flagged" : "⚐ Flag for review"}</button>
            {s.answers[qid] && <button className="btn secondary" onClick={() => nv.mockAnswer(s, qid, null)}>Clear answer</button>}
          </div>
        </section>
      </div>
      <div className="card">
        {!confirming ? (
          <button className="btn danger" onClick={() => setConfirming(true)}>Submit exam</button>
        ) : (
          <div role="alertdialog" aria-label="Confirm submit">
            <p><strong>Submit now?</strong> You have answered {answered} of {s.qids.length}. {s.qids.length - answered > 0 && <>Unanswered questions count as wrong. </>}{flagged.size > 0 && <>{flagged.size} flagged. </>}You cannot undo this.</p>
            <div className="row">
              <button className="btn danger" onClick={submit}>Yes, submit</button>
              <button className="btn secondary" onClick={() => setConfirming(false)}>Keep working</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
