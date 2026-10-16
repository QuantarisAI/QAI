"use client";
import { LETTERS, LEVEL_LABEL, type Letter, type NvQuestion } from "../types";

interface Props {
  q: NvQuestion;
  order: Letter[];
  name: string;
  value?: Letter;
  onChange?: (l: Letter) => void;
  /** Show right/wrong and the explanation of every option. */
  reveal?: boolean;
  disabled?: boolean;
  number?: number;
  showLevel?: boolean;
}
export function QuestionCard({ q, order, name, value, onChange, reveal, disabled, number, showLevel }: Props) {
  const byLetter = new Map(q.options.map((o) => [o.letter, o]));
  return (
    <fieldset disabled={disabled && !reveal} aria-describedby={`${name}-meta`}>
      <legend>
        {number !== undefined && <span>Question {number}. </span>}
        <span className="sr">Choose one answer. </span>
      </legend>
      <p id={`${name}-meta`} className="small muted">
        {showLevel && <><span className={`lv lv-${q.level}`}>{LEVEL_LABEL[q.level]}</span>{" "}</>}
        <span className="tag">{q.topic}</span>
      </p>
      <p style={{ fontWeight: 600, margin: ".2rem 0 .6rem" }}>{q.q}</p>
      {order.map((orig, i) => {
        const o = byLetter.get(orig)!;
        const chosen = value === orig;
        const cls = reveal ? (o.correct ? "correct" : chosen ? "wrong" : "") : "";
        return (
          <div key={orig}>
            <label className={`opt ${cls}`}>
              <input
                type="radio" name={name} value={orig} checked={chosen}
                disabled={disabled} onChange={() => onChange?.(orig)}
              />
              <span className="lab">{LETTERS[i]}.</span>
              <span>
                {o.text}
                {reveal && o.correct && <strong className="mark ok"> ✓ Correct answer</strong>}
                {reveal && chosen && !o.correct && <strong className="mark bad"> ✗ Your answer</strong>}
              </span>
            </label>
            {reveal && <p className={`why ${o.correct || chosen ? "show" : ""}`}>{o.why}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
