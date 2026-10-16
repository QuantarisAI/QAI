"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ExamRunner } from "@/nvidia/ui/ExamRunner";
function Inner() { const id = useSearchParams().get("id") ?? ""; return <ExamRunner key={id} id={id} />; }
export default function Page() { return <Suspense fallback={<p>Loading…</p>}><Inner /></Suspense>; }
