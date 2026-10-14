import bankJson from "@/data/bank.json";
import metaJson from "@/data/meta.json";
import type { AppQuestion, BankFile, ImportedSet, MetaFile, QMeta, QuestionBase } from "./types";

export const BUILT_IN_BANK = bankJson as unknown as BankFile;
export const BUILT_IN_META = metaJson as unknown as MetaFile;

const IMPORT_META: QMeta = {
  objective: "IMP",
  objective_verified: false,
  tags: ["imported"],
  difficulty: "unrated",
  source_ids: [],
  verification_date: null,
  review_status: "imported",
  misconceptions: [],
  mock: null,
  principle: "",
};

export function buildQuestions(builtIn: BankFile, meta: MetaFile, imported: ImportedSet | null): AppQuestion[] {
  const out: AppQuestion[] = builtIn.questions.map((q) => ({
    ...q,
    key: String(q.id),
    imported: false,
    meta: meta[String(q.id)] ?? { ...IMPORT_META, objective: "UNMAPPED", review_status: "draft_unverified" },
  }));
  if (imported)
    for (const q of imported.questions as QuestionBase[])
      out.push({ ...q, key: `imp-${q.id}`, imported: true, meta: IMPORT_META });
  return out;
}
