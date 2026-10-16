"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResultsView } from "@/nvidia/ui/ResultsView";
function Inner() { const id = useSearchParams().get("id") ?? ""; return <ResultsView key={id} id={id} />; }
export default function Page() { return <Suspense fallback={<p>Loading…</p>}><Inner /></Suspense>; }
