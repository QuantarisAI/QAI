import { addDays, diffDays } from "./dates";
import type { Attempt, Session } from "./types";

export interface DayDef {
  day: number;
  title: string;
  focus: string;
  /** extra non-exam question attempts expected on this day (cumulative logic) */
  questions: number;
  diagnostic?: boolean;
  mock?: 1 | 2 | 3;
  /** day-10 style: mock OR extra revision questions */
  mockOptional?: boolean;
  tips: string[];
}
/** The 10-day program from the brief (days 1-10). Question counts are targets, not exam facts. */
export const DAYS: DayDef[] = [
  { day: 1, title: "Diagnostic + start fundamentals", focus: "Fundamentals", questions: 30, diagnostic: true, tips: ["Take the 20-question diagnostic.", "Read the Fundamentals lessons; 10 more learn questions.", "Write down weak concepts."] },
  { day: 2, title: "Finish fundamentals & model selection", focus: "Fundamentals · data · model families", questions: 40, tips: ["Data concepts, model selection, Google model families.", "40 questions."] },
  { day: 3, title: "Google offerings: workplace and customer-facing", focus: "Google Cloud Offerings", questions: 40, tips: ["Workplace and customer engagement offerings.", "40 product-selection scenarios."] },
  { day: 4, title: "Service selection: Agent Platform, Search, Studio", focus: "Google Cloud Offerings", questions: 40, tips: ["Agent Platform, Agent Search, Agent Studio, Model Garden, purpose-built APIs.", "40 questions."] },
  { day: 5, title: "Output improvement", focus: "Output Improvement", questions: 40, tips: ["Prompting, grounding, RAG, tuning, evaluation, generation settings.", "40 questions."] },
  { day: 6, title: "Business strategy, security, responsible AI", focus: "Business Strategy & Security", questions: 40, tips: ["Value, adoption, responsible AI, privacy, security, SAIF.", "40 questions."] },
  { day: 7, title: "Mock 1 and review", focus: "Timed mock", questions: 0, mock: 1, tips: ["90 minutes uninterrupted.", "Then review every mistake and every uncertain correct answer (30-45 min)."] },
  { day: 8, title: "Weak-area repair", focus: "Two weakest domains", questions: 40, tips: ["Short lessons on the two weakest domains.", "40-60 fresh scenario questions."] },
  { day: 9, title: "Mock 2 and review", focus: "Timed mock", questions: 0, mock: 2, tips: ["Review reasoning, pacing, and recurring misconceptions."] },
  { day: 10, title: "Mock 3 if rested, else targeted revision", focus: "Product comparisons & technique trade-offs", questions: 20, mock: 3, mockOptional: true, tips: ["Mock 3 only if rested; otherwise revise cards and notebook.", "Check your exam arrangements (ID, proctoring, time slot)."] },
];

export type DayStatus = "done" | "today" | "upcoming" | "missed";
export interface DayView extends DayDef {
  date: string;
  status: DayStatus;
  cumRequired: number;
}
export interface ProgramView {
  days: DayView[];
  todayIndex: number; // 1-based; <1 before start, >10 after
  achievedQuestions: number;
  carryOver: number; // questions owed from missed days
  todayRemaining: number; // total questions left today, including carry-over
  missedDays: number[];
}

export function programView(startDate: string, today: string, attempts: Attempt[], sessions: Session[]): ProgramView {
  const idx = diffDays(startDate, today) + 1;
  const achieved = attempts.filter((a) => a.mode !== "exam").length;
  const diagDone = sessions.some((s) => s.kind === "diagnostic" && s.submittedAt);
  const mocksDone = new Set(sessions.filter((s) => s.kind === "exam" && s.submittedAt).map((s) => s.mockNo));
  let cum = 0;
  const days: DayView[] = DAYS.map((d) => {
    cum += d.questions;
    const qOk = achieved >= cum;
    let done = qOk && (!d.diagnostic || diagDone);
    if (d.mock) done = d.mockOptional ? mocksDone.has(d.mock) || qOk : mocksDone.has(d.mock) && qOk;
    const status: DayStatus = done ? "done" : d.day < idx ? "missed" : d.day === idx ? "today" : "upcoming";
    return { ...d, date: addDays(startDate, d.day - 1), status, cumRequired: cum };
  });
  const missed = days.filter((d) => d.status === "missed").map((d) => d.day);
  const reqThrough = (n: number) => days.filter((d) => d.day <= n).reduce((s, d) => s + d.questions, 0);
  const carry = Math.max(0, reqThrough(Math.min(10, idx - 1)) - achieved);
  const todayRemaining = Math.max(0, reqThrough(Math.min(10, Math.max(idx, 0))) - achieved);
  return { days, todayIndex: idx, achievedQuestions: achieved, carryOver: carry, todayRemaining, missedDays: missed };
}
