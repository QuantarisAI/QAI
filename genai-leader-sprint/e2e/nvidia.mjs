// NVIDIA module + lockdown browser check. Usage: BASE=http://localhost:3199 node e2e/nvidia.mjs  (serve the `out/` folder first)
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3199";
let failed = 0;
const check = (name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });
const locked = async (p = page) => (await p.getByText("This site is switched off").count()) > 0;

// ---------- hub + dashboard ----------
await page.goto(BASE + "/certifications/");
check("hub lists both certifications", (await page.getByRole("link", { name: "Open NVIDIA prep" }).count()) === 1 && (await page.getByRole("link", { name: "Open Google prep" }).count()) === 1);
await page.goto(BASE + "/certifications/nvidia/");
await page.getByText(/to the exam|Exam day|Exam date passed/).first().waitFor();
check("NVIDIA dashboard renders, not locked", !(await locked()));
check("unofficial disclaimer visible", (await page.getByText("Not affiliated with, endorsed by or sponsored by NVIDIA").count()) > 0);
check("NVIDIA theme applied (green primary)", await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--primary").trim() === "#76b900"));
check("CSP meta present with no unsafe-inline for scripts", await page.evaluate(() => {
  const c = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "";
  const s = c.split(";").find((x) => x.trim().startsWith("script-src")) ?? "";
  return c.length > 0 && !s.includes("'unsafe-inline'") && !s.includes("'unsafe-eval'");
}));

// ---------- practice a ladder level ----------
await page.goto(BASE + "/certifications/nvidia/topics/");
await page.getByRole("button", { name: /^C1 .*Beginner/ }).first().click();
await page.waitForURL(/nvidia\/session\/?\?id=/);
await page.getByText("Question 1 of 3").waitFor();
const labels = await page.getByRole("radio").evaluateAll((els) => els.map((e) => e.closest("label")?.textContent ?? ""));
check("four options shown", labels.filter((t) => /^[A-D]\./.test(t.trim())).length === 4);
for (let i = 0; i < 3; i++) {
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByText(/Correct\.|Not this time\./).waitFor();
  if (i === 0) check("feedback explains every option", (await page.locator(".why").count()) === 4);
  await page.getByRole("button", { name: /Next question|Finish and see results/ }).click();
}
await page.waitForURL(/nvidia\/results/);
await page.getByText(/of 3 correct/).waitFor();
await page.getByRole("heading", { name: /results/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
const resOk = (await page.getByRole("heading", { name: /results/ }).count()) > 0;
check("results page after a ladder level", resOk, resOk ? "" : (await page.locator("main").innerText()).slice(0, 400));

// ---------- timed mock: answers persist, clock cannot be reset by reload ----------
await page.goto(BASE + "/certifications/nvidia/mocks/");
await page.getByRole("button", { name: "Start" }).first().click();
await page.waitForURL(/nvidia\/exam\/?\?id=/);
await page.getByRole("timer").waitFor();
const t0 = await page.getByRole("timer").textContent();
check("mock starts near 60:00", /^(60:00|59:5\d)$/.test(t0 ?? ""), t0 ?? "");
check("mock shows no correctness before submit", (await page.getByText("Correct answer").count()) === 0);
for (let i = 0; i < 4; i++) {
  await page.getByRole("radio").nth(i % 4).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
}
await page.waitForTimeout(1500);
await page.reload();
await page.getByRole("timer").waitFor();
const t1 = await page.getByRole("timer").textContent();
check("clock continues after reload (not reset)", t1 !== "60:00" && /^59:/.test(t1 ?? ""), t1 ?? "");
check("answers persist after reload", (await page.getByText("4/60 answered").count()) === 1);
const examUrl = page.url();
// simulate: tab closed, deadline passes while away
await page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("nca-genl-prep");
  r.onsuccess = () => {
    const db = r.result; const tx = db.transaction("sessions", "readwrite"); const st = tx.objectStore("sessions");
    st.getAll().onsuccess = (e) => { for (const s of e.target.result) if (s.status === "active" && s.kind === "mock") { s.deadline = Date.now() - 5000; st.put(s); } };
    tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error);
  };
}));
await page.reload();
await page.waitForURL(/nvidia\/results/, { timeout: 15000 });
check("expired mock is graded automatically", (await page.getByText(/Time ran out/).count()) > 0);
check("unanswered counted as wrong (4 answered of 60)", (await page.getByText(/56 unanswered/).count()) > 0);
check("domain table uses official weights", (await page.getByText("Core ML & AI (30%)").count()) > 0);
void examUrl;

// ---------- other pages ----------
for (const [path, h] of [["/certifications/nvidia/roadmap/", "40-day roadmap"], ["/certifications/nvidia/syllabus/", "Syllabus and sources"], ["/certifications/nvidia/notebook/", "Notebook"], ["/certifications/nvidia/settings/", "Settings"]]) {
  await page.goto(BASE + path);
  await page.getByRole("heading", { name: h, exact: true }).waitFor();
  check(`${path} renders`, !(await locked()));
}
await page.goto(BASE + "/certifications/nvidia/roadmap/");
await page.getByRole("heading", { name: "40-day roadmap" }).waitFor();
check("roadmap has 40 days", (await page.locator("tbody tr td:first-child").filter({ hasText: /^\d+/ }).count()) === 40);

