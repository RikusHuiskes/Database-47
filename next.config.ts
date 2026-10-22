import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF.js resolves its worker relative to its package at runtime. Keep the
  // package external and explicitly trace the worker into each API function.
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
