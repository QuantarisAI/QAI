import type { Domain } from "@/lib/types";

/**
 * APP-DEFINED coverage checklist. The official exam guide PDF could not be fetched
 * (network policy), so these IDs are NOT official objective identifiers. The domain
 * names and the topic areas come from the public certification page and the brief.
 * Replace with official IDs once the guide has been read.
 */
export interface Objective {
  id: string;
  domain: Domain;
  title: string;
  summary: string;
}
export const OBJECTIVES: Objective[] = [
  { id: "F1", domain: "Fundamentals", title: "AI landscape: AI, ML, deep learning, generative AI", summary: "How the terms relate; predictive vs generative; what gen AI is good for." },
  { id: "F2", domain: "Fundamentals", title: "Foundation models, LLMs and multimodality", summary: "What foundation models are, tokens and context windows, multimodal inputs and outputs." },
  { id: "F3", domain: "Fundamentals", title: "Data concepts and data quality", summary: "Structured vs unstructured, labeled vs unlabeled, quality, relevance, access and governance." },
  { id: "F4", domain: "Fundamentals", title: "Model limitations and risks", summary: "Hallucination, bias, knowledge cutoff, non-determinism, data dependency." },
  { id: "F5", domain: "Fundamentals", title: "Model selection factors", summary: "Modality, quality, latency, cost, size, openness, fit for task." },
  { id: "F6", domain: "Fundamentals", title: "Google model families", summary: "Gemini, Imagen, Veo, Gemma and what each is for." },
  { id: "F7", domain: "Fundamentals", title: "The gen AI stack and value chain", summary: "Infrastructure, models, platform, agents, applications; who builds and who consumes." },
  { id: "G1", domain: "Google Cloud Offerings", title: "Gemini Enterprise workplace experiences", summary: "Employee-facing assistants and agents over company data." },
  { id: "G2", domain: "Google Cloud Offerings", title: "Gemini in Google Workspace and productivity", summary: "AI assistance inside everyday collaboration apps." },
  { id: "G3", domain: "Google Cloud Offerings", title: "Gemini Enterprise Agent Platform and Model Garden", summary: "The developer platform and its model catalog." },
  { id: "G4", domain: "Google Cloud Offerings", title: "Agent Studio and low-code agent design", summary: "Designing agents with little or no code." },
  { id: "G5", domain: "Google Cloud Offerings", title: "Agent Search and enterprise search", summary: "Grounded search and answers over enterprise content." },
  { id: "G6", domain: "Google Cloud Offerings", title: "Customer engagement solutions", summary: "Conversational agents and contact-center experiences." },
  { id: "G7", domain: "Google Cloud Offerings", title: "Purpose-built APIs", summary: "Speech, vision, language, document and translation services." },
  { id: "G8", domain: "Google Cloud Offerings", title: "Agents and agent tools", summary: "What agents do, tools, orchestration, multi-step tasks." },
  { id: "G9", domain: "Google Cloud Offerings", title: "Choosing the right offering", summary: "Mapping persona, need, customization and speed to an offering." },
  { id: "O1", domain: "Output Improvement", title: "Prompt design", summary: "Clear instructions, context, examples, format, iteration." },
  { id: "O2", domain: "Output Improvement", title: "Grounding", summary: "Anchoring answers to trusted sources; limits of grounding." },
  { id: "O3", domain: "Output Improvement", title: "Retrieval-augmented generation (RAG)", summary: "Retrieve relevant content at request time, then generate." },
  { id: "O4", domain: "Output Improvement", title: "Tuning and customization", summary: "When adapting model behavior beats prompting or RAG, and its costs." },
  { id: "O5", domain: "Output Improvement", title: "Generation settings", summary: "Temperature, top-p/top-k, max output length." },
  { id: "O6", domain: "Output Improvement", title: "Evaluating output", summary: "Metrics, human review, test sets, comparing options." },
  { id: "O7", domain: "Output Improvement", title: "Choosing among prompting, RAG and tuning", summary: "Trade-offs among freshness, cost, consistency and effort." },
  { id: "B1", domain: "Business Strategy & Security", title: "Adoption strategy and value", summary: "Use-case selection, ROI, pilots, change management, stakeholders." },
  { id: "B2", domain: "Business Strategy & Security", title: "Responsible AI", summary: "Fairness, transparency, accountability, safety." },
  { id: "B3", domain: "Business Strategy & Security", title: "Data privacy and security", summary: "Sensitive data, access control, compliance, data residency." },
  { id: "B4", domain: "Business Strategy & Security", title: "Secure AI Framework (SAIF) and AI risks", summary: "Securing AI systems, prompt injection, data poisoning, governance." },
  { id: "B5", domain: "Business Strategy & Security", title: "Human oversight and accountability", summary: "Human-in-the-loop design and ownership of decisions." },
];
export const objectiveById = (id: string) => OBJECTIVES.find((o) => o.id === id);
