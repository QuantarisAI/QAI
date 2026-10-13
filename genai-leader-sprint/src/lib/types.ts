export const DOMAINS = [
  "Fundamentals",
  "Google Cloud Offerings",
  "Output Improvement",
  "Business Strategy & Security",
] as const;
export type Domain = (typeof DOMAINS)[number];

/** Official approximate weights; practice allocations derived from them. */
export const DOMAIN_WEIGHTS: Record<Domain, string> = {
  Fundamentals: "~30%",
  "Google Cloud Offerings": "~35%",
  "Output Improvement": "~20%",
  "Business Strategy & Security": "~15%",
};
/** Default 20-question allocation (6/7/4/3). */
export const ALLOC_20: Record<Domain, number> = {
  Fundamentals: 6,
  "Google Cloud Offerings": 7,
  "Output Improvement": 4,
  "Business Strategy & Security": 3,
};
/** Exact 60-question mock allocation (18/21/12/9). */
export const ALLOC_MOCK: Record<Domain, number> = {
  Fundamentals: 18,
  "Google Cloud Offerings": 21,
  "Output Improvement": 12,
  "Business Strategy & Security": 9,
};
/** Target bank size per domain (108/126/72/54 = 360). */
export const BANK_TARGET: Record<Domain, number> = {
  Fundamentals: 108,
  "Google Cloud Offerings": 126,
  "Output Improvement": 72,
  "Business Strategy & Security": 54,
};
export const MOCK_MINUTES = 90;
export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

/** ---- Import/export contract ---- */
export interface OptionBase {
  option_letter: Letter;
  text: string;
  is_correct: boolean;
  business_rationale: string;
}
export interface QuestionBase {
  id: number;
  exam_domain: Domain;
  scenario_question: string;
  hint: string;
  options: OptionBase[];
}
export interface BankFile {
  quiz_metadata: { target_certification: string; total_questions: number };
  questions: QuestionBase[];
}

/** ---- Companion metadata keyed by question id ---- */
export type Difficulty = "foundation" | "intermediate" | "advanced" | "unrated";
export type ReviewStatus = "draft_unverified" | "draft_self_reviewed" | "needs_revision" | "imported";
export interface QMeta {
  objective: string; // app-defined objective id (NOT an official guide id unless objective_verified)
  objective_verified: boolean;
  tags: string[];
  difficulty: Difficulty;
  source_ids: string[]; // keys into the source register
  verification_date: string | null; // null = never verified against a source
  review_status: ReviewStatus;
  misconceptions: string[];
  /** misconception tag for each wrong option, keyed by option letter as stored in the base bank */
  distractor_tags?: Partial<Record<Letter, string>>;
  mock: 1 | 2 | 3 | null;
  principle: string; // correct decision principle (English)
  principle_hinglish?: string;
}
export type MetaFile = Record<string, QMeta>;

/** ---- Runtime question (built-in or imported) ---- */
export interface AppQuestion extends QuestionBase {
  key: string; // "12" built-in, "imp-12" imported (namespaced)
  meta: QMeta;
  imported: boolean;
}

/** ---- Persistence ---- */
export type Confidence = "low" | "medium" | "high";
export type SessionKind = "diagnostic" | "learn" | "practice" | "drill" | "exam";

export interface AnswerRec {
  letter: Letter; // original option identity
  confidence?: Confidence;
  hintUsed?: boolean;
  at: number;
  submitted: boolean; // false while only selected (non-exam modes)
}
export interface Session {
  id: string;
  kind: SessionKind;
  label: string;
  mockNo?: 1 | 2 | 3;
  repeat?: boolean;
  qkeys: string[];
  /** displayed order of original option letters per question */
  order: Record<string, Letter[]>;
  answers: Record<string, AnswerRec>;
  flags: string[];
  /** questions whose hint was opened (non-exam modes) */
  hinted?: string[];
  timeMs: Record<string, number>;
  startedAt: number;
  deadline?: number; // exam only
  submittedAt?: number;
  status: "active" | "submitted" | "expired";
  cursor: number;
  objective?: string; // learn sets
}
export interface Attempt {
  id: string;
  sessionId: string;
  qkey: string;
  letter: Letter;
  correct: boolean;
  confidence?: Confidence;
  hintUsed: boolean;
  at: number;
  day: string; // YYYY-MM-DD, Europe/Stockholm
  first: boolean; // first-ever attempt on this question
  mode: SessionKind;
  repeatMock: boolean;
}
export interface Settings {
  startDate: string;
  examDate: string;
  minutesPerDay: number;
  language: "en" | "hinglish";
}
export interface ImportedSet {
  importedAt: number;
  questions: QuestionBase[];
}
export interface Backup {
  app: "genai-leader-sprint";
  version: 1;
  exportedAt: number;
  settings: Settings | null;
  sessions: Session[];
  attempts: Attempt[];
  bookmarks: string[];
  imported: ImportedSet | null;
}
