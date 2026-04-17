import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Dev mode needs `unsafe-eval` (webpack HMR) and `unsafe-inline` (hydration
// scripts) or React never boots. Production stays strict per PLANNING.md §4.2.
const scriptSrc = isDev
	? "script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'"
	: "script-src 'self' 'wasm-unsafe-eval'";

// `connect-src` in dev needs ws: for HMR, plus localhost variants.
const connectSrc = isDev
	? "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:*"
	: "connect-src 'self'";

const nextConfig: NextConfig = {
	outputFileTracingRoot: path.join(__dirname),
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Content-Security-Policy",
						value: [
							"default-src 'self'",
							scriptSrc,
							"style-src 'self' 'unsafe-inline'",
							"img-src 'self' data: blob:",
							connectSrc,
							"frame-ancestors 'none'",
							"base-uri 'self'",
							"form-action 'self'",
						].join("; "),
					},
				],
			},
		];
	},
};

export default nextConfig;
