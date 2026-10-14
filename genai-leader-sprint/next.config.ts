import type { NextConfig } from "next";

// Static export is opt-in (STATIC_EXPORT=1) so `npm start` and Vercel keep working unchanged.
// GitHub Pages serves under /<repo>, so NEXT_PUBLIC_BASE_PATH is set by the workflow.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(staticExport
    ? { output: "export", trailingSlash: true, images: { unoptimized: true }, basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined }
    : {}),
};

export default nextConfig;
