import { ALLOC_MOCK, DOMAINS, LETTERS, type AppQuestion, type Attempt, type Domain, type Letter } from "../src/lib/types";

let n = 0;
export function mkQ(domain: Domain, opts: { mock?: 1 | 2 | 3 | null; objective?: string; correct?: Letter; key?: string } = {}): AppQuestion {
  n++;
  const correct = opts.correct ?? LETTERS[n % 4];
  return {
    id: n, key: opts.key ?? String(n), imported: false, exam_domain: domain,
    scenario_question: `Scenario ${n} for ${domain}`, hint: "hint",
    options: LETTERS.map((l) => ({ option_letter: l, text: `Option ${l} of ${n}`, is_correct: l === correct, business_rationale: `Why ${l} (${n})` })),
    meta: { objective: opts.objective ?? "F1", objective_verified: false, tags: ["t"], difficulty: "intermediate", source_ids: [], verification_date: null, review_status: "draft_unverified", misconceptions: [], mock: opts.mock ?? null, principle: "p" },
  };
}
/** A full synthetic bank: 3 mocks of 60 plus `learn` learning questions per domain. */
export function mkBank(learnPerDomain = 12): AppQuestion[] {
  const out: AppQuestion[] = [];
  const objFor: Record<Domain, string> = { Fundamentals: "F1", "Google Cloud Offerings": "G1", "Output Improvement": "O1", "Business Strategy & Security": "B1" };
  for (const d of DOMAINS) {
    for (const m of [1, 2, 3] as const) for (let i = 0; i < ALLOC_MOCK[d]; i++) out.push(mkQ(d, { mock: m, objective: objFor[d] }));
    for (let i = 0; i < learnPerDomain; i++) out.push(mkQ(d, { objective: objFor[d] }));
  }
  return out;
}
export function mkAttempt(q: AppQuestion, p: Partial<Attempt> & { correct: boolean }): Attempt {
  const day = p.day ?? "2026-10-14";
  return {
    id: `a${Math.random()}`, sessionId: "s", qkey: q.key, letter: "A", confidence: undefined, hintUsed: false,
    at: Date.parse(day + "T10:00:00Z"), day, first: true, mode: "practice", repeatMock: false, ...p,
  };
}
