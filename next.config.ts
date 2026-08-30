import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "imagine-capabilities-silence-fully.trycloudflare.com",
  ],

  // Tesseract.js starts a Node worker thread from files inside its package.
  // Keep the package and its Node-side image dependency external so
  // Turbopack/Next.js does not relocate their CommonJS worker files.
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "bmp-js"],

  // Tesseract's Node worker uses dynamic require("..") and dynamically
  // loads its worker/core support files. Explicitly include the complete
  // package tree and the BMP decoder in Vercel's serverless function trace.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/bmp-js/**/*",
    ],
  },
};

export default nextConfig;
