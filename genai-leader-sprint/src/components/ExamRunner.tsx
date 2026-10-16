"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { remainingMs } from "@/lib/engine";
import { ConfidencePicker, Options } from "./QuestionView";
import type { Confidence, Letter, Session } from "@/lib/types";

const fmt = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function ExamRunner({ id }: { id: string }) {
  const app = useApp();
  const router = useRouter();
  const [s, setS] = useState<Session | undefined>(() => app.getSession(id));
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<"question" | "review">("question");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [announce, setAnnounce] = useState("");
  const finishing = useRef(false);
  const sRef = useRef(s);
  const since = useRef<{ key: string; t: number } | null>(null);
  useEffect(() => { sRef.current = s; });

  const flushTime = useCallback((cur: Session): Session => {
    const mark = since.current;
    const t = Date.now();
    since.current = { key: cur.qkeys[cur.cursor], t };
    if (!mark) return cur;
    return { ...cur, timeMs: { ...cur.timeMs, [mark.key]: (cur.timeMs[mark.key] ?? 0) + (t - mark.t) } };
  }, []);

  const finish = useCallback(async () => {
    if (finishing.current || !sRef.current) return;
    finishing.current = true;
    const flushed = flushTime(sRef.current);
    const done = await app.finishExam(flushed);
    router.replace(`/certifications/google/results?id=${done.id}`);
  }, [app, flushTime, router]);

  // Clock: always derive remaining time from the persisted deadline.
  useEffect(() => {
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const cur = sRef.current;
      if (cur?.deadline) {
        const left = cur.deadline - t;
        const mins = Math.ceil(left / 60000);
        if (left > 0 && [30, 10, 5, 1].includes(mins) && left % 60000 > 58000) setAnnounce(`${mins} minute${mins > 1 ? "s" : ""} remaining`);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  const remaining = s ? remainingMs(s, now) : 0;
  useEffect(() => {
    if (!s) return;
    if (s.status !== "active") router.replace(`/certifications/google/results?id=${s.id}`);
    else if (remaining <= 0) void finish();
  }, [s, remaining, finish, router]);

  const curKey = s ? s.qkeys[s.cursor] : undefined;
  useEffect(() => {
    if (curKey && !since.current) since.current = { key: curKey, t: Date.now() };
  }, [curKey]);

  // Flush time spent when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => { const cur = sRef.current; if (cur && cur.status === "active" && document.visibilityState === "hidden") { const n = flushTime(cur); setS(n); void app.persistSession(n); } };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [app, flushTime]);

  if (!s) return <p>Exam session not found.</p>;
  if (s.status !== "active") return <p role="status">Exam finished. Opening results…</p>;

  const total = s.qkeys.length;
  const answered = s.qkeys.filter((k) => s.answers[k]?.letter).length;
  const unanswered = total - answered;
  const qkey = s.qkeys[s.cursor];
  const q = app.byKey.get(qkey)!;
  const ans = s.answers[qkey];

  const save = async (next: Session) => { setS(next); await app.persistSession(next); };
  const goto = async (i: number) => { const f = flushTime(s); setConfirmClear(false); setView("question"); await save({ ...f, cursor: i }); };
  const select = (letter: Letter) => void save({ ...s, answers: { ...s.answers, [qkey]: { ...ans, letter, at: Date.now(), submitted: false } } });
  const setConf = (c: Confidence) => { if (ans) void save({ ...s, answers: { ...s.answers, [qkey]: { ...ans, confidence: c } } }); };
  const flag = () => void save({ ...s, flags: s.flags.includes(qkey) ? s.flags.filter((k) => k !== qkey) : [...s.flags, qkey] });
  const clear = () => { const rest = { ...s.answers }; delete rest[qkey]; setConfirmClear(false); void save({ ...s, answers: rest }); };
  const low = remaining < 5 * 60000;

  return (
    <div>
      <div className="sticky" role="region" aria-label="Exam status">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>{s.label}</span>
          <span className="timer" aria-label={`Time remaining ${fmt(remaining)}`}>{low ? "⚠ " : "⏱ "}{fmt(remaining)}</span>
          <span>Answered {answered}/{total} · Unanswered {unanswered} · Flagged {s.flags.length}</span>
        </div>
      </div>
      <p className="sr" aria-live="polite">{announce}</p>
      <div className="callout">Hints and feedback are hidden until you submit. Unanswered questions count as incorrect. Your deadline is saved, so reloading or closing this tab does not pause the clock.</div>

      {view === "question" ? (
        <>
          <h1>Question {s.cursor + 1} of {total}</h1>
          <p><span className="badge">{q.exam_domain}</span> {s.flags.includes(qkey) && <span className="badge">⚑ Flagged</span>}</p>
          <p style={{ fontSize: "1.05rem" }}>{q.scenario_question}</p>
          <Options q={q} order={s.order[qkey]} name={`x-${qkey}`} selected={ans?.letter} onSelect={select} />
          <ConfidencePicker value={ans?.confidence} onChange={setConf} disabled={!ans?.letter} />
          <div className="row">
            <button type="button" className="btn secondary" onClick={flag} aria-pressed={s.flags.includes(qkey)}>{s.flags.includes(qkey) ? "⚑ Unflag" : "⚐ Flag for review"}</button>
            {ans?.letter && !confirmClear && <button type="button" className="btn secondary" onClick={() => setConfirmClear(true)}>Clear answer…</button>}
            {confirmClear && (
              <span role="alert" className="row">
                Clear your answer? <button type="button" className="btn danger" onClick={clear}>Yes, clear</button>
                <button type="button" className="btn secondary" onClick={() => setConfirmClear(false)}>Keep it</button>
              </span>
            )}
          </div>
          <div className="row" style={{ marginTop: "1rem" }}>
            <button type="button" className="btn secondary" onClick={() => goto(s.cursor - 1)} disabled={s.cursor === 0}>← Previous</button>
            <button type="button" className="btn secondary" onClick={() => goto(s.cursor + 1)} disabled={s.cursor === total - 1}>Next →</button>
            <button type="button" className="btn" onClick={() => { setS(flushTime(s)); setView("review"); }}>Review and submit</button>
          </div>
        </>
      ) : (
        <>
          <h1>Final review</h1>
          <ul>
            <li>Answered: <strong>{answered}</strong></li>
            <li>Unanswered: <strong>{unanswered}</strong> (these will count as incorrect)</li>
            <li>Flagged: <strong>{s.flags.length}</strong></li>
          </ul>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setView("question")}>Back to questions</button>
            {!confirmSubmit ? (
              <button type="button" className="btn" onClick={() => setConfirmSubmit(true)}>Submit exam…</button>
            ) : (
              <span role="alert" className="row">
                Submit now with {unanswered} unanswered? <button type="button" className="btn danger" onClick={() => void finish()}>Yes, submit</button>
                <button type="button" className="btn secondary" onClick={() => setConfirmSubmit(false)}>Cancel</button>
              </span>
            )}
          </div>
        </>
      )}

      <h2>Question navigator</h2>
      <div className="palette" role="group" aria-label="Question navigator">
        {s.qkeys.map((k, i) => {
          const a = !!s.answers[k]?.letter, f = s.flags.includes(k);
          return (
            <button key={k} type="button" className={`pal${a ? " ans" : ""}${i === s.cursor ? " cur" : ""}`} onClick={() => goto(i)}
              aria-label={`Question ${i + 1}, ${a ? "answered" : "unanswered"}${f ? ", flagged" : ""}${i === s.cursor ? ", current" : ""}`}>
              {i + 1}{a ? "✓" : ""}{f && <span className="f" aria-hidden>⚑</span>}
            </button>
          );
        })}
      </div>
      <p className="small muted">✓ = answered · ⚑ = flagged · empty = unanswered</p>
    </div>
  );
}
