import { LiquidGlassFilter } from "@/components/ui/LiquidGlassFilter";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
	title: "Shader Studio",
	description: "Browser-based fragment shader studio by Durwood Studios",
	manifest: "/manifest.json",
	icons: { icon: "/icon.svg" },
	applicationName: "Shader Studio",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Shader Studio",
	},
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
			<body className="dark bg-neutral-950 text-neutral-100 antialiased">
				{/* Mount SVG filter defs once so every <LiquidGlass> can reference url(#liquid-glass) */}
				<LiquidGlassFilter />
				{children}
			</body>
		</html>
	);
}
