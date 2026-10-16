"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "@/lib/store";
import { LockGuard } from "@/security/LockGuard";
import { NvShell } from "@/nvidia/ui/NvShell";

const NAV = [
  ["/", "Dashboard"], ["/diagnostic", "Diagnostic"], ["/learn", "Learn"], ["/practice", "Practice"], ["/exam", "Exam"],
  ["/notebook", "Notebook"], ["/cards", "Cards"], ["/settings", "Settings"], ["/certifications", "All certifications"],
] as const;

function Inner({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { ready, dbError } = useApp();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="in">
          <span className="brand">GenAI Leader Sprint</span>
          <nav aria-label="Main">
            <ul>
              {NAV.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <p className="small muted" role="note">
          Independent study aid. Not affiliated with or endorsed by Google. Questions are original practice items, not real exam questions.
        </p>
        {dbError && <div className="callout err" role="alert">{dbError}</div>}
        {ready ? children : <p role="status">Loading your progress…</p>}
      </main>
    </>
  );
}
function Hub({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <main id="main" tabIndex={-1}>{children}</main>
    </>
  );
}

/** Routes the whole site: NVIDIA module, the certifications hub, or the original Google app. One lockdown guard covers all of it. */
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  let body: ReactNode;
  if (path.startsWith("/nvidia")) body = <NvShell>{children}</NvShell>;
  else if (path.startsWith("/certifications")) body = <Hub>{children}</Hub>;
  else body = <AppProvider><Inner>{children}</Inner></AppProvider>;
  return <LockGuard>{body}</LockGuard>;
}
