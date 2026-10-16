import { TOPICS } from "./topics";
import { LETTERS, LEVEL_LETTER, LEVELS, type Letter, type Level, type NvQuestion } from "./types";
import type { Item } from "./content/item";
import { hashStr } from "@/lib/rng";

import { C1, C2, C3, C4, C5, C6 } from "./content/core";
import { D1, D2, D3 } from "./content/data";
import { E1, E2, E3, E4 } from "./content/exp";
import { S1, S2, S3, S4 } from "./content/sw";
import { T1, T2, T3 } from "./content/trust";

export const ITEMS_BY_TOPIC: Record<string, Item[]> = { C1, C2, C3, C4, C5, C6, D1, D2, D3, E1, E2, E3, E4, S1, S2, S3, S4, T1, T2, T3 };

/**
 * Turn authored items into runtime questions.
 * - ids are `<topic>-<level letter><n>` (n counts per topic and level, from 1)
 * - the correct answer's authored position is spread evenly by hashing the id (sessions shuffle again on top)
 */
export function assembleBank(itemsByTopic: Record<string, Item[]> = ITEMS_BY_TOPIC): NvQuestion[] {
  const out: NvQuestion[] = [];
  for (const topic of TOPICS) {
    const items = itemsByTopic[topic.id] ?? [];
    const counter: Record<Level, number> = { beginner: 0, easy: 0, medium: 0, hard: 0, legendary: 0 };
    for (const it of items) {
      counter[it.level]++;
      const id = `${topic.id}-${LEVEL_LETTER[it.level]}${counter[it.level]}`;
      const pos = hashStr(id) % 4;
      const wrongs = [...it.wrong];
      const texts: { text: string; correct: boolean; why: string }[] = [];
      for (let i = 0; i < 4; i++) {
        if (i === pos) texts.push({ text: it.right[0], correct: true, why: it.right[1] });
        else {
          const w = wrongs.shift()!;
          texts.push({ text: w[0], correct: false, why: w[1] });
        }
      }
      out.push({
        id,
        topic: topic.id,
        domain: topic.domain,
        level: it.level,
        q: it.q,
        hint: it.hint,
        options: texts.map((t, i) => ({ letter: LETTERS[i] as Letter, ...t })),
        takeaway: it.takeaway,
        tags: it.tags,
        review: "draft_unverified",
        sources: it.src,
      });
    }
  }
  // stable order: topic order, then level order, then authored order
  const lvl = (l: Level) => LEVELS.indexOf(l);
  const tix = (t: string) => TOPICS.findIndex((x) => x.id === t);
  return out.sort((a, b) => tix(a.topic) - tix(b.topic) || lvl(a.level) - lvl(b.level) || a.id.localeCompare(b.id, "en", { numeric: true }));
}

export const NV_BANK: NvQuestion[] = assembleBank();
export const NV_BY_ID = new Map(NV_BANK.map((q) => [q.id, q]));

export interface BankProblem { id: string; kind: "error" | "warn"; msg: string }
/** Structural validation shared by tests and the CLI script. Content truth is NOT checked here. */
export function validateBank(bank: NvQuestion[]): { problems: BankProblem[]; stats: Record<string, number> } {
  const problems: BankProblem[] = [];
  const err = (id: string, msg: string) => problems.push({ id, kind: "error", msg });
  const warn = (id: string, msg: string) => problems.push({ id, kind: "warn", msg });
  const ids = new Set<string>();
  const texts = new Set<string>();
  const cell = new Map<string, number>();
  let longest = 0;
  const correctPos = [0, 0, 0, 0];
  for (const q of bank) {
    if (ids.has(q.id)) err(q.id, "duplicate id");
    ids.add(q.id);
    const norm = q.q.toLowerCase().replace(/\s+/g, " ").trim();
    if (texts.has(norm)) err(q.id, "duplicate question text");
    texts.add(norm);
    if (q.q.length < 15) err(q.id, "question too short");
    if (!q.hint || q.hint.length < 10) err(q.id, "missing hint");
    if (!q.takeaway) err(q.id, "missing takeaway");
    if (q.options.length !== 4) err(q.id, "needs exactly 4 options");
    const right = q.options.filter((o) => o.correct);
    if (right.length !== 1) err(q.id, `needs exactly 1 correct option, has ${right.length}`);
    const optTexts = new Set(q.options.map((o) => o.text.toLowerCase().trim()));
    if (optTexts.size !== q.options.length) err(q.id, "duplicate option text");
    for (const o of q.options) if (!o.text.trim() || !o.why.trim()) err(q.id, `option ${o.letter} missing text or explanation`);
    if (right[0]) {
      const lens = q.options.map((o) => o.text.length);
      if (right[0].text.length === Math.max(...lens) && lens.filter((l) => l === Math.max(...lens)).length === 1) longest++;
      correctPos[q.options.findIndex((o) => o.correct)]++;
      if (q.hint.toLowerCase().includes(right[0].text.toLowerCase()) && right[0].text.length > 12) warn(q.id, "hint repeats the correct answer");
    }
    for (const s of q.sources) if (!/^[a-z]+$/.test(s)) err(q.id, `bad source id ${s}`);
    const k = `${q.topic}|${q.level}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }
  for (const t of TOPICS) for (const l of LEVELS) {
    const n = cell.get(`${t.id}|${l}`) ?? 0;
    if (n < 3) err(`${t.id}-${LEVEL_LETTER[l]}`, `only ${n} question(s) for ${t.id} ${l} (need at least 3)`);
  }
  return {
    problems,
    stats: {
      total: bank.length,
      longestIsCorrectPct: Math.round((longest / Math.max(1, bank.length)) * 100),
      posA: correctPos[0], posB: correctPos[1], posC: correctPos[2], posD: correctPos[3],
    },
  };
}
