import type { DomainId } from "./types";

export interface TopicDef {
  id: string;
  domain: DomainId;
  title: string;
  /** What the topic covers, in this app's words. */
  covers: string;
  /** Which official sub-topic(s) it serves (paraphrased). */
  serves: string;
  /** Real-world LLM/AI building blocks where this shows up. */
  inPractice: string;
}

/** 20 topics, each with 5 levels (Beginner to Legendary). IDs are this app's own, not NVIDIA identifiers. */
export const TOPICS: TopicDef[] = [
  {
    id: "C1", domain: "core", title: "Machine learning fundamentals",
    covers: "Supervised vs unsupervised learning, features, train/validation/test splits, overfitting, cross-validation, model comparison.",
    serves: "ML fundamentals: feature engineering, comparing models, cross-validation; traditional ML packages.",
    inPractice: "Every fine-tuning run needs a clean validation split; cross-validation logic shows up in evaluation harnesses.",
  },
  {
    id: "C2", domain: "core", title: "Neural networks and deep learning basics",
    covers: "Neurons, activations, loss, backpropagation, gradient descent, optimizers, regularization.",
    serves: "Foundation for training and optimizing LLMs.",
    inPractice: "The training loop of any LLM is forward pass, loss, backward pass, optimizer step, repeated billions of times.",
  },
  {
    id: "C3", domain: "core", title: "Transformers and LLM architecture",
    covers: "Self-attention, multi-head attention, positional information, encoder/decoder/decoder-only, context window, autoregressive generation.",
    serves: "Understanding LLMs; reading research papers; model selection.",
    inPractice: "Context length limits, KV cache memory and generation speed all follow from the attention mechanism.",
  },
  {
    id: "C4", domain: "core", title: "Tokenization and text embeddings",
    covers: "Subword tokenization (BPE, WordPiece), vocabulary, embedding vectors, cosine similarity, choosing an embedding model.",
    serves: "Selecting and using models to create text embeddings; curating and embedding datasets.",
    inPractice: "Token counts drive cost and latency; embeddings power semantic search and RAG retrieval.",
  },
  {
    id: "C5", domain: "core", title: "Prompt engineering and generation settings",
    covers: "Zero/few-shot, chain-of-thought, system vs user prompts, structured output, temperature, top-p, max tokens, prompt injection basics.",
    serves: "Applying prompt engineering principles.",
    inPractice: "Prompt templates and sampling settings are the first knobs you turn before any fine-tuning.",
  },
  {
    id: "C6", domain: "core", title: "RAG, chatbots and vector databases",
    covers: "Chunking, embedding, retrieval, reranking, grounding, vector index types, summarizers and chatbots, evaluating retrieval.",
    serves: "Building LLM use cases (RAG, chatbots, summarizers); vector databases; curating content for RAG.",
    inPractice: "Most enterprise LLM apps are RAG pipelines: chunk, embed, store, retrieve, generate.",
  },
  {
    id: "D1", domain: "data", title: "Exploring data and descriptive statistics",
    covers: "Mean, median, variance, outliers, distributions, correlation vs causation, missing data, data leakage awareness.",
    serves: "Extracting insights from large datasets; identifying relationships, trends and confounders.",
    inPractice: "Dataset audits before pretraining or fine-tuning: length distributions, duplicates, label balance.",
  },
  {
    id: "D2", domain: "data", title: "Metrics for comparing models",
    covers: "Loss functions, accuracy, precision, recall, F1, R-squared, perplexity, confusion matrix, choosing a metric.",
    serves: "Comparing models with statistical metrics (loss, proportion of explained variance).",
    inPractice: "Choosing between two fine-tuned checkpoints; reading training and validation loss curves.",
  },
  {
    id: "D3", domain: "data", title: "Visualization and communicating results",
    covers: "Choosing chart types, learning curves, distributions, honest axes, communicating uncertainty and trends.",
    serves: "Creating graphs and charts to communicate results.",
    inPractice: "Loss curves, latency histograms and evaluation dashboards in experiment tracking tools.",
  },
  {
    id: "E1", domain: "exp", title: "Training and optimization",
    covers: "Learning rate, batch size, epochs, early stopping, mixed precision, data/model parallelism, scaling and GPU memory.",
    serves: "Assisting with model training and training optimization.",
    inPractice: "Making a run fit in GPU memory and finish in time without diverging.",
  },
  {
    id: "E2", domain: "exp", title: "Preparing data for pretraining, fine-tuning and RLHF",
    covers: "Collection and scraping, cleaning, deduplication, quality filtering, tokenization, instruction/preference data formats, decontamination.",
    serves: "Preparing large datasets for pretraining, fine-tuning and RLHF.",
    inPractice: "Data curation pipelines (exact, fuzzy and semantic deduplication) decide model quality more than most hyperparameters.",
  },
  {
    id: "E3", domain: "exp", title: "Fine-tuning and alignment",
    covers: "Pretraining vs fine-tuning, supervised fine-tuning, parameter-efficient methods (LoRA), RLHF and human-feedback collection, catastrophic forgetting.",
    serves: "Model training; collecting human-subject data for RLHF; refining models.",
    inPractice: "Choosing between prompting, RAG and fine-tuning for a business need.",
  },
  {
    id: "E4", domain: "exp", title: "Evaluation, benchmarking and experiment design",
    covers: "Benchmarks, held-out data, A/B tests, ablations, baselines, reproducibility, contamination, cost/portability/compatibility comparisons.",
    serves: "Evaluating and refining models; running experiments; hardware/software tests; evaluating technologies.",
    inPractice: "Deciding whether a new checkpoint or retrieval setup is actually better, and proving it.",
  },
  {
    id: "S1", domain: "sw", title: "Python for ML and NLP",
    covers: "NumPy, pandas, scikit-learn, Hugging Face libraries, tokenizer and model loading patterns, vectorization, batching, data pipelines.",
    serves: "Writing software components or scripts; Python NLP packages; traditional ML packages.",
    inPractice: "Data loaders, tokenization loops and batch inference scripts.",
  },
  {
    id: "S2", domain: "sw", title: "Building LLM applications",
    covers: "Orchestration frameworks, chains and agents, API calls, prompt templates, memory, tool calling, error handling, streaming.",
    serves: "Building LLM use cases such as RAG, chatbots and summarizers.",
    inPractice: "A chatbot is a loop: retrieve context, build the prompt, call the model, post-process, log.",
  },
  {
    id: "S3", domain: "sw", title: "The NVIDIA generative AI stack",
    covers: "GPUs and CUDA basics, NeMo (framework, Curator, Guardrails), NIM, Triton Inference Server, TensorRT-LLM, RAPIDS, NGC.",
    serves: "Identifying system components; deployment; using NVIDIA technologies.",
    inPractice: "Knowing which NVIDIA tool curates data, trains, optimizes, serves and guards a model.",
  },
  {
    id: "S4", domain: "sw", title: "Deployment, scalability and monitoring",
    covers: "Latency vs throughput, batching, quantization, KV cache, autoscaling, cost, logging, drift and quality monitoring, reliability.",
    serves: "Deployment and evaluation of scalability, performance and reliability; monitoring processes.",
    inPractice: "Serving an LLM so that p95 latency and cost per request stay within target.",
  },
  {
    id: "T1", domain: "trust", title: "Ethical principles and bias",
    covers: "Fairness, bias sources (data, labels, sampling, feedback loops), mitigation, transparency, accountability, documentation such as model cards.",
    serves: "Ethical principles of trustworthy AI; minimizing bias.",
    inPractice: "Bias audits on training data and evaluation across subgroups before release.",
  },
  {
    id: "T2", domain: "trust", title: "Privacy, consent and data governance",
    covers: "Personal data, consent and purpose limitation, anonymization limits, PII handling, federated learning, confidential computing, licensing.",
    serves: "Balancing data privacy and data consent.",
    inPractice: "Deciding what can enter a training set or a RAG index, and scrubbing PII from logs.",
  },
  {
    id: "T3", domain: "trust", title: "Guardrails, safety and hallucination control",
    covers: "Input/dialog/retrieval/execution/output rails, red-teaming, grounding and citations, toxicity and jailbreak defence, human oversight.",
    serves: "Using NVIDIA and other technologies to improve AI trustworthiness.",
    inPractice: "NeMo Guardrails wrapped around an LLM app so unsafe or off-topic traffic never reaches users.",
  },
];
export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t])) as Record<string, TopicDef>;
export const topicsOf = (d: DomainId) => TOPICS.filter((t) => t.domain === d);

