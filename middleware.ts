import { type NextRequest, NextResponse } from "next/server";

/**
 * Per-request CSP nonce. Next.js 15 auto-stamps the nonce onto its inline
 * hydration scripts when it sees `nonce-*` in script-src and reads the value
 * from the `x-nonce` request header we set below.
 *
 * Tradeoff: middleware execution bypasses Vercel's prerender cache for any
 * route it touches, so the homepage server-renders per request. That's fine
 * for this project — the page is small and dynamic anyway (canvas + sliders).
 */

const isDev = process.env.NODE_ENV !== "production";

export function middleware(request: NextRequest) {
	const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

	// Dev needs `unsafe-eval` for webpack HMR and `unsafe-inline` as a fallback
	// for older browsers that don't understand `strict-dynamic`.
	const scriptSrc = isDev
		? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval'`
		: `'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`;

	const connectSrc = isDev
		? "'self' ws: wss: http://localhost:* http://127.0.0.1:*"
		: "'self'";

	const cspHeader = [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		`connect-src ${connectSrc}`,
		"font-src 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"upgrade-insecure-requests",
	].join("; ");

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("content-security-policy", cspHeader);

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});
	response.headers.set("Content-Security-Policy", cspHeader);
	return response;
}

export const config = {
	matcher: [
		{
			source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
	],
};
