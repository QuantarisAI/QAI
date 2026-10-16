import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Certification practice: GenAI Leader Sprint and NVIDIA NCA-GENL prep",
  description: "Independent practice apps for the Google Cloud Generative AI Leader and NVIDIA NCA-GENL certifications. Not affiliated with Google or NVIDIA.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
