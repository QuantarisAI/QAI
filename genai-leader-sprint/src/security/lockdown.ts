/**
 * Lockdown logic for a STATIC site (GitHub Pages). Pure functions, so they can be unit-tested.
 *
 * What this can and cannot do (be honest about it):
 *  - A static site has no server of its own. It cannot set HTTP headers, so the CSP is a <meta> tag
 *    (added at build time by scripts/harden-export.mjs) and `frame-ancestors` is not available:
 *    clickjacking is handled with a frame-busting check instead.
 *  - Code that runs in the page can detect many attacks (CSP violations, injected scripts or frames,
 *    modified bundles) and switch the UI off. But an attacker who already controls the page's JavaScript
 *    can also remove that check. So the real "disable the site" lever is OUTSIDE the page:
 *    `public/status.json` (a remote kill switch) and the GitHub Actions watchdog/lockdown workflows,
 *    which replace the deployed site with a static lock page.
 *  - This protects the site. It does not stop someone from reading the question bank (the answers ship
 *    to the browser by design) and it holds no accounts or secrets.
 */

export type LockReason =
  | "kill-switch" | "csp-violation" | "injected-node" | "framed" | "integrity";

export interface StatusFile { status: "ok" | "locked"; reason?: string; updated?: string }

export function parseStatus(raw: unknown): StatusFile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.status !== "ok" && r.status !== "locked") return null;
  return { status: r.status, reason: typeof r.reason === "string" ? r.reason.slice(0, 300) : undefined, updated: typeof r.updated === "string" ? r.updated : undefined };
}

/** Same origin, or a non-network scheme that browser extensions use for their own UI. */
const EXT = /^(chrome-extension|moz-extension|safari-extension|safari-web-extension|webkit-masked-url|edge-extension):/i;
export function isForeignUrl(url: string | null | undefined, origin: string): boolean {
  if (!url) return false;
  const u = url.trim();
  if (!u || u.startsWith("#") || u.startsWith("about:") || u.startsWith("blob:") || u.startsWith("data:image/")) return false;
  if (EXT.test(u)) return false;
  if (/^javascript:/i.test(u)) return true;
  try {
    return new URL(u, origin).origin !== origin;
  } catch {
    return true; // unparseable URL in a script/frame position is suspicious
  }
}

export interface NodeInfo { tag: string; src?: string | null; href?: string | null; action?: string | null; httpEquiv?: string | null; inlineText?: string | null; type?: string | null }
/**
 * Decide whether a node added to the document after load looks like an injection.
 * Deliberately narrow: ordinary UI changes and extension UI must not lock a legitimate user out.
 */
export function inspectNode(n: NodeInfo, origin: string): string | null {
  const tag = n.tag.toLowerCase();
  if (tag === "script") {
    if (n.src) return isForeignUrl(n.src, origin) ? `script from ${n.src.slice(0, 120)}` : null;
    return "inline script added after load"; // the app never creates inline scripts at runtime
  }
  if (tag === "iframe" || tag === "frame" || tag === "object" || tag === "embed") {
    return isForeignUrl(n.src, origin) ? `${tag} to ${String(n.src).slice(0, 120)}` : null;
  }
  if (tag === "base") return "<base> tag added";
  if (tag === "meta" && (n.httpEquiv ?? "").toLowerCase() === "refresh") return "meta refresh added";
  if (tag === "form" && isForeignUrl(n.action, origin)) return `form posting to ${String(n.action).slice(0, 120)}`;
  if (tag === "link" && n.href && isForeignUrl(n.href, origin)) return null; // fonts etc. are blocked by CSP; no need to lock
  return null;
}

/** Which CSP violations mean someone tried to run or embed something unexpected. */
export function isSerious(v: { effectiveDirective: string; blockedURI: string; sourceFile?: string }): boolean {
  if (EXT.test(v.blockedURI) || EXT.test(v.sourceFile ?? "")) return false; // an extension, not an attack on the page
  const d = v.effectiveDirective.split("-elem")[0].split("-attr")[0];
  return ["script-src", "object-src", "frame-src", "child-src", "form-action", "base-uri"].includes(d);
}

export interface IntegrityManifest { generated: string; files: Record<string, string> }
export function parseIntegrity(raw: unknown): IntegrityManifest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { generated?: unknown; files?: unknown };
  if (typeof r.files !== "object" || r.files === null) return null;
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.files as Record<string, unknown>)) if (typeof v === "string" && /^sha256-[A-Za-z0-9+/=]+$/.test(v)) files[k] = v;
  return { generated: typeof r.generated === "string" ? r.generated : "", files };
}
/** Find the manifest entry for a script URL (the site may be served under a base path). */
export function manifestKeyFor(pathname: string, files: Record<string, string>): string | null {
  const p = pathname.replace(/^\/+/, "");
  let best: string | null = null;
  for (const k of Object.keys(files)) if ((p === k || p.endsWith("/" + k)) && (!best || k.length > best.length)) best = k;
  return best;
}
export async function sha256Base64(buf: ArrayBuffer, subtle: SubtleCrypto = crypto.subtle): Promise<string> {
  const d = new Uint8Array(await subtle.digest("SHA-256", buf));
  let s = "";
  for (const b of d) s += String.fromCharCode(b);
  return "sha256-" + btoa(s);
}

export const LOCK_TEXT: Record<LockReason, string> = {
  "kill-switch": "The site owner has switched this site off.",
  "csp-violation": "The browser blocked something that tried to run or load on this page.",
  "injected-node": "Something unexpected was added to this page.",
  framed: "This page is being shown inside another site, which is not allowed.",
  integrity: "A file of this site does not match what was published.",
};
