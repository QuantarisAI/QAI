"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeRunner } from "@/nvidia/ui/PracticeRunner";
function Inner() { const id = useSearchParams().get("id") ?? ""; return <PracticeRunner key={id} id={id} />; }
export default function Page() { return <Suspense fallback={<p>Loading…</p>}><Inner /></Suspense>; }
