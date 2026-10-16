import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Certification practice", description: "Independent practice apps for cloud and AI certifications. Not affiliated with any vendor." };
export default function Page() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <h1>Certification practice</h1>
      <p className="muted">Independent study tools. Not affiliated with any vendor. Questions are original practice items.</p>
      <div className="grid">
        <section className="card" style={{ borderLeft: "6px solid #76b900" }}>
          <h2 style={{ marginTop: 0 }}>NVIDIA NCA-GENL</h2>
          <p>Generative AI LLMs Associate. 20 topics, 5 levels each (Beginner to Legendary), 5 timed mocks, a 40-day roadmap and mistake reviews.</p>
          <p className="small muted">Exam date set to 28 Nov 2026 (change it in Settings).</p>
          <Link className="btn" href="/certifications/nvidia">Open NVIDIA prep</Link>
        </section>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Google Cloud Generative AI Leader</h2>
          <p>The original 10-day sprint: diagnostic, learn, practice, three exams and a notebook.</p>
          <Link className="btn secondary" href="/certifications/google">Open Google prep</Link>
        </section>
      </div>
    </div>
  );
}
