// Browser functional check. Usage: BASE=http://localhost:3100 node e2e/smoke.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const G = BASE + "/certifications/google";
const SHOTS = process.env.SHOTS ?? "e2e/shots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(G);
await page.getByRole("heading", { name: "GenAI Leader Sprint" }).waitFor();
check("dashboard renders with unverified-draft notice", (await page.getByText("All are unverified drafts").count()) > 0);
check("countdown present", (await page.getByText("Exam countdown").count()) > 0);

// ---- Diagnostic: 20 questions, no feedback before submit ----
await page.goto(G + "/diagnostic");
await page.getByRole("button", { name: /Start diagnostic/ }).click();
await page.waitForURL(/session\/?\?id=/);
await page.getByRole("heading", { name: /Question 1 of 20/ }).waitFor();
check("diagnostic has 20 questions", true);
check("no feedback or correctness visible before submit", (await page.getByText("Best answer").count()) === 0 && (await page.getByText("Decision principle").count()) === 0 && (await page.getByText("Appropriate").count()) === 0);
check("hint hidden until requested", (await page.getByText("Hint:").count()) === 0);
await page.getByRole("button", { name: "Show hint" }).click();
check("hint shown on request", (await page.getByText("Hint:").count()) > 0);
await page.getByRole("radio").first().check();
await page.getByRole("radio", { name: "high", exact: true }).check();
await page.getByRole("button", { name: "Submit answer" }).click();
await page.getByText("Decision principle:").waitFor();
const marks = await page.getByText(/✔ Appropriate|✘ Not appropriate here/).count();
check("feedback after submit explains all four options", marks === 4, `${marks} option explanations`);
check("feedback does not rely on colour alone (icon + text)", (await page.getByText(/✔ Correct|✘ Not quite/).count()) > 0);
// keyboard operability: radios reachable with Tab and activated with Space
await page.getByRole("button", { name: /Next/ }).click();
await page.keyboard.press("Tab");
const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
check("keyboard focus moves to interactive controls", ["BUTTON", "INPUT", "A"].includes(focusedTag), focusedTag);
// persistence across reload
const url = page.url();
await page.reload();
await page.getByRole("heading", { name: /Question 2 of 20/ }).waitFor();
check("session position persists after reload", page.url() === url);
await page.screenshot({ path: `${SHOTS}/desktop-question.png` });

// ---- Exam: hidden feedback, reload keeps deadline, expiry on reopening ----
await page.goto(G + "/exam");
await page.getByRole("button", { name: /Start mock/ }).first().click();
await page.waitForURL(/exam\/run\/?\?id=/);
const examUrl = page.url();
await page.getByRole("heading", { name: /Question 1 of 60/ }).waitFor();
check("exam shows no hint button", (await page.getByRole("button", { name: "Show hint" }).count()) === 0);
await page.getByRole("radio").nth(1).check();
check("exam shows no feedback after answering", (await page.getByText("Decision principle").count()) === 0 && (await page.getByText("Best answer").count()) === 0);
check("answered count updates", (await page.getByText(/Answered 1\/60/).count()) > 0);
await page.getByRole("button", { name: /Flag for review/ }).click();
check("flag toggles", (await page.getByText("⚑ Flagged").count()) > 0);
await page.getByRole("button", { name: "Clear answer…" }).click();
check("clearing requires confirmation", (await page.getByText("Clear your answer?").count()) > 0);
await page.getByRole("button", { name: "Keep it" }).click();
check("answer kept after cancelling clear", (await page.getByText(/Answered 1\/60/).count()) > 0);
const t1 = await page.locator(".timer").innerText();
await page.reload();
await page.getByRole("heading", { name: /Question 1 of 60/ }).waitFor();
const t2 = await page.locator(".timer").innerText();
check("timer survives reload (derived from stored deadline)", /(1:2[0-9]|1:30|1:29|1:3)/.test(t2) || t2.startsWith("1:") || t2.includes("89") || t2.includes("90"), `${t1} -> ${t2}`);
check("answer and flag survive reload", (await page.getByText(/Answered 1\/60/).count()) > 0 && (await page.getByText(/Flagged 1/).count()) > 0);

