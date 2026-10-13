import { DOMAINS, LETTERS, type Backup, type BankFile } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validate the import/export contract. Never mutates; reports every problem found. */
export function validateBankFile(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["Top level must be a JSON object with quiz_metadata and questions."] };
  const meta = input.quiz_metadata;
  if (!isObj(meta)) errors.push("quiz_metadata is missing or not an object.");
  else {
    if (!isStr(meta.target_certification)) errors.push("quiz_metadata.target_certification must be non-empty text.");
    if (typeof meta.total_questions !== "number" || !Number.isInteger(meta.total_questions))
      errors.push("quiz_metadata.total_questions must be an integer.");
  }
  const qs = input.questions;
  if (!Array.isArray(qs)) {
    errors.push("questions must be an array.");
    return { ok: false, errors };
  }
  if (isObj(meta) && typeof meta.total_questions === "number" && meta.total_questions !== qs.length)
    errors.push(`quiz_metadata.total_questions is ${meta.total_questions} but questions has ${qs.length} items.`);
  const seen = new Set<number>();
  qs.forEach((q, i) => {
    const at = `questions[${i}]`;
    if (!isObj(q)) return void errors.push(`${at} must be an object.`);
    const id = q.id;
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) errors.push(`${at}.id must be a positive integer.`);
    else if (seen.has(id)) errors.push(`${at}.id ${id} is a duplicate.`);
    else seen.add(id);
    const tag = typeof id === "number" ? `${at} (id ${id})` : at;
    if (!(DOMAINS as readonly string[]).includes(q.exam_domain as string))
      errors.push(`${tag}.exam_domain must be one of: ${DOMAINS.join(", ")}.`);
    if (!isStr(q.scenario_question)) errors.push(`${tag}.scenario_question must be non-empty text.`);
    if (!isStr(q.hint)) errors.push(`${tag}.hint must be non-empty text.`);
    const opts = q.options;
    if (!Array.isArray(opts) || opts.length !== 4) {
      errors.push(`${tag}.options must contain exactly 4 options.`);
      return;
    }
    const letters = new Set<string>();
    let correct = 0;
    opts.forEach((o, j) => {
      const ot = `${tag}.options[${j}]`;
      if (!isObj(o)) return void errors.push(`${ot} must be an object.`);
      if (!(LETTERS as readonly string[]).includes(o.option_letter as string)) errors.push(`${ot}.option_letter must be A, B, C or D.`);
      else if (letters.has(o.option_letter as string)) errors.push(`${ot}.option_letter "${o.option_letter}" is repeated.`);
      else letters.add(o.option_letter as string);
      if (!isStr(o.text)) errors.push(`${ot}.text must be non-empty text.`);
      if (!isStr(o.business_rationale)) errors.push(`${ot}.business_rationale must be non-empty text.`);
      if (typeof o.is_correct !== "boolean") errors.push(`${ot}.is_correct must be true or false.`);
      else if (o.is_correct) correct++;
    });
    if (correct !== 1) errors.push(`${tag} must have exactly one correct option (found ${correct}).`);
  });
  return { ok: errors.length === 0, errors };
}

export function parseBankJson(text: string): { ok: true; bank: BankFile } | { ok: false; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const r = validateBankFile(data);
  return r.ok ? { ok: true, bank: data as BankFile } : { ok: false, errors: r.errors };
}

export function validateBackup(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["Backup must be a JSON object."] };
  if (input.app !== "genai-leader-sprint") errors.push('Backup "app" must be "genai-leader-sprint".');
  if (input.version !== 1) errors.push("Unsupported backup version (expected 1).");
  for (const k of ["sessions", "attempts", "bookmarks"] as const)
    if (!Array.isArray(input[k])) errors.push(`Backup "${k}" must be an array.`);
  if (input.settings !== null && !isObj(input.settings)) errors.push('Backup "settings" must be an object or null.');
  if (Array.isArray(input.sessions))
    input.sessions.forEach((s, i) => {
      if (!isObj(s) || !isStr(s.id) || !Array.isArray(s.qkeys) || !isObj(s.answers) || !isObj(s.order))
        errors.push(`sessions[${i}] is malformed.`);
    });
  if (Array.isArray(input.attempts))
    input.attempts.forEach((a, i) => {
      if (!isObj(a) || !isStr(a.id) || !isStr(a.qkey) || typeof a.correct !== "boolean" || typeof a.at !== "number")
        errors.push(`attempts[${i}] is malformed.`);
    });
  if (input.imported != null) {
    const im = input.imported as Record<string, unknown>;
    if (!isObj(im) || !Array.isArray(im.questions)) errors.push("Backup imported set is malformed.");
    else {
      const r = validateBankFile({
        quiz_metadata: { target_certification: "x", total_questions: im.questions.length },
        questions: im.questions,
      });
      errors.push(...r.errors.map((e) => `imported: ${e}`));
    }
  }
  return { ok: errors.length === 0, errors: errors.slice(0, 30) };
}
export type { Backup };
