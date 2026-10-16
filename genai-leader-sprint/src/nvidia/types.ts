/**
 * NVIDIA NCA-GENL practice module: shared types and constants.
 *
 * Exam facts below were read from NVIDIA's official exam page on 2026-10-16:
 * 50-60 multiple-choice questions, 1 hour, English, five weighted topic areas.
 * Everything else (levels, mocks, thresholds, roadmap) is this app's own design.
 */

export const NV_EXAM = {
  code: "NCA-GENL",
  name: "NVIDIA-Certified Associate: Generative AI LLMs",
  /** Official: 50-60 questions in 60 minutes. Mocks use 60 (the harder end). */
  mockQuestions: 60,
  mockMinutes: 60,
  defaultExamDate: "2026-11-28",
  defaultStartDate: "2026-10-19",
  officialUrl: "https://www.nvidia.com/en-us/learn/certification/generative-ai-llm-associate/",
  verifiedOn: "2026-10-16",
} as const;

export type DomainId = "core" | "data" | "exp" | "sw" | "trust";
export interface DomainDef {
  id: DomainId;
  name: string;
  short: string;
  /** Official weight in percent. */
  weight: number;
  /** Questions per 60-question mock (rounded from the weights; sums to 60). */
  mockCount: number;
  /** Official sub-topic bullets, paraphrased from the exam page. */
  official: string[];
}
export const DOMAINS: DomainDef[] = [
  {
    id: "core",
    name: "Core Machine Learning and AI Knowledge",
    short: "Core ML & AI",
    weight: 30,
    mockCount: 18,
    official: [
      "Machine learning fundamentals: feature engineering, comparing models, cross-validation",
      "Python NLP packages and vector databases",
      "Building LLM use cases: RAG, chatbots, summarizers",
      "Curating and embedding content datasets for RAG",
      "Selecting and using models to create text embeddings",
      "Applying prompt engineering principles",
      "Using Python packages for traditional ML analysis",
      "Reading research papers to follow LLM trends",
      "Insight extraction from large datasets (data mining, visualization)",
      "Assisting with deployment and with scalability, performance and reliability evaluation",
    ],
  },
  {
    id: "data",
    name: "Data Analysis",
    short: "Data Analysis",
    weight: 14,
    mockCount: 8,
    official: [
      "Extracting insights from large datasets",
      "Comparing models with statistical metrics (loss functions, proportion of explained variance)",
      "Conducting data analysis under supervision",
      "Creating graphs and charts to communicate results",
      "Identifying relationships, trends and factors that could affect results",
    ],
  },
  {
    id: "exp",
    name: "Experimentation",
    short: "Experimentation",
    weight: 22,
    mockCount: 13,
    official: [
      "Assisting with model training and training optimization",
      "Preparing large datasets (scraping, tokenization) for pretraining, fine-tuning and RLHF",
      "Designing or running hardware or software tests for LLM applications",
      "Evaluating technologies for cost, portability, compatibility and usability",
      "Collecting human-subject data for RLHF",
      "Evaluating and refining models; benchmarking",
      "Running experiments to evaluate models and pipelines",
    ],
  },
  {
    id: "sw",
    name: "Software Development",
    short: "Software Dev",
    weight: 24,
    mockCount: 15,
    official: [
      "Writing software components or scripts under supervision",
      "Building LLM use cases such as RAG, chatbots and summarizers",
      "Python NLP packages and vector databases",
      "Python packages for traditional ML analysis",
      "Identifying system data, hardware and software components needed for user needs",
      "Monitoring data collection, experiments and other software processes",
      "Deployment, scalability, performance and reliability evaluation under supervision",
    ],
  },
  {
    id: "trust",
    name: "Trustworthy AI",
    short: "Trustworthy AI",
    weight: 10,
    mockCount: 6,
    official: [
      "Ethical principles of trustworthy AI",
      "Balancing data privacy and data consent",
      "Using NVIDIA and other technologies to improve AI trustworthiness",
      "Minimizing bias in AI systems",
    ],
  },
];
export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d])) as Record<DomainId, DomainDef>;

/** Ascending order of toughness. */
export const LEVELS = ["beginner", "easy", "medium", "hard", "legendary"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  legendary: "Legendary",
};
export const LEVEL_BLURB: Record<Level, string> = {
  beginner: "Vocabulary and definitions: what is it?",
  easy: "Recognise the right concept in a simple situation.",
  medium: "Apply a concept to a realistic scenario.",
  hard: "Compare options, spot the flaw, weigh trade-offs.",
  legendary: "Multi-step reasoning, numbers, near-identical options. Stretch level: harder than the exam is likely to be.",
};
export const LEVEL_LETTER: Record<Level, string> = { beginner: "B", easy: "E", medium: "M", hard: "H", legendary: "L" };

export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

export type ReviewStatus = "draft_unverified" | "draft_self_reviewed" | "needs_revision" | "verified";

export interface NvOption {
  letter: Letter;
  text: string;
  correct: boolean;
  /** Why this option is right or wrong. */
  why: string;
}
export interface NvQuestion {
  id: string; // e.g. "C3-M2"
  topic: string; // e.g. "C3"
  domain: DomainId;
  level: Level;
  q: string;
  hint: string;
  options: NvOption[];
  takeaway: string;
  tags: string[];
  review: ReviewStatus;
  /** Keys into the source register that genuinely support the claim. */
  sources: string[];
}

/* ---------------- Persistence ---------------- */
export type Confidence = "low" | "medium" | "high";
export type SessionKind = "practice" | "mock" | "review";
export interface AnswerRec {
  letter: Letter;
  confidence?: Confidence;
  hintUsed?: boolean;
  at: number;
  submitted: boolean;
}
export interface Session {
  id: string;
  kind: SessionKind;
  label: string;
  mockId?: string;
  topic?: string;
  level?: Level;
  qids: string[];
  /** Displayed order of original option letters per question. */
  order: Record<string, Letter[]>;
  answers: Record<string, AnswerRec>;
  flags: string[];
  hinted?: string[];
  timeMs: Record<string, number>;
  startedAt: number;
  deadline?: number;
  submittedAt?: number;
  status: "active" | "submitted" | "expired";
  cursor: number;
  /** Number of questions in this session that the learner had never seen at start. */
  unseenAtStart: number;
}
export interface Attempt {
  id: string;
  sessionId: string;
  qid: string;
  topic: string;
  domain: DomainId;
  level: Level;
  letter: Letter;
  correct: boolean;
  confidence?: Confidence;
  hintUsed: boolean;
  at: number;
  day: string; // YYYY-MM-DD, Europe/Stockholm
  first: boolean;
  mode: SessionKind;
  mockId?: string;
}
export interface NvSettings {
  startDate: string;
  examDate: string;
}
export interface NvBackup {
  app: "nca-genl-prep";
  version: 1;
  exportedAt: number;
  settings: NvSettings | null;
  sessions: Session[];
  attempts: Attempt[];
  bookmarks: string[];
}
