"use client";
import { Fragment } from "react";
import Link from "next/link";
import { useNv } from "@/nvidia/store";
import { PHASE_LABEL, PLAN, PLAN_DAYS, dateOf, hoursFor, planPosition } from "@/nvidia/roadmap";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function Page() {
  const { settings, today } = useNv();
  const pos = planPosition(settings.startDate, today);
  const total = PLAN.reduce((h, d) => h + hoursFor(dateOf(settings.startDate, d.n)), 0);
  return (
    <div>
      <h1>40-day roadmap</h1>
      <p>{settings.startDate} to {dateOf(settings.startDate, PLAN_DAYS)}: weekdays about 2 hours, weekends about 3 hours (about {total} hours in total). The exam is on {settings.examDate}. The plan is a fixed {PLAN_DAYS}-day sequence from your start date; if you start late, shorten phase 1 rather than skipping the mocks.</p>
      <p className="small muted">Your start date and exam date are in <Link href="/nvidia/settings">Settings</Link>.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Day</th><th>Date</th><th>Hours</th><th>Focus</th></tr></thead>
          <tbody>
            {PLAN.map((d, i) => {
              const date = dateOf(settings.startDate, d.n);
              const head = i === 0 || PLAN[i - 1].phase !== d.phase;
              const isToday = pos.state === "active" && pos.n === d.n;
              const wd = WD[new Date(date + "T12:00:00Z").getUTCDay()];
              return (
                <Fragment key={d.n}>
                  {head && <tr key={`p-${d.phase}`}><th colSpan={4} style={{ background: "var(--surface-2)" }}>{PHASE_LABEL[d.phase]}</th></tr>}
                  <tr aria-current={isToday ? "date" : undefined} style={isToday ? { outline: "2px solid var(--primary)" } : undefined}>
                    <td>{d.n}{isToday && <span className="badge" style={{ marginLeft: ".4rem" }}>today</span>}</td>
                    <td>{wd} {date}</td>
                    <td>{hoursFor(date)}</td>
                    <td>
                      <details><summary><strong>{d.title}</strong></summary>
                        <ul>{d.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
                        {d.action.kind === "topics" && <Link href={`/nvidia/topics#t-${d.action.topic}`}>Open topics</Link>}
                        {d.action.kind === "mock" && <Link href="/nvidia/mocks">Open mocks</Link>}
                      </details>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
