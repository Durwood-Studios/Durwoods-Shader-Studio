import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Shader Studio",
	description: "Copy, tweak, export.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className="dark bg-neutral-950 text-neutral-100 antialiased">{children}</body>
		</html>
	);
}
