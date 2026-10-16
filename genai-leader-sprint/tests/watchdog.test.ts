import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkHtml, verifySite, type Fetcher } from "../scripts/watchdog";

const enc = (s: string) => new TextEncoder().encode(s);
const h = (s: string) => "sha256-" + createHash("sha256").update(s).digest("base64");
const csp = (hashes: string[]) => `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' ${hashes.map((x) => `'${x}'`).join(" ")}; object-src 'none'">`;
const inline = "self.__next_f.push([1,\"x\"])";
const goodHtml = `<html><head>${csp([h(inline)])}</head><body><script src="/_next/static/a.js"></script><script>${inline}</script></body></html>`;
const files = { "_next/static/a.js": "console.log(1)" };
const manifest = JSON.stringify({ files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, h(v)])) });

function site(over: Record<string, string> = {}): Fetcher {
  const map: Record<string, string> = {
    "/status.json": '{"status":"ok"}', "/integrity.json": manifest, "/_next/static/a.js": files["_next/static/a.js"],
    "/": goodHtml, "/certifications/nvidia/": goodHtml, "/certifications/google/": goodHtml, "/certifications/": goodHtml, ...over,
  };
  return async (url) => {
    const p = new URL(url).pathname.replace(/^\/repo/, "");
    return p in map ? { status: 200, body: enc(map[p]) } : { status: 404, body: enc("") };
  };
}
const B = "https://owner.github.io/repo";
const locks = (f: { severity: string; msg: string }[]) => f.filter((x) => x.severity === "lock");

describe("watchdog", () => {
  it("a clean site produces no lock findings", async () => {
    expect(locks(await verifySite(B, site()))).toEqual([]);
  });
  it("a modified bundle file triggers a lock", async () => {
    const f = await verifySite(B, site({ "/_next/static/a.js": "console.log('evil')" }));
    expect(locks(f).map((x) => x.msg).join()).toContain("does not match integrity.json");
  });
  it("a script from another host triggers a lock", async () => {
    const bad = goodHtml.replace("</body>", '<script src="https://evil.example/x.js"></script></body>');
    expect(locks(await verifySite(B, site({ "/": bad }))).length).toBeGreaterThan(0);
  });
  it("an injected inline script not covered by the CSP triggers a lock", async () => {
    const bad = goodHtml.replace("</body>", "<script>steal()</script></body>");
    expect(locks(await verifySite(B, site({ "/certifications/nvidia/": bad }))).map((x) => x.msg).join()).toContain("inline script not covered");
  });
  it("a weakened CSP triggers a lock", () => {
    const bad = goodHtml.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    expect(locks(checkHtml(bad, "/", "owner.github.io")).length).toBeGreaterThan(0);
  });
  it("injected iframe, base and meta refresh trigger a lock", () => {
    expect(locks(checkHtml(goodHtml.replace("</body>", '<iframe src="https://evil.example"></iframe></body>'), "/", "owner.github.io")).length).toBe(1);
    expect(locks(checkHtml(goodHtml.replace("<head>", '<head><base href="https://evil.example/">'), "/", "owner.github.io")).length).toBe(1);
    expect(locks(checkHtml(goodHtml.replace("<head>", '<head><meta http-equiv="refresh" content="0;url=https://evil.example">'), "/", "owner.github.io")).length).toBe(1);
  });
  it("a missing page or manifest is a warning, not a lockdown (outages must not lock the site)", async () => {
    const f = await verifySite(B, site({ "/integrity.json": "" , "/certifications/": "" }));
    expect(locks(f).length).toBe(1); // empty integrity.json is invalid JSON
    const g = await verifySite(B, async () => ({ status: 503, body: enc("") }));
    expect(locks(g)).toEqual([]);
    expect(g.some((x) => x.severity === "warn")).toBe(true);
  });
  it("a network error is a warning", async () => {
    const f = await verifySite(B, async () => { throw new Error("down"); });
    expect(locks(f)).toEqual([]);
  });
});
