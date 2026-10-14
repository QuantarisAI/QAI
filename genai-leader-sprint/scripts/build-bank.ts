import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOC_MOCK, BANK_TARGET, DOMAINS, LETTERS, type BankFile, type Domain, type Letter, type MetaFile, type QuestionBase } from "../src/lib/types";
import { hashStr, mulberry32, shuffle } from "../src/lib/rng";
import type { Item } from "../content/types";
import { FUNDAMENTALS } from "../content/fundamentals";
import { OFFERINGS } from "../content/offerings";
import { OUTPUT } from "../content/output";
import { BUSINESS } from "../content/business";
import { OUTPUT_SHORT, BUSINESS_SHORT } from "../content/patches/output_business_short";
import { OFFER_SHORT } from "../content/patches/offerings_short";
import { FUND_FINAL } from "../content/patches/fundamentals_final";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SETS: [Domain, string, Item[]][] = [
  ["Fundamentals", "F", FUNDAMENTALS],
  ["Google Cloud Offerings", "G", OFFERINGS],
  ["Output Improvement", "O", OUTPUT],
  ["Business Strategy & Security", "B", BUSINESS],
];
const BASE_ID: Record<Domain, number> = { Fundamentals: 1000, "Google Cloud Offerings": 2000, "Output Improvement": 3000, "Business Strategy & Security": 4000 };

/** Position targets: shuffled blocks of A-D so letters stay balanced in any prefix. */
function letterSequence(n: number, seed: string): Letter[] {
  const rng = mulberry32(hashStr(seed));
  const out: Letter[] = [];
  while (out.length < n) out.push(...shuffle(LETTERS, rng));
  return out.slice(0, n);
}


/**
 * Length-tell balancing. Authors tend to give the correct option the fullest wording, which is a
 * test-taking cue. For each question a target length rank (0 = shortest ... 3 = longest) is drawn from a
 * balanced seeded sequence; the correct option is then trimmed at clause boundaries (", which ...",
 * ", with ...", etc.) to land as close to that rank as possible. The detail removed from the option text
 * remains in its rationale. Only the correct option is ever shortened; distractors are never altered.
 */
const CUT = /(, which |, with |, and |, so |, since |, because |, then |, rather than |, while |, but |; |, keeping |, leaving |, using |, plus |, as |, to )/g;
function rankOf(len: number, wrongLens: number[]) {
  return wrongLens.filter((w) => w < len).length;
}
function balanceCorrect(text: string, wrongs: string[], target: number, short?: string): string {
  const wl = wrongs.map((w) => w.length);
  const cands: string[] = [text];
  if (short) cands.push(short);
  for (const m of text.matchAll(CUT)) {
    const cut = text.slice(0, m.index).trim();
    if (cut.length >= 28) cands.push(cut.endsWith(".") ? cut : cut + ".");
  }
  let best = text, bestScore = Infinity;
  for (const c of cands) {
    const score = Math.abs(rankOf(c.length, wl) - target) * 1000 + (text.length - c.length);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

const questions: QuestionBase[] = [];
const meta: MetaFile = {};
for (const [domain, , items] of SETS) {
  // Slot plan for the full target bank of this domain, shuffled with a fixed seed.
  const m = ALLOC_MOCK[domain];
  const labels: (1 | 2 | 3 | null)[] = [
    ...Array(m).fill(1), ...Array(m).fill(2), ...Array(m).fill(3),
    ...Array(BANK_TARGET[domain] - 3 * m).fill(null),
  ];
  const slots = shuffle(labels, mulberry32(hashStr("slots:" + domain)));
  const targets = letterSequence(items.length, "letters:" + domain);
  const rankSeq = letterSequence(items.length, "ranks:" + domain).map((l) => LETTERS.indexOf(l));
  const patch: Record<number, string[]> = domain === "Fundamentals" ? FUND_FINAL : {};
  items.forEach((it0, i) => {
    let it = it0;
    const pt = patch[i + 1];
    if (pt) it = { ...it0, right: [pt[0], it0.right[1]], wrong: it0.wrong.map((w, k) => [pt[k + 1], w[1], w[2]]) as Item["wrong"] };
    const id = BASE_ID[domain] + i + 1;
    const rng = mulberry32(hashStr(`opts:${id}`));
    const target = targets[i];
    const wrongs = shuffle(it.wrong, rng);
    if (domain !== "Fundamentals") {
      const rt = balanceCorrect(it.right[0], wrongs.map((w) => w[0]), rankSeq[i], ({ "Google Cloud Offerings": OFFER_SHORT, "Output Improvement": OUTPUT_SHORT, "Business Strategy & Security": BUSINESS_SHORT } as Record<string, Record<number, string>>)[domain]?.[i + 1]);
      it = { ...it, right: [rt, it.right[1]] };
    }
    const opts: { text: string; rationale: string; ok: boolean; tag?: string }[] = [];
    let w = 0;
    for (const L of LETTERS) {
      if (L === target) opts.push({ text: it.right[0], rationale: it.right[1], ok: true });
      else {
        const x = wrongs[w++];
        opts.push({ text: x[0], rationale: x[1], ok: false, tag: x[2] });
      }
    }
    questions.push({
      id,
      exam_domain: domain,
      scenario_question: it.q,
      hint: it.hint,
      options: opts.map((o, j) => ({ option_letter: LETTERS[j], text: o.text, is_correct: o.ok, business_rationale: o.rationale })),
    });
    const tags: Partial<Record<Letter, string>> = {};
    opts.forEach((o, j) => { if (o.tag) tags[LETTERS[j]] = o.tag; });
    meta[String(id)] = {
      objective: it.obj,
      objective_verified: false,
      tags: it.tags,
      difficulty: it.diff,
      source_ids: it.src ?? [],
      verification_date: null,
      review_status: "draft_unverified",
      misconceptions: [...new Set(Object.values(tags))] as string[],
      distractor_tags: tags,
      mock: slots[i] ?? null,
      principle: it.principle,
      ...(it.ph ? { principle_hinglish: it.ph } : {}),
    };
  });
}
const bank: BankFile = {
  quiz_metadata: { target_certification: "Google Cloud Generative AI Leader", total_questions: questions.length },
  questions,
};
mkdirSync(join(root, "src/data"), { recursive: true });
writeFileSync(join(root, "src/data/bank.json"), JSON.stringify(bank, null, 1));
writeFileSync(join(root, "src/data/meta.json"), JSON.stringify(meta, null, 1));
const counts = Object.fromEntries(DOMAINS.map((d) => [d, questions.filter((q) => q.exam_domain === d).length]));
console.log("built", questions.length, "questions", counts);
