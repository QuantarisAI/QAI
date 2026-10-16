import type { Level } from "../types";

/** [option text, why it is wrong] */
export type Wrong = [text: string, why: string];
export interface Item {
  level: Level;
  /** Realistic scenario plus a clear question. */
  q: string;
  /** Conceptual cue that must not give away the answer. */
  hint: string;
  /** [option text, why it is right] */
  right: [text: string, why: string];
  wrong: [Wrong, Wrong, Wrong];
  /** One-line rule worth remembering. */
  takeaway: string;
  tags: string[];
  /** Source register ids that genuinely support the claim. */
  src: string[];
}

/** Positional constructor to keep authored content compact. */
export const Q = (
  level: Level,
  q: string,
  hint: string,
  right: [string, string],
  w1: Wrong,
  w2: Wrong,
  w3: Wrong,
  takeaway: string,
  tags = "",
  src: string[] = [],
): Item => ({
  level,
  q,
  hint,
  right,
  wrong: [w1, w2, w3],
  takeaway,
  tags: tags ? tags.split(",").map((t) => t.trim()) : [],
  src,
});
