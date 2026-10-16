import { addDays, diffDays } from "@/lib/dates";

export type Phase = "learn" | "stretch" | "mocks" | "wrap";
export interface PlanDay {
  n: number;
  phase: Phase;
  title: string;
  /** Topic ids to work on (for ladder days). */
  topics: string[];
  /** What the main button should do. */
  action: { kind: "topics" | "mock" | "weak" | "review" | "mixed" | "rest"; topic?: string; mock?: string };
  tasks: string[];
}

const L = (title: string, topics: string[], extra: string[] = [], topic = topics[0]): PlanDay => ({
  n: 0, phase: "learn", title, topics, action: { kind: "topics", topic },
  tasks: [
    `Work the ladder for ${topics.join(" + ")}: Beginner, Easy, Medium (add Hard if you are fast).`,
    "Read the takeaway after every question, even the ones you got right.",
    "Clear today's due mistake reviews in the Notebook before you stop.",
    ...extra,
  ],
});
const S = (title: string, topics: string[], extra: string[] = []): PlanDay => ({
  n: 0, phase: "stretch", title, topics, action: { kind: "topics", topic: topics[0] },
  tasks: ["Work Hard and Legendary levels for these topics.", "Write one line per miss on why the right answer is right.", ...extra],
});
const M = (title: string, mock: string, extra: string[] = []): PlanDay => ({
  n: 0, phase: "mocks", title, topics: [], action: { kind: "mock", mock },
  tasks: ["Sit it in one go: 60 questions, 60 minutes, no hints, no pausing.", "Right after: review every miss and every guess.", ...extra],
});
const R = (title: string, kind: "weak" | "review" | "mixed", tasks: string[], phase: Phase = "mocks"): PlanDay => ({
  n: 0, phase, title, topics: [], action: { kind }, tasks,
});

