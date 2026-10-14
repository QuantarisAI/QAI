import { chromium } from "playwright-core";
const BASE = "http://localhost:3100", S = "e2e/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const p = await (await b.newContext({ viewport: { width: 1100, height: 850 } })).newPage();
await p.goto(BASE + "/diagnostic");
await p.getByRole("button", { name: /Start diagnostic/ }).click();
await p.waitForURL(/session/);
// answer 20 questions, some right some wrong, mixed confidence
for (let i = 0; i < 20; i++) {
  await p.getByRole("radio").nth(i % 4).check();
  await p.getByRole("radio", { name: ["low", "medium", "high"][i % 3] }).check();
  await p.getByRole("button", { name: "Submit answer" }).click();
  if (i === 0) { await p.getByText("Decision principle:").waitFor(); await p.screenshot({ path: `${S}/1-feedback.png`, fullPage: true }); }
  if (i < 19) await p.getByRole("button", { name: /Next/ }).click();
}
await p.getByRole("button", { name: /Finish/ }).click();
await p.waitForURL(/results/);
await p.screenshot({ path: `${S}/2-results.png` });
await p.goto(BASE + "/");
await p.screenshot({ path: `${S}/3-dashboard.png`, fullPage: true });
await p.goto(BASE + "/notebook"); await p.screenshot({ path: `${S}/4-notebook.png` });
await p.goto(BASE + "/learn"); await p.screenshot({ path: `${S}/5-learn.png` });
await p.goto(BASE + "/exam"); await p.getByRole("button", { name: /Start mock/ }).first().click();
await p.waitForURL(/exam\/run/);
for (let i = 0; i < 6; i++) { await p.getByRole("radio").nth(i % 4).check(); await p.getByRole("button", { name: /Next/ }).click(); }
await p.getByRole("button", { name: /Flag for review/ }).click();
await p.screenshot({ path: `${S}/6-exam.png`, fullPage: true });
await b.close();
