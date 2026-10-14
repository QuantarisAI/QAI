"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Launch } from "@/lib/store";

/** Runs a launcher, then routes to the session or shows its error/note. */
export function useLauncher() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "err" | "note"; text: string } | null>(null);
  const run = async (fn: () => Promise<Launch>) => {
    setMsg(null);
    const r = await fn();
    if (r.error) return setMsg({ kind: "err", text: r.error });
    if (r.session) router.push(r.session.kind === "exam" ? `/exam/run?id=${r.session.id}` : `/session?id=${r.session.id}`);
  };
  const banner = msg && <div className={`callout ${msg.kind === "err" ? "err" : ""}`} role="alert">{msg.text}</div>;
  return { run, banner };
}
