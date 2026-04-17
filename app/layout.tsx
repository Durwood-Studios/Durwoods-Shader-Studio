import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
	title: "Shader Studio",
	description: "Copy, tweak, export.",
};

// Force dynamic rendering so middleware.ts's per-request nonce gets stamped
// into the HTML. Without this, Vercel's prerender cache serves HTML whose
// inline <script> tags have no nonce and the CSP header blocks them.
export const dynamic = "force-dynamic";

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Touching headers() opts this route out of static rendering — the side
	// effect is what matters; we don't need to use the value.
	await headers();

	return (
		<html lang="en">
			<body className="dark bg-neutral-950 text-neutral-100 antialiased">{children}</body>
		</html>
	);
}
