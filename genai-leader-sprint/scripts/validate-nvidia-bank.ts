import { NV_BANK, validateBank } from "../src/nvidia/bank";
import { TOPICS } from "../src/nvidia/topics";
import { LEVELS } from "../src/nvidia/types";

const r = validateBank(NV_BANK);
const errors = r.problems.filter((p) => p.kind === "error");
const warns = r.problems.filter((p) => p.kind !== "error");
for (const w of warns) console.warn(`warn  ${w.id}: ${w.msg}`);
for (const e of errors) console.error(`ERROR ${e.id}: ${e.msg}`);
const perTopic = TOPICS.map((t) => `${t.id}:${LEVELS.map((l) => NV_BANK.filter((q) => q.topic === t.id && q.level === l).length).join("/")}`).join("  ");
console.log(`NVIDIA bank: ${NV_BANK.length} questions, ${TOPICS.length} topics. Per topic (B/E/M/H/L): ${perTopic}`);
console.log(`longest-option-is-correct: ${r.stats.longestIsCorrectPct}% (chance is 25%; keep it under 40%)`);
console.log(`correct position A/B/C/D: ${r.stats.posA}/${r.stats.posB}/${r.stats.posC}/${r.stats.posD}`);
if (r.stats.longestIsCorrectPct > 40) { console.error("ERROR: the longest option is correct too often; students can guess by length."); process.exit(1); }
if (errors.length) process.exit(1);