// ---------- router: hub, clean routes, and old links redirect (query and hash kept) ----------
await page.goto(BASE + "/");
await page.getByRole("heading", { name: "Certification practice" }).waitFor();
check("site root is the certification hub", true);
for (const [old, want] of [
  ["/nvidia/topics/#t-C3", /certifications\/nvidia\/topics\/?#t-C3$/],
  ["/nvidia/", /certifications\/nvidia\/?$/],
  ["/exam/", /certifications\/google\/exam\/?$/],
  ["/session/?id=abc", /certifications\/google\/session\/?\?id=abc$/],
  ["/exam/run/?id=xyz", /certifications\/google\/exam\/run\/?\?id=xyz$/],
]) {
  await page.goto(BASE + old);
  await page.waitForURL(want, { timeout: 8000 }).then(() => check(`old link ${old} redirects`, true), () => check(`old link ${old} redirects (got ${page.url()})`, false));
}
// ---------- the original Google app still works ----------
await page.goto(BASE + "/certifications/google/");
await page.getByRole("heading", { name: "GenAI Leader Sprint" }).waitFor();
check("original Google app unchanged and not locked", !(await locked()));

// ---------- normal use produced no CSP or script errors ----------
const bad = problems.filter((p) => /Content Security Policy|CSP|pageerror/i.test(p));
check("no CSP violations or page errors during normal use", bad.length === 0, bad.slice(0, 3).join(" | "));

// ---------- lockdown ----------
const p2 = await ctx.newPage();
await p2.goto(BASE + "/certifications/nvidia/");
await p2.getByText(/to the exam|Exam day|Exam date passed/).first().waitFor();
await p2.evaluate(() => { const s = document.createElement("script"); s.src = "https://evil.example/steal.js"; document.body.appendChild(s); });
await p2.getByText("This site is switched off").waitFor({ timeout: 8000 });
check("injected foreign script locks the site", true);
check("lock screen says progress is untouched", (await p2.getByText("Your study progress is untouched").count()) > 0);
check("lock persists on reload within the tab", await (async () => { await p2.reload(); await p2.getByText("This site is switched off").waitFor({ timeout: 8000 }); return true; })());
await p2.getByRole("button", { name: "Check again" }).click();
await p2.getByText(/to the exam|Exam day|Exam date passed/).first().waitFor({ timeout: 10000 });
check("owner-clean status lets the site recover", !(await locked(p2)));
await p2.close();

const p3 = await ctx.newPage();
await p3.route("**/status.json*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "locked", reason: "test" }) }));
await p3.goto(BASE + "/certifications/nvidia/");
await p3.getByText("This site is switched off").waitFor({ timeout: 8000 });
check("remote kill switch locks the whole NVIDIA app", true);
await p3.goto(BASE + "/certifications/google/");
await p3.getByText("This site is switched off").waitFor({ timeout: 8000 });
check("kill switch also locks the Google app", true);
await p3.close();

const p4 = await ctx.newPage();
await p4.goto(BASE + "/certifications/nvidia/");
await p4.getByText(/to the exam|Exam day|Exam date passed/).first().waitFor();
await p4.evaluate(() => { const f = document.createElement("iframe"); f.src = "https://evil.example/"; document.body.appendChild(f); });
await p4.getByText("This site is switched off").waitFor({ timeout: 8000 });
check("injected foreign iframe locks the site", true);
await p4.close();

const p5 = await ctx.newPage();
await p5.setContent(`<iframe id=f src="${BASE}/certifications/nvidia/" width=900 height=600></iframe>`);
const fr = p5.frameLocator("#f");
await fr.getByText("This site is switched off").waitFor({ timeout: 8000 });
check("site refuses to run inside another site's frame (clickjacking)", true);
await p5.close();

// bundle integrity: serve a manifest whose hash for a loaded script is wrong -> the page must lock after its (deferred) check
const p7 = await ctx.newPage();
await p7.route("**/integrity.json*", async (route) => {
  const r = await route.fetch();
  const m = await r.json();
  for (const k of Object.keys(m.files)) if (k.endsWith(".js")) m.files[k] = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(m) });
});
await p7.goto(BASE + "/certifications/nvidia/");
await p7.getByText("This site is switched off").waitFor({ timeout: 15000 });
check("a script that does not match integrity.json locks the site", (await p7.getByText("does not match what was published").count()) > 0);
await p7.close();

const p6 = await ctx.newPage();
await p6.goto(BASE + "/certifications/nvidia/");
await p6.getByText(/to the exam|Exam day|Exam date passed/).first().waitFor();
await p6.evaluate(() => { const d = document.createElement("div"); d.id = "ext"; d.textContent = "extension ui"; const i = document.createElement("img"); i.src = "data:image/png;base64,iVBORw0KGgo="; d.appendChild(i); document.body.appendChild(d); });
await p6.waitForTimeout(800);
check("harmless DOM changes (like extension UI) do not lock the site", !(await locked(p6)));
await p6.close();

await browser.close();
console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
