import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "imagine-capabilities-silence-fully.trycloudflare.com",
  ],

  // Tesseract.js starts a Node worker thread from files inside its package.
  // Keep the package external so Turbopack/Next.js does not relocate the
  // worker entrypoint into the generated .next/server bundle.
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],

  // Tesseract's Node worker uses dynamic require("..") and dynamically
  // loads its worker/core support files. Explicitly include the complete
  // package in Vercel's serverless function trace so those files remain
  // available at runtime.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;
