"use client";
import { useNv } from "@/nvidia/store";
import { openMistakes } from "@/nvidia/engine";
import { TOPIC_BY_ID } from "@/nvidia/topics";
import { LaunchButton } from "@/nvidia/ui/LaunchButton";
import type { NvQuestion } from "@/nvidia/types";

function Item({ q, note }: { q: NvQuestion; note?: string }) {
  const nv = useNv();
  const right = q.options.find((o) => o.correct)!;
  return (
    <details className="card">
      <summary><strong>{q.id}</strong> · {TOPIC_BY_ID[q.topic]?.title} · {q.level}{note ? ` · ${note}` : ""}<br /><span>{q.q}</span></summary>
      <p><strong>Answer:</strong> {right.text}</p>
      <p>{right.why}</p>
      <p className="callout">{q.takeaway}</p>
      <button className="btn secondary" aria-pressed={nv.bookmarks.has(q.id)} onClick={() => nv.toggleBookmark(q.id)}>{nv.bookmarks.has(q.id) ? "★ Bookmarked" : "☆ Bookmark"}</button>
    </details>
  );
}

export default function Page() {
  const nv = useNv();
  const open = openMistakes(nv.states);
  const dueNow = open.filter((s) => s.due && s.due <= nv.today);
  const later = open.filter((s) => !(s.due && s.due <= nv.today)).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const mastered = [...nv.states.values()].filter((s) => s.mastered);
  const marked = [...nv.bookmarks].map((id) => nv.byId.get(id)).filter(Boolean) as NvQuestion[];
  return (
    <div>
      <h1>Notebook</h1>
      <p>Your mistakes come back after 1, 3 and 7 days. Mastered means correct on separate days after the miss, not just right once.</p>
      <h2>Due now ({dueNow.length})</h2>
      <div className="row"><LaunchButton spec={{ kind: "due" }} disabled={dueNow.length === 0}>Review due mistakes</LaunchButton></div>
      {dueNow.map((s) => { const q = nv.byId.get(s.qid); return q ? <Item key={s.qid} q={q} note={`due ${s.due}`} /> : null; })}
      <h2>Coming up ({later.length})</h2>
      {later.length === 0 && <p className="muted">Nothing scheduled.</p>}
      {later.map((s) => { const q = nv.byId.get(s.qid); return q ? <Item key={s.qid} q={q} note={`due ${s.due}`} /> : null; })}
      <h2>Bookmarks ({marked.length})</h2>
      {marked.length === 0 && <p className="muted">Bookmark a question while practising to keep it here.</p>}
      {marked.map((q) => <Item key={q.id} q={q} />)}
      <h2>Mastered ({mastered.length})</h2>
      <p className="small muted">{mastered.length ? "Questions you missed and then answered correctly on separate days." : "None yet."}</p>
    </div>
  );
}
