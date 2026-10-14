import type { Difficulty } from "../src/lib/types";

export type Wrong = [text: string, rationale: string, misconception: string];
export interface Item {
  obj: string; // app objective id, e.g. "F4"
  tags: string[];
  diff: Exclude<Difficulty, "unrated">;
  q: string; // realistic scenario + clear question
  hint: string; // conceptual cue, must not reveal the answer
  right: [text: string, rationale: string];
  wrong: [Wrong, Wrong, Wrong];
  principle: string; // correct decision principle
  ph?: string; // same principle in simple Hinglish
  src?: string[]; // source register ids that genuinely support the claim
}

/** Positional constructor to keep authored content compact. */
export const I = (
  obj: string,
  diff: Item["diff"],
  tags: string,
  q: string,
  hint: string,
  right: [string, string],
  w1: Wrong,
  w2: Wrong,
  w3: Wrong,
  principle: string,
  ph?: string,
  src?: string[],
): Item => ({ obj, diff, tags: tags.split(",").map((t) => t.trim()), q, hint, right, wrong: [w1, w2, w3], principle, ph, src });
