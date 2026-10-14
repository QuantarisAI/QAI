"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SessionRunner } from "@/components/SessionRunner";
function Inner() { const id = useSearchParams().get("id") ?? ""; return <SessionRunner key={id} id={id} />; }
export default function Page() { return <Suspense fallback={<p>Loading…</p>}><Inner /></Suspense>; }
