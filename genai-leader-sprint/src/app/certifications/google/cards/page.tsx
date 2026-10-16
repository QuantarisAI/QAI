"use client";
import { useState } from "react";
import { CARDS } from "@/data/cards";

export default function Page() {
  const topics = ["All", ...new Set(CARDS.map((c) => c.topic))];
  const [t, setT] = useState("All");
  return (
    <div>
      <h1>Revision cards</h1>
      <div className="callout">Draft cards written from general knowledge and framed as trade-offs. They are <strong>not verified</strong> against Google&apos;s documentation; use the official learning path to confirm product details.</div>
      <label>Topic <select value={t} onChange={(e) => setT(e.target.value)}>{topics.map((x) => <option key={x}>{x}</option>)}</select></label>
      <div className="grid">
        {CARDS.filter((c) => t === "All" || c.topic === t).map((c) => (
          <article key={c.id} className="card">
            <p className="small muted" style={{ margin: 0 }}>{c.topic}</p>
            <h2 style={{ marginTop: 0 }}>{c.title}</h2>
            <dl style={{ margin: 0 }}>{c.rows.map(([k, v]) => <div key={k}><dt><strong>{k}</strong></dt><dd style={{ margin: "0 0 .5rem 0" }}>{v}</dd></div>)}</dl>
            <p className="small"><em>{c.note}</em></p>
          </article>
        ))}
      </div>
    </div>
  );
}
