"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { Feedback, Options, ConfidencePicker } from "./QuestionView";
import type { Confidence, Letter, Session } from "@/lib/types";

export function SessionRunner({ id }: { id: string }) {
  const app = useApp();
  const router = useRouter();
  const found = app.getSession(id);
  const [local, setLocal] = useState<Session | undefined>(found);
  const [showHint, setShowHint] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const s = local;
  const cursor = s?.cursor ?? 0;
  useEffect(() => { headingRef.current?.focus(); }, [cursor]);

  if (!s) return <p>Session not found. <a href="/practice">Start a new one</a>.</p>;
  if (s.kind === "exam") { router.replace(`/exam/run?id=${s.id}`); return null; }

  const qkey = s.qkeys[s.cursor];
  const q = app.byKey.get(qkey);
  if (!q) return <p>Question missing from the bank.</p>;
  const ans = s.answers[qkey];
  const submitted = !!ans?.submitted;
  const total = s.qkeys.length;
  const answeredCount = Object.values(s.answers).filter((a) => a.submitted).length;

  const update = async (next: Session) => { setLocal(next); await app.persistSession(next); };

  const select = (letter: Letter) => {
    if (submitted) return;
    void update({ ...s, answers: { ...s.answers, [qkey]: { ...ans, letter, hintUsed: !!s.hinted?.includes(qkey), at: Date.now(), submitted: false } } });
  };
  const setConf = (c: Confidence) => {
    if (submitted || !ans) return;
    void update({ ...s, answers: { ...s.answers, [qkey]: { ...ans, confidence: c } } });
  };
  const hint = () => {
    setShowHint(true);
    if (!submitted && !s.hinted?.includes(qkey)) {
      void update({ ...s, hinted: [...(s.hinted ?? []), qkey], answers: ans ? { ...s.answers, [qkey]: { ...ans, hintUsed: true } } : s.answers });
    }
  };
  const submit = async () => { if (ans?.letter) setLocal(await app.submitQuestion(s, q)); };
  const go = async (d: number) => { setShowHint(false); await update({ ...s, cursor: Math.min(total - 1, Math.max(0, s.cursor + d)) }); };
  const finish = async () => { await app.finishSession(s); router.push(`/results?id=${s.id}`); };

  return (
    <div>
      <p className="small muted">{s.label} · {answeredCount}/{total} submitted</p>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answeredCount} aria-label="Progress"><span style={{ width: `${(100 * answeredCount) / total}%` }} /></div>
      <h1 ref={headingRef} tabIndex={-1}>Question {s.cursor + 1} of {total}</h1>
      <p><span className="badge">{q.exam_domain}</span>{q.imported && <> <span className="badge">imported</span></>}</p>
      <p style={{ fontSize: "1.05rem" }}>{q.scenario_question}</p>
      {!submitted && (
        <p>
          <button type="button" className="btn secondary" onClick={hint} aria-expanded={showHint}>Show hint</button>
          {showHint && <span role="note" style={{ marginLeft: ".7rem" }}><strong>Hint:</strong> {q.hint}</span>}
        </p>
      )}
      <Options q={q} order={s.order[qkey]} name={`q-${qkey}`} selected={ans?.letter} onSelect={select} disabled={submitted} reveal={submitted} />
      {!submitted && <ConfidencePicker value={ans?.confidence} onChange={setConf} />}
      {!submitted ? (
        <button type="button" className="btn" onClick={submit} disabled={!ans?.letter}>Submit answer</button>
      ) : (
        <Feedback q={q} order={s.order[qkey]} chosen={ans?.letter} settings={app.settings} bookmarked={app.bookmarks.has(qkey)} onBookmark={() => app.toggleBookmark(qkey)} />
      )}
      <div className="row" style={{ marginTop: "1rem" }}>
        <button type="button" className="btn secondary" onClick={() => go(-1)} disabled={s.cursor === 0}>← Previous</button>
        {s.cursor < total - 1 ? (
          <button type="button" className="btn secondary" onClick={() => go(1)} >Next →</button>
        ) : (
          <button type="button" className="btn" onClick={finish}>Finish and see results</button>
        )}
      </div>
      {s.cursor === total - 1 && answeredCount < total && <p className="small muted">{total - answeredCount} question(s) not submitted yet; unsubmitted questions are not counted in practice results.</p>}
    </div>
  );
}