const RAW: PlanDay[] = [
  // Phase 1: learn every topic (days 1-21)
  L("C1 Machine-learning fundamentals", ["C1"]),
  L("C2 Neural-network basics", ["C2"]),
  L("C3 Transformers and LLM architecture", ["C3"]),
  L("C4 Tokenization and embeddings", ["C4"]),
  L("C5 Prompt engineering", ["C5"]),
  L("C6 RAG, chatbots and vector databases", ["C6"], ["Weekend: 3 hours. Add a first pass at the Hard level."]),
  S("Core review: Hard levels C1 to C6", ["C1", "C2", "C3", "C4", "C5", "C6"], ["Sunday: finish with a full run through the Notebook."]),
  L("D1 and D2: data exploration and metrics", ["D1", "D2"]),
  L("D3 Visualization and communicating results", ["D3"]),
  L("E1 Training and optimization", ["E1"]),
  L("E2 Data preparation for pretraining, fine-tuning and RLHF", ["E2"]),
  L("E3 Fine-tuning and alignment", ["E3"]),
  L("E4 Evaluation and experiment design", ["E4"], ["Weekend: 3 hours."]),
  S("Data and Experimentation: Hard levels", ["D1", "D2", "D3", "E1", "E2", "E3", "E4"]),
  L("S1 Python for ML and NLP", ["S1"]),
  L("S2 Building LLM applications", ["S2"]),
  L("S3 The NVIDIA software stack", ["S3"], ["Open the official NVIDIA docs for NeMo, NIM, Triton and TensorRT-LLM and read the overview of each. See Syllabus for the links."]),
  L("S4 Deployment, scalability and monitoring", ["S4"]),
  L("T1 Ethics, bias and fairness", ["T1"]),
  L("T2 and T3: privacy, guardrails and safety", ["T2", "T3"], ["Weekend: 3 hours."]),
  S("Software and Trust: Hard levels", ["S1", "S2", "S3", "S4", "T1", "T2", "T3"]),
  // Phase 2: first mocks and stretch (days 22-30)
  M("Mock 1: baseline", "m1", ["This is a measurement, not a verdict. Expect it to hurt a little."]),
  R("Repair: your three weakest topics", "weak", ["Drill the weak-topic set until each topic is above 70% on first attempts.", "Then clear due reviews."], "stretch"),
  S("Core: Hard and Legendary", ["C1", "C2", "C3", "C4", "C5", "C6"]),
  S("Data and Experimentation: Legendary", ["D1", "D2", "D3", "E1", "E2", "E3", "E4"]),
  S("Software (NVIDIA stack) and Trust: Legendary", ["S1", "S2", "S3", "S4", "T1", "T2", "T3"], ["Re-read the NVIDIA docs for anything in S3 you got wrong."]),
  M("Mock 2: building", "m2", ["Saturday: 3 hours. Mock plus a proper review."]),
  R("Mock 2 review and notebook", "review", ["Rework every miss from Mock 2.", "Clear due reviews. Do not start anything new today."], "stretch"),
  R("Repair: weakest topics again", "weak", ["Another pass at the weakest three topics.", "A topic is fixed when you can explain the wrong options, not just pick the right one."], "stretch"),
  R("Mixed Hard drill", "mixed", ["30 mixed questions across all domains.", "Mark your confidence honestly on each one."], "stretch"),
  // Phase 3: mocks and repair (days 31-38)
  M("Mock 3: exam-like", "m3"),
  R("Mock 3 review and repair", "weak", ["Rework every miss from Mock 3.", "Then drill the weakest topics."]),
  R("Weakest-domain drill", "weak", ["Spend the whole session on the domain that scored lowest in Mock 3."]),
  M("Mock 4: pressure", "m4", ["Saturday: 3 hours."]),
  R("Mock 4 review and notebook", "review", ["Rework every miss from Mock 4.", "Clear due reviews."]),
  R("Repair and Legendary mix", "mixed", ["Mixed Legendary and Hard drill.", "Then due reviews."]),
  M("Mock 5: final dress rehearsal", "m5", ["Harder than the exam is likely to be. Aim to keep your head, not to hit a number."]),
  R("Mock 5 review and one-page summary", "review", ["Rework every miss from Mock 5.", "Write a one-page list of the facts you still confuse."]),
  // Wrap (days 39-40)
  R("Due reviews and exam logistics", "review", [
    "Clear due reviews.",
    "Re-read the official exam page for registration and testing requirements, and check them against your plan for exam day.",
    "Prepare what you need for exam day tonight, not tomorrow.",
  ], "wrap"),
  { n: 0, phase: "wrap", title: "Rest day before the exam", topics: [], action: { kind: "rest" }, tasks: [
    "At most one hour of light review (your one-page list). No new material, no new mock.",
    "Sleep properly. Exam tomorrow.",
  ] },
];
export const PLAN: PlanDay[] = RAW.map((d, i) => ({ ...d, n: i + 1 }));
export const PLAN_DAYS = PLAN.length;

export const PHASE_LABEL: Record<Phase, string> = {
  learn: "Phase 1: learn every topic",
  stretch: "Phase 2: stretch and repair",
  mocks: "Phase 3: mocks and repair",
  wrap: "Wrap-up",
};

/** Weekend days get 3 hours, weekdays 2 hours. */
export function hoursFor(day: string): number {
  const dow = new Date(day + "T12:00:00Z").getUTCDay();
  return dow === 0 || dow === 6 ? 3 : 2;
}
export function dateOf(start: string, n: number) {
  return addDays(start, n - 1);
}
export type DayState = "before" | "active" | "after";
/** Which plan day is it today? Before the start date there is none; after day 40 the plan is over. */
export function planPosition(start: string, today: string): { state: DayState; n: number } {
  const n = diffDays(start, today) + 1;
  if (n < 1) return { state: "before", n: 0 };
  if (n > PLAN_DAYS) return { state: "after", n: PLAN_DAYS };
  return { state: "active", n };
}
