"use client";
import { useRouter } from "next/navigation";
import { useNv } from "@/nvidia/store";
import { DOMAINS, LEVELS, LEVEL_BLURB, LEVEL_LABEL } from "@/nvidia/types";
import { topicsOf } from "@/nvidia/topics";
import { cellStatus } from "@/nvidia/engine";
import { LaunchButton } from "@/nvidia/ui/LaunchButton";

const STATUS_TEXT = { cleared: "Cleared", open: "In progress", next: "Start here", locked: "Suggested later" } as const;

export default function Page() {
  const { cells } = useNv();
  return (
    <div>
      <h1>Topics</h1>
      <p>Every topic has five levels, easiest to hardest. A level is <strong>cleared</strong> when you have seen all its questions and got at least two thirds right on the first try. Retrying does not improve that number, on purpose. Nothing is locked: the order is a recommendation.</p>
      <ul className="clean small muted">
        {LEVELS.map((l) => <li key={l}><span className={`lv lv-${l}`}>{LEVEL_LABEL[l]}</span> {LEVEL_BLURB[l]}</li>)}
      </ul>
      {DOMAINS.map((d) => (
        <section key={d.id} aria-labelledby={`h-${d.id}`}>
          <h2 id={`h-${d.id}`}>{d.name} <span className="badge">{d.weight}% of the exam</span></h2>
          <div className="ladder" role="table" aria-label={`${d.name} topics by level`}>
            <div className="h" role="columnheader">Topic</div>
            {LEVELS.map((l) => <div className="h" role="columnheader" key={l}>{LEVEL_LABEL[l]}</div>)}
            {topicsOf(d.id).map((t) => (
              <div key={t.id} style={{ display: "contents" }} role="row" id={`t-${t.id}`}>
                <div className="t" role="rowheader">
                  <strong>{t.id}</strong> {t.title}
                  <div className="small muted">{t.covers}</div>
                  <div style={{ marginTop: ".3rem" }}><LaunchButton spec={{ kind: "ladder", topic: t.id }} secondary>All levels</LaunchButton></div>
                </div>
                {LEVELS.map((l) => {
                  const c = cells.get(`${t.id}|${l}`);
                  const st = cellStatus(cells, t.id, l);
                  return (
                    <div role="cell" key={l}>
                      <LaunchCell topic={t.id} level={l} st={st} seen={c?.seen ?? 0} total={c?.total ?? 0} acc={c?.acc ?? null} title={t.title} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="small muted">&ldquo;{STATUS_TEXT.locked}&rdquo; means the level below is not cleared yet. It is only a suggestion: you can open any level.</p>
    </div>
  );
}

function LaunchCell({ topic, level, st, seen, total, acc, title }: { topic: string; level: (typeof LEVELS)[number]; st: keyof typeof STATUS_TEXT; seen: number; total: number; acc: number | null; title: string }) {
  const nv = useNv();
  const router = useRouter();
  return (
    <button
      className={`cellbtn ${st}`}
      aria-label={`${topic} ${title}, ${LEVEL_LABEL[level]}: ${STATUS_TEXT[st]}, ${seen} of ${total} seen${acc !== null ? `, ${Math.round(acc * 100)} percent first-try` : ""}`}
      onClick={async () => { const r = await nv.launch({ kind: "ladder", topic, level }); if (r.session) router.push(`/certifications/nvidia/session?id=${r.session.id}`); }}
    >
      <strong>{st === "cleared" ? "✓ " : ""}{STATUS_TEXT[st]}</strong>
      <span>{seen}/{total} seen{acc !== null ? ` · ${Math.round(acc * 100)}%` : ""}</span>
    </button>
  );
}
