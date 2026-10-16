"use client";
import Link from "next/link";
import { DOMAINS, NV_EXAM } from "@/nvidia/types";
import { NV_SOURCES, topicsOf } from "@/nvidia/topics";

export default function Page() {
  return (
    <div>
      <h1>Syllabus and sources</h1>
      <p>
        Exam facts below were read from <a href={NV_EXAM.officialUrl} rel="noopener noreferrer" target="_blank">NVIDIA&rsquo;s official exam page</a> on {NV_EXAM.verifiedOn}:
        50 to 60 multiple-choice questions in 1 hour, five weighted topic areas. NVIDIA can change this page. <strong>Re-read it before you book or sit the exam.</strong>
      </p>
      {DOMAINS.map((d) => (
        <section className="card" key={d.id}>
          <h2 style={{ marginTop: 0 }}>{d.name} <span className="badge">{d.weight}%</span></h2>
          <p className="small muted">{d.mockCount} of 60 questions in a mock. Official sub-topics, paraphrased:</p>
          <ul>{d.official.map((o) => <li key={o}>{o}</li>)}</ul>
          <p><strong>Practice topics:</strong> {topicsOf(d.id).map((t) => <Link key={t.id} href={`/certifications/nvidia/topics#t-${t.id}`} style={{ marginRight: ".7rem" }}>{t.id} {t.title}</Link>)}</p>
        </section>
      ))}
      <h2>Product facts: where they came from</h2>
      <p className="small">Questions about NVIDIA products (NeMo, NIM, Triton, TensorRT-LLM, Guardrails, Curator) were written against these pages. Read the ones for products you are weak on; the docs change faster than any practice bank.</p>
      <ul>
        {NV_SOURCES.map((s) => (
          <li key={s.id}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.title}</a> <span className="small muted">· read {s.readOn} · {s.note}</span></li>
        ))}
      </ul>
      <div className="callout"><strong>About the questions.</strong> All 300 questions are original drafts written for this app. None are real exam questions. They have not been reviewed by a subject-matter expert, so a few may be wrong or arguable: if an explanation looks off, check the source above before you trust it.</div>
    </div>
  );
}
