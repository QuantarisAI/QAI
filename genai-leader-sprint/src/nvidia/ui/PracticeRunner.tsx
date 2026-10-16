"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNv } from "../store";
import type { Confidence, Letter } from "../types";
import { isCorrect } from "../engine";
import { QuestionCard } from "./QuestionCard";

export function PracticeRunner({ id }: { id: string }) {
  const nv = useNv();
  const router = useRouter();
  const session = nv.getSession(id);
  // Selection is stored together with the question it belongs to, so a slow save can never wipe the next question's choice.
  const [pick, setPick] = useState<{ qid: string; letter?: Letter; conf?: Confidence } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!session) return <div className="callout err">That session was not found. <Link href="/certifications/nvidia/topics">Back to topics</Link>.</div>;
  if (session.kind === "mock") return <div className="callout">This is a timed mock. <Link href={`/certifications/nvidia/mocks`}>Open it from Mocks</Link>.</div>;
  if (session.status !== "active") {
    router.replace(`/certifications/nvidia/results?id=${session.id}`);
    return <p role="status">Opening results…</p>;
  }

  const qid = session.qids[session.cursor];
  const q = nv.byId.get(qid);
  if (!q) return <div className="callout err">Question data is missing for this session.</div>;
  const sel = pick?.qid === qid ? pick.letter : undefined;
  const conf = pick?.qid === qid ? pick.conf : undefined;
  const setSel = (letter: Letter) => setPick({ qid, letter, conf });
  const setConf = (c: Confidence) => setPick({ qid, letter: sel, conf: c });
  const rec = session.answers[qid];
  const revealed = !!rec?.submitted;
  const shown = revealed ? rec.letter : sel;
  const hinted = session.hinted?.includes(qid);
  const last = session.cursor === session.qids.length - 1;
  const answeredCount = Object.keys(session.answers).length;

  const submit = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try { await nv.answer(session, q, sel, conf); } finally { setBusy(false); }
  };
  const next = async () => {
    setBusy(true);
    try {
      if (last) {
        const done = await nv.finish(session);
        router.push(`/certifications/nvidia/results?id=${done.id}`);
      } else {
        await nv.persist({ ...session, cursor: session.cursor + 1 });
      }
    } finally { setBusy(false); }
  };
  const quit = async () => {
    const done = await nv.finish(session);
    router.push(`/certifications/nvidia/results?id=${done.id}`);
  };

  return (
    <div>
      <h1>{session.label}</h1>
      <div className="row" aria-live="polite">
        <span className="badge">Question {session.cursor + 1} of {session.qids.length}</span>
        <span className="badge">{answeredCount} answered</span>
        <div className="bar" style={{ flex: 1, minWidth: 120 }} aria-hidden="true"><span style={{ width: `${(100 * answeredCount) / session.qids.length}%` }} /></div>
      </div>
      <div className="card">
        <QuestionCard
          key={qid} q={q} order={session.order[qid]} name={`q-${qid}`} value={shown} onChange={setSel}
          reveal={revealed} disabled={revealed} showLevel
        />
        {!revealed && (
          <>
            <fieldset>
              <legend>How sure are you? (optional)</legend>
              <div className="row">
                {(["low", "medium", "high"] as const).map((c) => (
                  <label key={c} style={{ display: "inline-flex", gap: ".4rem", alignItems: "center", margin: 0 }}>
                    <input type="radio" name="conf" checked={conf === c} onChange={() => setConf(c)} style={{ width: 20, height: 20 }} /> {c}
                  </label>
                ))}
              </div>
            </fieldset>
            {hinted && <div className="callout" role="note"><strong>Hint:</strong> {q.hint}</div>}
            <div className="row">
              <button className="btn" onClick={submit} disabled={!sel || busy}>Check answer</button>
              {!hinted && <button className="btn secondary" onClick={() => nv.hint(session, qid)}>Show a hint</button>}
              <button className="btn secondary" onClick={quit}>End session</button>
            </div>
            {hinted && <p className="small muted">A hint is recorded with your answer. For honest numbers, try without.</p>}
          </>
        )}
        {revealed && (
          <>
            <div className={`callout ${isCorrect(q, rec.letter) ? "okc" : "err"}`} role="status">
              <strong>{isCorrect(q, rec.letter) ? "Correct." : "Not this time."}</strong> {q.takeaway}
              {!seenBefore(nv.attempts, qid, session.id) ? "" : <span className="small"> (You have seen this question before, so this attempt does not change your first-attempt accuracy.)</span>}
            </div>
            <div className="row">
              <button className="btn" onClick={next} disabled={busy} autoFocus>{last ? "Finish and see results" : "Next question"}</button>
              <button className="btn secondary" onClick={() => nv.toggleBookmark(qid)} aria-pressed={nv.bookmarks.has(qid)}>
                {nv.bookmarks.has(qid) ? "★ Bookmarked" : "☆ Bookmark"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function seenBefore(attempts: { qid: string; sessionId: string }[], qid: string, sessionId: string) {
  return attempts.some((a) => a.qid === qid && a.sessionId !== sessionId);
}