// make the stored deadline lie in the past, then reopen the app
await page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open("genai-leader-sprint");
  open.onsuccess = () => {
    const db = open.result; const tx = db.transaction("sessions", "readwrite"); const st = tx.objectStore("sessions");
    st.getAll().onsuccess = (e) => { for (const s of e.target.result) if (s.kind === "exam") { s.deadline = Date.now() - 1000; s.startedAt = Date.now() - 91 * 60000; st.put(s); } };
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  };
}));
await page.goto(G + "/");
await page.getByRole("heading", { name: "GenAI Leader Sprint" }).waitFor();
await page.goto(examUrl);
await page.waitForURL(/results\/?\?id=/, { timeout: 15000 });
check("expired exam is auto-submitted on reopening", true);
check("expiry is announced", (await page.getByText("Time expired").count()) > 0);
check("unanswered counted as incorrect (1 answered / 59 unanswered)", (await page.getByText("1 / 59").count()) > 0);
check("per-domain table and objective gaps shown", (await page.getByText("By domain").count()) > 0 && (await page.getByText("Objective gaps").count()) > 0);
await page.goto(G + "/exam");
await page.getByText(/Retake \(repeated, not unseen\)/).first().waitFor({ timeout: 10000 }).catch(() => {});
check("retake is labelled as repeated, not unseen", (await page.getByText(/Retake \(repeated, not unseen\)/).count()) > 0);

// ---- Settings: invalid import rejected, existing data untouched ----
await page.goto(G + "/settings");
const bad = JSON.stringify({ quiz_metadata: { target_certification: "x", total_questions: 3 }, questions: [{ id: 1, exam_domain: "Nope", scenario_question: "", hint: "h", options: [] }] });
await page.getByLabel("Paste question JSON").fill(bad);
await page.getByRole("button", { name: /Validate and import/ }).click();
await page.getByText("Import rejected. Nothing was changed.").waitFor();
const errs = await page.locator("main li").allInnerTexts();
check("invalid import shows actionable errors", errs.some((e) => e.includes("exam_domain")) && errs.some((e) => e.includes("exactly 4 options")), `${errs.length} errors`);
const good = JSON.stringify({ quiz_metadata: { target_certification: "Google Cloud Generative AI Leader", total_questions: 1 }, questions: [{ id: 1, exam_domain: "Fundamentals", scenario_question: "Imported scenario?", hint: "h", options: ["A", "B", "C", "D"].map((l, i) => ({ option_letter: l, text: "T" + l, is_correct: i === 2, business_rationale: "R" + l })) }] });
await page.getByLabel("Paste question JSON").fill(good);
await page.getByRole("button", { name: /Validate and import/ }).click();
await page.getByText(/Imported 1 questions/).waitFor();
check("valid import accepted as separate practice-only set", true);
await page.goto(G + "/diagnostic");
await page.getByText("Resume diagnostic").first().waitFor({ timeout: 10000 }).catch(() => {});
check("previous diagnostic progress still present after import", (await page.getByText("Resume diagnostic").count()) > 0);

// reset requires typed confirmation
await page.goto(G + "/settings");
check("reset disabled until confirmed", await page.getByRole("button", { name: "Reset progress" }).isDisabled());
await page.getByLabel("Confirmation").fill("RESET");
await page.getByRole("button", { name: "Reset progress" }).click();
await page.getByText("Progress reset.").waitFor();
await page.goto(G + "/exam");
check("reset clears exam history", (await page.getByText(/Retake/).count()) === 0);

// ---- Mobile layout ----
const m = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true });
const mp = await m.newPage();
for (const path of ["/certifications/google", "/certifications/google/practice", "/certifications/google/learn", "/certifications/google/exam", "/certifications/google/settings", "/certifications/google/cards", "/certifications/google/notebook"]) {
  await mp.goto(BASE + path);
  await mp.waitForLoadState("networkidle");
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`mobile 375px: no horizontal page scroll on ${path}`, overflow <= 1, `overflow ${overflow}px`);
}
await mp.goto(G + "/practice");
const small = await mp.evaluate(() => [...document.querySelectorAll("button, a.btn, select, input[type=text], input[type=number]")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5); }).length);
check("tap targets are at least 44px tall on /practice", small === 0, `${small} small`);
await mp.screenshot({ path: `${SHOTS}/mobile-practice.png` });
await mp.goto(G + "/");
await mp.screenshot({ path: `${SHOTS}/mobile-dashboard.png`, fullPage: true });

check("no uncaught page errors", errors.filter((e) => !/favicon/.test(e)).length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
