import type { Metadata } from "next";
import { LegacyRedirect } from "@/components/LegacyRedirect";
export const metadata: Metadata = { title: "Moved", robots: { index: false } };
export default function Page() { return <LegacyRedirect to="/certifications/google/session" />; }
