// SECURITY FIX REQUIRED — ML: Potential path traversal
// CWE: None
// Description: ML classifier detected potential path traversal (confidence: 0.93).
// TODO: Apply a proper fix for this vulnerability.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;
