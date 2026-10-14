/** Revision cards. DRAFT: framed as trade-offs; not verified against Google documentation. */
export interface Card { id: string; topic: string; title: string; rows: [string, string][]; note: string }
export const CARDS: Card[] = [
  { id: "c1", topic: "Techniques", title: "Prompting vs RAG vs tuning", rows: [
    ["Prompting", "Fastest and cheapest to try. Best for clear instructions, format and tone. Cannot add knowledge the model lacks."],
    ["RAG / grounding", "Best when facts are current, private or must be cited. Costs: retrieval quality, curated content, extra components."],
    ["Tuning", "Best for consistent style, format or domain behaviour that prompts cannot deliver. Costs: examples, effort, re-doing when needs change. Weak for frequently changing facts."],
  ], note: "They combine. Start simple, then add what the dominant constraint (freshness, consistency, cost) demands." },
  { id: "c2", topic: "Offerings", title: "Who is it for? Workplace vs developer", rows: [
    ["Gemini Enterprise", "Workplace assistant and agents for employees over company data, with permissions respected."],
    ["Gemini in Workspace", "AI help inside familiar productivity apps."],
    ["Agent Platform", "Developers building, tuning, evaluating and deploying custom models and agents."],
  ], note: "Match the persona and customisation need first." },
  { id: "c3", topic: "Offerings", title: "Agent Studio vs Google AI Studio", rows: [
    ["Agent Studio", "Low-code agent design on the enterprise agent platform."],
    ["Google AI Studio", "Developer prototyping environment for Gemini models."],
  ], note: "Different tools for different audiences; do not treat them as one product. (Unverified: confirm in current docs.)" },
  { id: "c4", topic: "Offerings", title: "Agent Search vs building your own retrieval", rows: [
    ["Agent Search", "Faster route to grounded answers over your content; less to build and maintain."],
    ["Build your own", "More control over every step; more engineering and operations effort."],
  ], note: "Choose the least complexity that meets the control requirement." },
  { id: "c5", topic: "Offerings", title: "Purpose-built API vs generative model", rows: [
    ["Purpose-built API", "Narrow, stable task (transcription, translation, document parsing): predictable, often cheaper."],
    ["Generative model", "Open-ended, varied or conversational tasks: flexible, may cost more and vary more."],
  ], note: "Do not use a general model for a narrow solved task by default." },
  { id: "c6", topic: "Models", title: "Google model families", rows: [
    ["Gemini", "Multimodal family, with variants trading capability for speed/cost."],
    ["Imagen", "Image generation."], ["Veo", "Video generation."], ["Gemma", "Lightweight open models you run and adapt yourself."],
  ], note: "Model family is not the same as a product built on models." },
  { id: "c7", topic: "Models", title: "Open vs managed models", rows: [
    ["Open-weight", "Control, inspectability, hosting freedom. You carry operations, safety and updates."],
    ["Managed", "Faster start, less operations, provider controls. Less low-level control."],
  ], note: "Neither is always cheaper or better." },
  { id: "c8", topic: "Models", title: "Model choice factors", rows: [["Quality", "Match to task difficulty and stakes."], ["Latency and cost", "Dominate high-volume simple tasks."], ["Modality", "Gating requirement."], ["Residency/privacy", "Can be gating."]], note: "Test on your own examples; benchmarks only shortlist." },
  { id: "c9", topic: "Settings", title: "Generation settings", rows: [["Lower temperature", "More consistent, focused output."], ["Higher temperature", "More varied, creative output."], ["Max output tokens", "Caps length and cost."]], note: "Settings change variability, not knowledge." },
  { id: "c10", topic: "Risks", title: "Hallucination mitigations", rows: [["Grounding / RAG", "Supports answers with sources."], ["Prompt design", "Ask for sources, allow 'I don't know'."], ["Evaluation", "Measure on representative cases."], ["Human review", "Proportional to stakes."]], note: "Mitigations reduce risk; none guarantees correctness." },
  { id: "c11", topic: "Risks", title: "Prompt injection", rows: [["Risk", "Untrusted content tries to override instructions."], ["Defences", "Least privilege, treat outside content as untrusted, approval for sensitive actions, monitoring."]], note: "Part of SAIF-style thinking: secure the whole system." },
  { id: "c12", topic: "Governance", title: "Responsible AI checklist", rows: [["Fairness", "Test across groups."], ["Transparency", "Disclose AI use."], ["Accountability", "Named owner and escalation."], ["Privacy/safety", "Minimise data; test for harm."]], note: "Capability is not permission." },
  { id: "c13", topic: "Strategy", title: "Pilot selection", rows: [["Good", "Bounded, internal-first, reviewable, measurable."], ["Risky early", "Autonomous high-stakes decisions, unrestricted data access."]], note: "Measure against a baseline, not by usage." },
  { id: "c14", topic: "Data", title: "Before connecting data to AI", rows: [["Classify", "Know what is sensitive."], ["Permissions", "Fix access first; AI should honour them."], ["Quality", "Dedupe, version, date, curate."], ["Rights", "Confirm lawful use."]], note: "Data quality caps output quality." },
];
