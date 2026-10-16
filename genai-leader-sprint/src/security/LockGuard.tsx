"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  LOCK_TEXT, inspectNode, isSerious, manifestKeyFor, parseIntegrity, parseStatus, sha256Base64, type LockReason, type NodeInfo,
} from "./lockdown";

const KEY = "nv-lock";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STATUS_EVERY_MS = 5 * 60_000;
type Lock = { reason: LockReason; detail?: string };

/** Fetch JSON and ALWAYS finish reading the body, even for a 404, so no request is left hanging. */
async function getJson(url: string): Promise<unknown | null> {
  const r = await fetch(url, { cache: "no-store" });
  const body = await r.text();
  if (!r.ok) return null;
  try { return JSON.parse(body); } catch { return null; }
}

async function fetchStatus(): Promise<{ locked: boolean; reason?: string } | null> {
  try {
    const s = parseStatus(await getJson(`${BASE}/status.json?t=${Date.now()}`));
    return s ? { locked: s.status === "locked", reason: s.reason } : null;
  } catch {
    return null; // offline or blocked: fail open, otherwise a flaky network would lock a legitimate learner out
  }
}

function infoOf(el: Element): NodeInfo {
  const a = (n: string) => el.getAttribute(n);
  return { tag: el.tagName, src: a("src"), href: a("href"), action: a("action"), httpEquiv: a("http-equiv"), type: a("type") };
}

export function LockGuard({ children }: { children: ReactNode }) {
  const [lock, setLock] = useState<Lock | null>(null);
  const latched = useRef(false);

  const trigger = useCallback((reason: LockReason, detail?: string) => {
    if (latched.current) return;
    latched.current = true;
    console.warn("[lockdown]", reason, detail ?? ""); // visible in the console so the owner can see why a page locked
    try { sessionStorage.setItem(KEY, JSON.stringify({ reason, detail })); } catch { /* storage may be unavailable */ }
    setLock({ reason, detail });
  }, []);

  useEffect(() => {
    const prod = process.env.NODE_ENV === "production";
    const cleanups: Array<() => void> = [];
    let alive = true;

    const start = async () => {
      // A lock from earlier in this tab stays until the owner's status file says everything is fine again.
      try {
        const saved = sessionStorage.getItem(KEY);
        if (saved) {
          const p = JSON.parse(saved) as Lock;
          latched.current = true;
          if (alive) setLock(p);
        }
      } catch { /* ignore */ }

      if (window.top !== window.self) trigger("framed");

      const check = async () => {
        const s = await fetchStatus();
        if (alive && s?.locked) trigger("kill-switch", s.reason);
      };
      await check();
      const iv = setInterval(check, STATUS_EVERY_MS);
      cleanups.push(() => clearInterval(iv));

      if (!prod) return; // dev server uses inline scripts and HMR: the detectors would only produce noise

      const onViolation = (e: SecurityPolicyViolationEvent) => {
        if (isSerious({ effectiveDirective: e.effectiveDirective, blockedURI: e.blockedURI, sourceFile: e.sourceFile })) {
          trigger("csp-violation", `${e.effectiveDirective}: ${e.blockedURI || "inline"}`.slice(0, 160));
        }
      };
      document.addEventListener("securitypolicyviolation", onViolation);
      cleanups.push(() => document.removeEventListener("securitypolicyviolation", onViolation));

      const mo = new MutationObserver((records) => {
        for (const r of records) {
          for (const n of Array.from(r.addedNodes)) {
            if (!(n instanceof Element)) continue;
            const list = [n, ...Array.from(n.querySelectorAll("script,iframe,frame,object,embed,base,meta,form"))];
            for (const el of list) {
              const why = inspectNode(infoOf(el), location.origin);
              if (why) { trigger("injected-node", why); return; }
            }
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      cleanups.push(() => mo.disconnect());

      // Bundle integrity: compare the scripts the page loaded with the hashes recorded at build time.
      // Only in the hardened static export (it is the build that writes integrity.json), and only after the page has
      // settled, so hashing the bundles never competes with loading and hydrating the app.
      if (process.env.NEXT_PUBLIC_INTEGRITY !== "1") return;
      await new Promise((r) => setTimeout(r, 3000));
      if (!alive) return;
      try {
        const manifest = parseIntegrity(await getJson(`${BASE}/integrity.json`));
        if (manifest && crypto?.subtle) {
          const scripts = Array.from(document.scripts).filter((s) => s.src && new URL(s.src).origin === location.origin).slice(0, 60);
          for (const s of scripts) {
            const key = manifestKeyFor(new URL(s.src).pathname, manifest.files);
            if (!key) continue;
            const buf = await (await fetch(s.src, { cache: "force-cache" })).arrayBuffer();
            if ((await sha256Base64(buf)) !== manifest.files[key]) { trigger("integrity", key); break; }
          }
        }
      } catch { /* a missing manifest is not an attack */ }
    };
    void start();
    return () => { alive = false; cleanups.forEach((c) => c()); };
  }, [trigger]);

  if (lock) return <LockScreen lock={lock} />;
  return <>{children}</>;
}

function LockScreen({ lock }: { lock: Lock }) {
  const [msg, setMsg] = useState("");
  const recheck = async () => {
    const s = await fetchStatus();
    if (s && !s.locked) {
      try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
      location.reload(); // detectors run again on a clean load; if the cause is still there it locks again
    } else setMsg(s ? "The site is still switched off by its owner." : "Could not reach the status file. Check your connection and try again.");
  };
  return (
    <main role="alert" style={{ maxWidth: 640, margin: "10vh auto", padding: "1.5rem" }}>
      <h1>This site is switched off</h1>
      <p>{LOCK_TEXT[lock.reason]}</p>
      {lock.detail && <p className="small muted">Detail: {lock.detail}</p>}
      <p>
        As a precaution nothing on this page is running. <strong>Your study progress is untouched</strong>: it is stored only in
        this browser and was not sent anywhere. Do not enter any passwords or personal details on this page.
      </p>
      <p className="small muted">If you own this site: open the repository, check the latest deployment, and run the “Unlock site” workflow when it is clean.</p>
      <button className="btn" onClick={recheck}>Check again</button>
      {msg && <p role="status">{msg}</p>}
    </main>
  );
}
