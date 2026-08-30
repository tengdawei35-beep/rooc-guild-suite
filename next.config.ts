import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "imagine-capabilities-silence-fully.trycloudflare.com",
  ],

  // Tesseract.js starts a Node worker thread from files inside its package.
  // Keep the package and its Node-side dependencies external so
  // Turbopack/Next.js does not relocate their CommonJS worker files.
  serverExternalPackages: [
    "tesseract.js",
    "tesseract.js-core",
    "bmp-js",
    "wasm-feature-detect",
  ],

  // Tesseract's Node worker uses dynamic requires and dynamically loads
  // worker/core support files. Explicitly include the complete package trees
  // and their runtime dependencies in Vercel's serverless function trace.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/wasm-feature-detect/**/*",
    ],
  },
};

export default nextConfig;
