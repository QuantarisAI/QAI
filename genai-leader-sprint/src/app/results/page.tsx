"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Results } from "@/components/Results";
function Inner() { const id = useSearchParams().get("id") ?? ""; return <Results id={id} />; }
export default function Page() { return <Suspense fallback={<p>Loading…</p>}><Inner /></Suspense>; }
