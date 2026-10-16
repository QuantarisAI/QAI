"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Old URLs (/nvidia/..., /exam, /learn, ...) moved under /certifications/<cert>/.
 * A static host cannot send HTTP redirects, so each old route is a tiny page that forwards the visitor
 * and keeps ?query and #hash (session ids, topic anchors). router.replace respects the GitHub Pages base path.
 */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to + window.location.search + window.location.hash);
  }, [router, to]);
  return (
    <p role="status" style={{ padding: "1rem" }}>
      This page has moved. Taking you to <Link href={to}>{to}</Link>…
    </p>
  );
}
