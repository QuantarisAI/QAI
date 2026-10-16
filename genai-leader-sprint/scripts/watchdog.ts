/**
 * Watchdog: checks the LIVE site against what was built, from outside the browser.
 *
 *   SITE_URL=https://owner.github.io/repo npx tsx scripts/watchdog.ts
 *
 * Prints findings. In GitHub Actions it also writes `lock=true|false` and `report` to $GITHUB_OUTPUT so the next
 * step can run the lockdown workflow. What it can catch: a deployed file that no longer matches integrity.json,
 * a script from another host, an inline script the CSP does not allow, a weakened or missing CSP, an injected
 * iframe / base / meta refresh. What it cannot catch: an attacker who rewrites integrity.json AND the files AND
 * the CSP together (that needs the repository or the Pages deployment to be compromised: protect those with
 * branch protection, 2FA and restricted Actions permissions), or traffic floods (GitHub's CDN absorbs those).
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

export interface Finding { severity: "lock" | "warn" | "info"; msg: string }
export interface Resp { status: number; body: Uint8Array }
export type Fetcher = (url: string) => Promise<Resp>;

const sha = (b: Uint8Array) => "sha256-" + createHash("sha256").update(b).digest("base64");
const text = (b: Uint8Array) => new TextDecoder().decode(b);

export function cspScriptSrc(html: string): string[] | null {
  // The CSP value itself contains single quotes ('self'), so match the attribute with its own quote character.
  const m = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*content=(?:"([^"]*)"|'([^']*)')/i);
  if (!m) return null;
  const dir = (m[1] ?? m[2]).split(";").map((x) => x.trim()).find((x) => x.startsWith("script-src"));
  return dir ? dir.split(/\s+/).slice(1) : [];
}

export function checkHtml(html: string, page: string, host: string): Finding[] {
  const out: Finding[] = [];
  const src = cspScriptSrc(html);
  if (src === null) out.push({ severity: "warn", msg: `${page}: no Content-Security-Policy meta tag (was the hardening step skipped?)` });
  else {
    if (src.some((s) => s === "'unsafe-inline'" || s === "'unsafe-eval'" || s === "*" || /^https?:/.test(s))) out.push({ severity: "lock", msg: `${page}: CSP script-src was weakened: ${src.join(" ")}` });
    for (const m of html.matchAll(/<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/type\s*=\s*["']?application\/(ld\+)?json/i.test(m[1]) || m[2].trim() === "") continue;
      const h = `'${sha(Buffer.from(m[2], "utf8"))}'`;
      if (!src.includes(h)) out.push({ severity: "lock", msg: `${page}: inline script not covered by the CSP (${m[2].slice(0, 60).replace(/\s+/g, " ")}…)` });
    }
  }
  for (const m of html.matchAll(/<(script|iframe|frame|embed|object)\b[^>]*\b(?:src|data)\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[2], `https://${host}/`);
      if (u.host !== host) out.push({ severity: "lock", msg: `${page}: <${m[1]}> loads from another host: ${u.href.slice(0, 120)}` });
    } catch { out.push({ severity: "lock", msg: `${page}: <${m[1]}> has an unparseable url` }); }
  }
  if (/<base\b/i.test(html)) out.push({ severity: "lock", msg: `${page}: <base> tag present` });
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) out.push({ severity: "lock", msg: `${page}: meta refresh present` });
  return out;
}

export async function verifySite(baseUrl: string, get: Fetcher, pages = ["/", "/nvidia/", "/certifications/"]): Promise<Finding[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const host = new URL(base + "/").host;
  const out: Finding[] = [];
  const st = await get(`${base}/status.json`).catch(() => null);
  if (st?.status === 200) {
    try {
      if (JSON.parse(text(st.body)).status === "locked") return [{ severity: "info", msg: "status.json already says locked: nothing to do" }];
    } catch { out.push({ severity: "warn", msg: "status.json is not valid JSON" }); }
  }
  const im = await get(`${base}/integrity.json`).catch(() => null);
  if (!im || im.status !== 200) out.push({ severity: "warn", msg: `integrity.json not reachable (${im?.status ?? "network error"})` });
  else {
    let files: Record<string, string> = {};
    try { files = JSON.parse(text(im.body)).files ?? {}; } catch { out.push({ severity: "lock", msg: "integrity.json is not valid JSON" }); }
    for (const [key, want] of Object.entries(files)) {
      const r = await get(`${base}/${key}`).catch(() => null);
      if (!r || r.status !== 200) { out.push({ severity: "warn", msg: `${key}: not reachable (${r?.status ?? "network error"})` }); continue; }
      if (sha(r.body) !== want) out.push({ severity: "lock", msg: `${key}: content does not match integrity.json` });
    }
  }
  for (const p of pages) {
    const r = await get(`${base}${p}`).catch(() => null);
    if (!r || r.status !== 200) { out.push({ severity: "warn", msg: `${p}: not reachable (${r?.status ?? "network error"})` }); continue; }
    out.push(...checkHtml(text(r.body), p, host));
  }
  return out;
}

const realFetch: Fetcher = async (url) => {
  const r = await fetch(url, { redirect: "follow", headers: { "cache-control": "no-cache" } });
  return { status: r.status, body: new Uint8Array(await r.arrayBuffer()) };
};

async function main() {
  const url = process.env.SITE_URL;
  if (!url) { console.error("SITE_URL is required"); process.exit(2); }
  const findings = await verifySite(url, realFetch);
  for (const f of findings) console.log(`${f.severity.toUpperCase().padEnd(5)} ${f.msg}`);
  const lock = findings.filter((f) => f.severity === "lock");
  console.log(lock.length ? `\n${lock.length} problem(s) that justify a lockdown.` : "\nNo tampering detected.");
  if (process.env.GITHUB_OUTPUT) {
    const report = lock.map((f) => f.msg).join(" | ").slice(0, 900).replace(/[\r\n]+/g, " ");
    appendFileSync(process.env.GITHUB_OUTPUT, `lock=${lock.length > 0}\nreport=${report}\n`);
  }
}
if (process.argv[1] && /watchdog\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
