/**
 * Source register. `status` records what actually happened when this build tried to read it:
 *  - "read": fetched and read in this build session
 *  - "blocked": request denied by the sandbox network policy; contents NOT read
 *  - "link-only": published link, not fetched
 */
export interface Source {
  id: string;
  title: string;
  url: string;
  status: "read" | "blocked" | "link-only";
  checked: string; // YYYY-MM-DD
  note: string;
}
export const SOURCES: Source[] = [
  { id: "cert", title: "Generative AI Leader certification page", url: "https://cloud.google.com/learn/certification/generative-ai-leader", status: "read", checked: "2026-10-13", note: "Read. Confirms 90 min, 50-60 MCQ, $99, 3-year validity, four assessed areas, and that sample questions are not predictive. Notes that product names on the exam follow the exam guide." },
  { id: "exam-guide", title: "Official exam guide (PDF)", url: "https://services.google.com/fh/files/misc/generative_ai_leader_exam_guide_english.pdf", status: "blocked", checked: "2026-10-13", note: "Egress proxy returned 403. NOT read. Official objective identifiers are therefore unknown." },
  { id: "study-guide", title: "Official study guide (PDF)", url: "https://services.google.com/fh/files/misc/generative_ai_leader_study_guide_english.pdf", status: "blocked", checked: "2026-10-13", note: "Egress proxy returned 403. NOT read." },
  { id: "path", title: "Generative AI Leader learning path", url: "https://www.cloudskillsboost.google/paths/1951", status: "link-only", checked: "2026-10-13", note: "Link taken from the certification page; fetch blocked." },
  { id: "path-partner", title: "Partner learning path", url: "https://partner.cloudskillsboost.google/paths/1952", status: "link-only", checked: "2026-10-13", note: "Link taken from the certification page; fetch blocked." },
  { id: "model-garden", title: "Model Garden overview (Google Cloud docs)", url: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-garden/explore-models", status: "blocked", checked: "2026-10-13", note: "The old cloud.google.com URL answered 301 to this address, but content was not readable. Capability claims from memory, unverified." },
];
export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);
