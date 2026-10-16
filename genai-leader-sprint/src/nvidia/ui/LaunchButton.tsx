"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useNv, type LaunchSpec } from "../store";

export function LaunchButton({ spec, mockId, children, secondary, disabled }: { spec?: LaunchSpec; mockId?: string; children: ReactNode; secondary?: boolean; disabled?: boolean }) {
  const nv = useNv();
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const r = mockId ? await nv.startMock(mockId) : await nv.launch(spec!);
      if (r.error || !r.session) { setErr(r.error ?? "Could not start."); return; }
      router.push(r.session.kind === "mock" ? `/certifications/nvidia/exam?id=${r.session.id}` : `/certifications/nvidia/session?id=${r.session.id}`);
    } finally { setBusy(false); }
  };
  return (
    <>
      <button className={`btn ${secondary ? "secondary" : ""}`} onClick={go} disabled={busy || disabled}>{children}</button>
      {err && <span className="small" role="alert" style={{ color: "var(--bad)" }}>{err}</span>}
    </>
  );
}
