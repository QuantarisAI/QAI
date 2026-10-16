import { describe, expect, it } from "vitest";
import { inspectNode, isForeignUrl, isSerious, manifestKeyFor, parseIntegrity, parseStatus, sha256Base64 } from "../src/security/lockdown";

const O = "https://krishna.github.io";

describe("kill switch file", () => {
  it("accepts only the two known states", () => {
    expect(parseStatus({ status: "ok" })).toEqual({ status: "ok", reason: undefined, updated: undefined });
    expect(parseStatus({ status: "locked", reason: "x" })?.status).toBe("locked");
    expect(parseStatus({ status: "maybe" })).toBeNull();
    expect(parseStatus("locked")).toBeNull();
    expect(parseStatus(null)).toBeNull();
  });
  it("truncates a huge reason instead of rendering it", () => {
    expect(parseStatus({ status: "locked", reason: "x".repeat(5000) })!.reason!.length).toBe(300);
  });
});

describe("foreign urls", () => {
  it("same origin and relative urls are fine", () => {
    expect(isForeignUrl("/_next/static/a.js", O)).toBe(false);
    expect(isForeignUrl(`${O}/x.js`, O)).toBe(false);
    expect(isForeignUrl("#top", O)).toBe(false);
    expect(isForeignUrl(null, O)).toBe(false);
  });
  it("other origins and javascript: are foreign", () => {
    expect(isForeignUrl("https://evil.example/x.js", O)).toBe(true);
    expect(isForeignUrl("//evil.example/x.js", O)).toBe(true);
    expect(isForeignUrl("javascript:alert(1)", O)).toBe(true);
    expect(isForeignUrl("http://krishna.github.io.evil.example/x", O)).toBe(true);
  });
  it("browser-extension schemes are not treated as attacks", () => {
    expect(isForeignUrl("chrome-extension://abc/content.js", O)).toBe(false);
    expect(isForeignUrl("moz-extension://abc/x.js", O)).toBe(false);
  });
});

describe("injected nodes", () => {
  it("flags foreign scripts, frames, forms, base and meta refresh", () => {
    expect(inspectNode({ tag: "SCRIPT", src: "https://evil.example/a.js" }, O)).toMatch(/script/);
    expect(inspectNode({ tag: "script", src: null }, O)).toMatch(/inline/);
    expect(inspectNode({ tag: "IFRAME", src: "https://evil.example" }, O)).toMatch(/iframe/);
    expect(inspectNode({ tag: "form", action: "https://evil.example/post" }, O)).toMatch(/form/);
    expect(inspectNode({ tag: "base", href: "https://evil.example/" }, O)).toMatch(/base/);
    expect(inspectNode({ tag: "meta", httpEquiv: "refresh" }, O)).toMatch(/refresh/);
  });
  it("lets same-origin chunks and ordinary UI through", () => {
    expect(inspectNode({ tag: "script", src: "/_next/static/chunks/a.js" }, O)).toBeNull();
    expect(inspectNode({ tag: "iframe", src: "about:blank" }, O)).toBeNull();
    expect(inspectNode({ tag: "div" }, O)).toBeNull();
    expect(inspectNode({ tag: "img", src: "data:image/png;base64,AAAA" }, O)).toBeNull();
    expect(inspectNode({ tag: "form", action: "" }, O)).toBeNull();
    expect(inspectNode({ tag: "script", src: "chrome-extension://abc/x.js" }, O)).toBeNull();
  });
});

describe("csp violations", () => {
  it("script, frame, form and base violations are serious", () => {
    expect(isSerious({ effectiveDirective: "script-src-elem", blockedURI: "https://evil.example/a.js" })).toBe(true);
    expect(isSerious({ effectiveDirective: "frame-src", blockedURI: "https://evil.example" })).toBe(true);
    expect(isSerious({ effectiveDirective: "form-action", blockedURI: "https://evil.example" })).toBe(true);
    expect(isSerious({ effectiveDirective: "base-uri", blockedURI: "https://evil.example" })).toBe(true);
  });
  it("style, image, font and extension noise is not", () => {
    expect(isSerious({ effectiveDirective: "style-src-attr", blockedURI: "inline" })).toBe(false);
    expect(isSerious({ effectiveDirective: "img-src", blockedURI: "https://x" })).toBe(false);
    expect(isSerious({ effectiveDirective: "font-src", blockedURI: "https://x" })).toBe(false);
    expect(isSerious({ effectiveDirective: "script-src-elem", blockedURI: "chrome-extension://abc/x.js" })).toBe(false);
    expect(isSerious({ effectiveDirective: "script-src-elem", blockedURI: "inline", sourceFile: "moz-extension://abc/x.js" })).toBe(false);
  });
});

describe("integrity manifest", () => {
  it("parses only well-formed hashes", () => {
    const m = parseIntegrity({ generated: "now", files: { "a.js": "sha256-abc=", "b.js": "md5-zzz", "c.js": 5 } });
    expect(Object.keys(m!.files)).toEqual(["a.js"]);
    expect(parseIntegrity(null)).toBeNull();
    expect(parseIntegrity({ files: 3 })).toBeNull();
  });
  it("finds a file under a base path and prefers the longest match", () => {
    const files = { "_next/static/chunks/a.js": "sha256-x=", "a.js": "sha256-y=" };
    expect(manifestKeyFor("/qai/_next/static/chunks/a.js", files)).toBe("_next/static/chunks/a.js");
    expect(manifestKeyFor("/_next/static/chunks/a.js", files)).toBe("_next/static/chunks/a.js");
    expect(manifestKeyFor("/other/z.js", files)).toBeNull();
  });
  it("hashes like the build script does", async () => {
    const buf = new TextEncoder().encode("hello").buffer as ArrayBuffer;
    expect(await sha256Base64(buf)).toBe("sha256-LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=");
  });
});
