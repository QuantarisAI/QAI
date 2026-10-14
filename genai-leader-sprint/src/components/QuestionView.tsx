"use client";
import { displayOptions, correctLetter, isCorrect } from "@/lib/engine";
import type { AppQuestion, Confidence, Letter, Settings } from "@/lib/types";
import { SOURCES } from "@/data/sources";
import { objectiveById } from "@/data/objectives";

export function Options({
  q, order, name, selected, onSelect, disabled, reveal,
}: {
  q: AppQuestion; order: Letter[]; name: string; selected?: Letter; onSelect?: (l: Letter) => void; disabled?: boolean; reveal?: boolean;
}) {
  const opts = displayOptions(q, order);
  return (
    <fieldset disabled={disabled && !reveal}>
      <legend className="sr">Answer options</legend>
      {opts.map((o) => {
        const isSel = selected === o.option_letter;
        const cls = reveal ? (o.is_correct ? "opt correct" : isSel ? "opt wrong" : "opt") : "opt";
        return (
          <label key={o.option_letter} className={cls}>
            <input
              type="radio" name={name} value={o.option_letter} checked={isSel}
              disabled={disabled}
              onChange={() => onSelect?.(o.option_letter)}
            />
            <span className="lab">{o.label}.</span>
            <span>
              {o.text}
              {reveal && (
                <>
                  {" "}
                  {o.is_correct && <span className="mark ok">✔ Best answer</span>}
                  {!o.is_correct && isSel && <span className="mark bad">✘ Your choice</span>}
                </>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function ConfidencePicker({ value, onChange, disabled }: { value?: Confidence; onChange: (c: Confidence) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend>How confident are you? (optional)</legend>
      <div className="row">
        {(["low", "medium", "high"] as const).map((c) => (
          <label key={c} className="row" style={{ margin: 0 }}>
            <input type="radio" name="conf" checked={value === c} onChange={() => onChange(c)} style={{ width: 22, height: 22 }} />
            <span style={{ textTransform: "capitalize" }}>{c}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SourceList({ q }: { q: AppQuestion }) {
  const ids = q.meta.source_ids;
  return (
    <div className="small">
      <strong>Sources:</strong>{" "}
      {ids.length === 0 ? (
        <span>none attached yet. This item is an unverified draft; check it against Google&apos;s{" "}
          <a href="https://cloud.google.com/learn/certification/generative-ai-leader" target="_blank" rel="noreferrer">official learning path and study guide</a>.</span>
      ) : (
        ids.map((id) => {
          const s = SOURCES.find((x) => x.id === id);
          return s ? (
            <span key={id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <span className="badge">{s.status === "read" ? "read" : "not verified"}</span>{" "}
            </span>
          ) : null;
        })
      )}
    </div>
  );
}

export function Feedback({
  q, order, chosen, settings, bookmarked, onBookmark,
}: {
  q: AppQuestion; order: Letter[]; chosen?: Letter; settings: Settings; bookmarked?: boolean; onBookmark?: () => void;
}) {
  const ok = isCorrect(q, chosen);
  const opts = displayOptions(q, order);
  const obj = objectiveById(q.meta.objective);
  const principle = settings.language === "hinglish" && q.meta.principle_hinglish ? q.meta.principle_hinglish : q.meta.principle;
  return (
    <section aria-label="Feedback" className={`callout ${ok ? "okc" : "err"}`} role="status">
      <p style={{ margin: 0 }}>
        <strong>{chosen ? (ok ? "✔ Correct" : "✘ Not quite") : "✘ Unanswered"}</strong> · best answer: {opts.find((o) => o.option_letter === correctLetter(q))?.label}
        {obj && <span className="muted"> · {obj.id} {obj.title}</span>}
      </p>
      {principle && (
        <p>
          <strong>Decision principle:</strong> {principle}
          {settings.language === "hinglish" && !q.meta.principle_hinglish && <span className="muted"> (Hinglish version not available for this item.)</span>}
        </p>
      )}
      <ul className="clean">
        {opts.map((o) => (
          <li key={o.option_letter} style={{ margin: ".5rem 0" }}>
            <strong>{o.label}. {o.is_correct ? "✔ Appropriate" : "✘ Not appropriate here"}</strong>
            {chosen === o.option_letter && " (your choice)"}: {o.text}
            <br />
            <span>{o.business_rationale}</span>
          </li>
        ))}
      </ul>
      {chosen && !ok && q.meta.distractor_tags?.[chosen] && (
        <p className="small"><strong>Misconception to watch:</strong> {q.meta.distractor_tags[chosen]!.replace(/-/g, " ")}</p>
      )}
      <SourceList q={q} />
      {onBookmark && (
        <button type="button" className="btn secondary" onClick={onBookmark} aria-pressed={bookmarked} style={{ marginTop: ".5rem" }}>
          {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
        </button>
      )}
    </section>
  );
}
