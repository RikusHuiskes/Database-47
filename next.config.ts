import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF.js resolves its worker relative to its package at runtime. Keeping it
  // external lets Vercel deploy the worker alongside the ESM package.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
