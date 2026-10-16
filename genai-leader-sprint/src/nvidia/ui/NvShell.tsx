"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { NvProvider, useNv } from "../store";

const NAV = [
  ["/nvidia", "Dashboard"], ["/nvidia/topics", "Topics"], ["/nvidia/mocks", "Mocks"], ["/nvidia/notebook", "Notebook"],
  ["/nvidia/roadmap", "Roadmap"], ["/nvidia/syllabus", "Syllabus"], ["/nvidia/settings", "Settings"],
] as const;

function Inner({ children }: { children: ReactNode }) {
  const path = (usePathname() ?? "").replace(/\/+$/, "") || "/";
  const { ready, dbError } = useNv();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="in">
          <span className="nv-brand">NCA-GENL Prep<small>Unofficial practice for the NVIDIA exam</small></span>
          <nav aria-label="Main">
            <ul>
              {NAV.map(([href, label]) => (
                <li key={href}><Link href={href} aria-current={path === href ? "page" : undefined}>{label}</Link></li>
              ))}
              <li><Link href="/certifications">All certifications</Link></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <p className="small muted" role="note">
          Independent study aid. Not affiliated with, endorsed by or sponsored by NVIDIA. Questions are original practice items, not real exam questions.
        </p>
        {dbError && <div className="callout err" role="alert">{dbError}</div>}
        {ready ? children : <p role="status">Loading your progress…</p>}
      </main>
    </>
  );
}

export function NvShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("nv-body");
    return () => document.body.classList.remove("nv-body");
  }, []);
  return (
    <NvProvider>
      <Inner>{children}</Inner>
    </NvProvider>
  );
}
