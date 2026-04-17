import path from "node:path";
import type { NextConfig } from "next";

// CSP is set in middleware.ts so we can use per-request nonces for Next's
// inline hydration scripts. Do not duplicate it here.
const nextConfig: NextConfig = {
	outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
