#!/usr/bin/env node
/**
 * Post-build hardening for the static export (run after `STATIC_EXPORT=1 next build`).
 *
 * GitHub Pages cannot set HTTP headers, so:
 *  1. Every page gets a <meta http-equiv="Content-Security-Policy"> that allows scripts only from this origin
 *     plus the exact SHA-256 hashes of the inline scripts Next generated. No 'unsafe-inline' and no 'unsafe-eval'
 *     for scripts. (A meta CSP cannot express frame-ancestors; clickjacking is handled in src/security/LockGuard.)
 *  2. integrity.json records the SHA-256 of every shipped JS/CSS file. The page and the watchdog workflow both
 *     compare against it.
 * Usage: node scripts/harden-export.mjs [outDir]
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const out = process.argv[2] ?? "out";
const sha = (buf) => createHash("sha256").update(buf).digest("base64");

function walk(dir) {
  const res = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) res.push(...walk(p));
    else res.push(p);
  }
  return res;
}
const files = walk(out);

const INLINE = /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi;
let pages = 0, inline = 0;
for (const f of files.filter((x) => x.endsWith(".html"))) {
  let html = readFileSync(f, "utf8");
  const hashes = new Set();
  for (const m of html.matchAll(INLINE)) {
    const attrs = m[1] ?? "";
    if (/type\s*=\s*["']?(application\/(ld\+)?json|importmap)/i.test(attrs) && !/importmap/i.test(attrs)) continue; // data blocks never execute
    if (m[2].trim() === "") continue;
    hashes.add(`'sha256-${sha(Buffer.from(m[2], "utf8"))}'`);
    inline++;
  }
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");
  const tags = `<meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer">`;
  if (!/<head[^>]*>/i.test(html)) throw new Error(`${f}: no <head>`);
  html = html.replace(/<head([^>]*)>/i, (m) => `${m}${tags}`);
  writeFileSync(f, html);
  pages++;
}

const manifest = { generated: new Date().toISOString(), files: {} };
for (const f of files) {
  if (!/\.(js|css|mjs)$/.test(f)) continue;
  const key = relative(out, f).split(sep).join("/");
  manifest.files[key] = `sha256-${sha(readFileSync(f))}`;
}
writeFileSync(join(out, "integrity.json"), JSON.stringify(manifest, null, 1));
console.log(`harden-export: ${pages} pages, ${inline} inline scripts hashed, ${Object.keys(manifest.files).length} files in integrity.json`);