/** Sources this module actually read (and when). Items cite these keys only if the claim is supported. */
export interface SourceDef { id: string; title: string; url: string; read: boolean; readOn?: string; note: string }
export const NV_SOURCES: SourceDef[] = [
  { id: "exam", title: "NVIDIA NCA-GENL exam page", url: "https://www.nvidia.com/en-us/learn/certification/generative-ai-llm-associate/", read: true, readOn: "2026-10-16", note: "Exam format, five topic areas, weights, sub-topic bullets." },
  { id: "rails", title: "NeMo Guardrails: rail types", url: "https://docs.nvidia.com/nemo/guardrails/latest/about/rail-types.html", read: true, readOn: "2026-10-16", note: "Input, retrieval, dialog, execution and output rails." },
  { id: "triton", title: "Triton: dynamic batching and concurrent model execution", url: "https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/tutorials/Conceptual_Guide/Part_2-improving_resource_utilization/README.html", read: true, readOn: "2026-10-16", note: "Dynamic batching, queue delay, instance groups, latency/throughput trade-off." },
  { id: "trtllm", title: "TensorRT-LLM overview", url: "https://nvidia.github.io/TensorRT-LLM/1.0.0/overview.html", read: true, readOn: "2026-10-16", note: "In-flight batching, paged KV cache, FP8/FP4, speculative decoding, parallelism." },
  { id: "curator", title: "NeMo Curator: text data curation pipeline", url: "https://docs.nvidia.com/nemo/curator/v26.04/about/concepts/text/data/data-curation-pipeline", read: true, readOn: "2026-10-16", note: "Filtering and exact/fuzzy/semantic deduplication; RAPIDS acceleration." },
  { id: "trust", title: "What is Trustworthy AI? (NVIDIA)", url: "https://blogs.nvidia.com/blog/what-is-trustworthy-ai/", read: true, readOn: "2026-10-16", note: "Privacy, safety and security, transparency, nondiscrimination; Model Cards++, FLARE." },
  { id: "nim", title: "NVIDIA NIM overview (developer blog)", url: "https://developer.nvidia.com/blog/?p=86238", read: true, readOn: "2026-10-16", note: "NIM containers, standard APIs, TensorRT-LLM engines, Kubernetes autoscaling." },
];
export const SOURCE_BY_ID = Object.fromEntries(NV_SOURCES.map((s) => [s.id, s]));
