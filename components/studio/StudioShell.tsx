"use client";

import { ShaderCanvas } from "@/components/canvas/ShaderCanvas";
import { ControlsPanel } from "@/components/controls/ControlsPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { ExportDrawer } from "@/components/export/ExportDrawer";
import { LibraryRail } from "@/components/library/LibraryRail";
import { Button } from "@/components/ui/Button";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TabList, TabPanel, TabTrigger, Tabs } from "@/components/ui/Tabs";
import type { ShaderManifest as RuntimeManifest } from "@/lib/runtime";
import { SHADER_REGISTRY, type ShaderManifest, getRegistryEntry } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import { decode, encode } from "@/lib/url-codec";
import { useCallback, useEffect, useState } from "react";

// NOTE: lib/store/index.ts Zustand persist was not modified per scope rules.
// If Safari private-mode breaks (localStorage throws), add a safeStorage wrapper
// in lib/store/index.ts: `storage: createJSONStorage(() => safeStorage)` where
// safeStorage tries localStorage and falls back to an in-memory Map.

interface StudioShellProps {
	shareId?: string;
}

const FALLBACK_ENTRY =
	SHADER_REGISTRY[0] ??
	(() => {
		throw new Error("SHADER_REGISTRY is empty — add at least one shader.");
	})();

/** Write text to clipboard; falls back to window.prompt if API unavailable. */
async function copyToClipboard(text: string): Promise<void> {
	if (typeof navigator !== "undefined" && navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {
			// fall through to prompt fallback
		}
	}
	// Clipboard API missing or denied
	if (typeof window !== "undefined") {
		window.prompt("Copy this URL:", text);
	}
}

export function StudioShell({ shareId }: StudioShellProps) {
	const activeShaderId = useStore((s) => s.activeShaderId);
	const uniforms = useStore((s) => s.uniforms);

	const entry = getRegistryEntry(activeShaderId) ?? FALLBACK_ENTRY;
	const manifest = entry.manifest as ShaderManifest;
	const fragSrc = entry.fragSrc;

	const [exportOpen, setExportOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	// Mobile drawer state
	const [libraryOpen, setLibraryOpen] = useState(false);
	const [controlsOpen, setControlsOpen] = useState(false);

	// BUG 2 fix: decode shareId on mount and apply to store
	useEffect(() => {
		if (!shareId) return;
		const decoded = decodeURIComponent(shareId);
		const result = decode(decoded, manifest as unknown as import("@/lib/runtime").ShaderManifest);
		if (result) {
			useStore.getState().setActiveShaderId(result.shaderId);
			useStore.getState().setUniforms(result.config);
		} else {
			console.warn("[StudioShell] Failed to decode shareId:", shareId);
		}
	}, [shareId, manifest]);

	// Close drawers when viewport expands past mobile breakpoint
	useEffect(() => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
		const mq = window.matchMedia("(min-width: 768px)");
		const handler = (e: MediaQueryListEvent) => {
			if (e.matches) {
				setLibraryOpen(false);
				setControlsOpen(false);
			}
		};
		if (typeof mq.addEventListener === "function") {
			mq.addEventListener("change", handler);
			return () => mq.removeEventListener("change", handler);
		}
	}, []);

	// Close drawers on backdrop click / escape
	useEffect(() => {
		if (!libraryOpen && !controlsOpen && !exportOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setLibraryOpen(false);
				setControlsOpen(false);
				setExportOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [libraryOpen, controlsOpen, exportOpen]);

	const handleShare = useCallback(async () => {
		const payload = encode(
			activeShaderId,
			manifest.version,
			manifest as unknown as RuntimeManifest,
			uniforms,
		);
		const url = `${window.location.origin}/s/${encodeURIComponent(payload)}`;

		await copyToClipboard(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);

		// Update URL bar — SSR-safe guard
		if (typeof window !== "undefined" && typeof window.history?.replaceState === "function") {
			window.history.replaceState(null, "", `/s/${encodeURIComponent(payload)}`);
		}
	}, [activeShaderId, uniforms, manifest]);

	const anyDrawerOpen = libraryOpen || controlsOpen;

	return (
		<div
			className="flex h-screen flex-col overflow-hidden bg-neutral-950"
			style={{
				paddingTop: "var(--sat)",
				paddingLeft: "var(--sal)",
				paddingRight: "var(--sar)",
				paddingBottom: "var(--sab)",
			}}
		>
			{/* ── Toolbar ── */}
			<header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
				<div className="flex items-center gap-2">
					{/* Mobile-only toggle buttons */}
					<button
						type="button"
						onClick={() => {
							setLibraryOpen((o) => !o);
							setControlsOpen(false);
						}}
						aria-label="Toggle shader library"
						aria-expanded={libraryOpen}
						className={[
							"flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors md:hidden",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
							libraryOpen
								? "bg-violet-600/20 text-violet-300"
								: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
						].join(" ")}
					>
						☰
					</button>
					<button
						type="button"
						onClick={() => {
							setControlsOpen((o) => !o);
							setLibraryOpen(false);
						}}
						aria-label="Toggle controls panel"
						aria-expanded={controlsOpen}
						className={[
							"flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors md:hidden",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
							controlsOpen
								? "bg-violet-600/20 text-violet-300"
								: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
						].join(" ")}
					>
						⚙
					</button>

					<span className="text-sm font-semibold tracking-tight text-neutral-100 md:text-base">
						Shader Studio
					</span>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleShare}
						aria-label="Copy share URL to clipboard"
					>
						{copied ? "Copied!" : "Share"}
					</Button>
					<Button
						variant="primary"
						size="sm"
						onClick={() => setExportOpen((o) => !o)}
						aria-expanded={exportOpen}
						aria-controls="export-drawer"
					>
						{/* ↗ on mobile, "Export" on larger */}
						<span className="md:hidden">↗</span>
						<span className="hidden md:inline">Export</span>
					</Button>
				</div>
			</header>

			{/* ── Main area ── */}
			<div className="relative min-h-0 flex-1">
				{/*
				  Responsive grid:
				  - Mobile  (<768px):  single column, canvas fills — drawers overlay
				  - Tablet  (768-1023px): [48px icon-rail | 1fr canvas | 320px controls]
				  - Desktop (≥1024px): [220px library | 1fr canvas | 360px controls]
				*/}
				<div
					className={[
						"grid h-full",
						// Mobile: 1 col (drawers overlay)
						"grid-cols-1",
						// Tablet: icon-rail + canvas + controls
						"md:grid-cols-[48px_1fr_320px]",
						// Desktop: full library + canvas + controls
						"lg:grid-cols-[220px_1fr_360px]",
					].join(" ")}
				>
					{/* ── Left rail — shader library (hidden on mobile, shown md+) ── */}
					<aside
						className="hidden border-r border-neutral-800 overflow-y-auto md:block"
						aria-label="Shader library"
					>
						{/* Compact (icon-only) on tablet, full on desktop */}
						<ErrorBoundary
							fallback={(_err, reset) => (
								<div className="flex flex-col items-center gap-2 p-3">
									<p className="text-center text-xs text-neutral-500">Library unavailable</p>
									<button
										type="button"
										onClick={reset}
										className="text-xs text-violet-400 underline hover:text-violet-300"
									>
										Retry
									</button>
								</div>
							)}
						>
							{/* Render compact on md, full on lg */}
							<div className="md:block lg:hidden">
								<LibraryRail compact />
							</div>
							<div className="hidden lg:block">
								<LibraryRail />
							</div>
						</ErrorBoundary>
					</aside>

					{/* ── Center — canvas ── */}
					<main className="relative min-h-0 overflow-hidden bg-black">
						<ErrorBoundary
							fallback={(_err, reset) => (
								<div className="absolute inset-0 flex items-center justify-center bg-neutral-950 p-6">
									<div className="w-full max-w-sm rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-center shadow-xl">
										<p className="mb-2 text-sm font-semibold text-neutral-200">
											Canvas couldn&rsquo;t start
										</p>
										<p className="mb-4 text-xs text-neutral-400">
											Something went wrong initializing the shader renderer.
										</p>
										<button
											type="button"
											onClick={reset}
											className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
										>
											Try again
										</button>
									</div>
								</div>
							)}
						>
							<ShaderCanvas fragSrc={fragSrc} manifest={manifest} />
						</ErrorBoundary>
					</main>

					{/* ── Right rail — controls / code tabs (hidden on mobile) ── */}
					<aside
						className="hidden border-l border-neutral-800 overflow-y-auto flex-col md:flex"
						aria-label="Shader controls"
					>
						<Tabs defaultTab="controls" className="flex flex-col flex-1">
							<TabList className="border-b border-neutral-800 px-3 pt-2 pb-0">
								<TabTrigger id="controls">Controls</TabTrigger>
								<TabTrigger id="code">Code</TabTrigger>
							</TabList>
							<TabPanel id="controls" className="flex-1 overflow-y-auto">
								<ErrorBoundary
									fallback={(_err, reset) => (
										<div className="flex flex-col gap-2 p-4">
											<p className="text-xs text-neutral-500">Controls unavailable</p>
											<button
												type="button"
												onClick={reset}
												className="text-xs text-violet-400 underline hover:text-violet-300 text-left"
											>
												Retry
											</button>
										</div>
									)}
								>
									<ControlsPanel manifest={manifest} />
								</ErrorBoundary>
							</TabPanel>
							<TabPanel id="code" className="flex-1">
								<CodeEditor />
							</TabPanel>
						</Tabs>
					</aside>
				</div>

				{/* ── Mobile backdrop overlay ── */}
				{anyDrawerOpen && (
					// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is supplemental; Escape key handled globally
					<div
						className="fixed inset-0 z-20 bg-black/60 md:hidden"
						aria-hidden="true"
						onClick={() => {
							setLibraryOpen(false);
							setControlsOpen(false);
						}}
					/>
				)}

				{/* ── Mobile library drawer ── */}
				<div
					role="dialog"
					aria-label="Shader library"
					aria-modal={libraryOpen}
					className={[
						"fixed inset-y-0 left-0 z-30 w-72 flex-col overflow-y-auto",
						"border-r border-neutral-800 bg-neutral-950 shadow-2xl",
						"transition-transform duration-200 ease-in-out md:hidden",
						libraryOpen ? "flex translate-x-0" : "flex -translate-x-full",
					].join(" ")}
				>
					<div className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
						<span className="text-sm font-semibold text-neutral-300">Library</span>
						<button
							type="button"
							onClick={() => setLibraryOpen(false)}
							aria-label="Close library"
							className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
						>
							✕
						</button>
					</div>
					<ErrorBoundary
						fallback={(_err, reset) => (
							<div className="flex flex-col gap-2 p-4">
								<p className="text-xs text-neutral-500">Library unavailable</p>
								<button
									type="button"
									onClick={reset}
									className="text-xs text-violet-400 underline hover:text-violet-300 text-left"
								>
									Retry
								</button>
							</div>
						)}
					>
						<LibraryRail onSelect={() => setLibraryOpen(false)} />
					</ErrorBoundary>
				</div>

				{/* ── Mobile controls drawer ── */}
				<div
					role="dialog"
					aria-label="Shader controls"
					aria-modal={controlsOpen}
					className={[
						"fixed inset-y-0 right-0 z-30 w-80 flex-col overflow-y-auto",
						"border-l border-neutral-800 bg-neutral-950 shadow-2xl",
						"transition-transform duration-200 ease-in-out md:hidden",
						controlsOpen ? "flex translate-x-0" : "flex translate-x-full",
					].join(" ")}
				>
					<div className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
						<span className="text-sm font-semibold text-neutral-300">Controls</span>
						<button
							type="button"
							onClick={() => setControlsOpen(false)}
							aria-label="Close controls"
							className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
						>
							✕
						</button>
					</div>
					<div className="overflow-y-auto flex-1">
						<Tabs defaultTab="controls" className="flex flex-col flex-1">
							<TabList className="border-b border-neutral-800 px-3 pt-2 pb-0">
								<TabTrigger id="m-controls">Controls</TabTrigger>
								<TabTrigger id="m-code">Code</TabTrigger>
							</TabList>
							<TabPanel id="m-controls" className="flex-1 overflow-y-auto">
								<ErrorBoundary
									fallback={(_err, reset) => (
										<div className="flex flex-col gap-2 p-4">
											<p className="text-xs text-neutral-500">Controls unavailable</p>
											<button
												type="button"
												onClick={reset}
												className="text-xs text-violet-400 underline hover:text-violet-300 text-left"
											>
												Retry
											</button>
										</div>
									)}
								>
									<ControlsPanel manifest={manifest} />
								</ErrorBoundary>
							</TabPanel>
							<TabPanel id="m-code" className="flex-1">
								<CodeEditor />
							</TabPanel>
						</Tabs>
					</div>
				</div>
			</div>

			{/* ── Export drawer — slides up from bottom ── */}
			{exportOpen && (
				<section
					id="export-drawer"
					aria-label="Export options"
					className="shrink-0 max-h-80 overflow-y-auto border-t border-neutral-800"
				>
					<ErrorBoundary
						fallback={(_err, reset) => (
							<div className="flex flex-col gap-2 p-4">
								<p className="text-xs text-neutral-500">Export unavailable</p>
								<button
									type="button"
									onClick={reset}
									className="text-xs text-violet-400 underline hover:text-violet-300 text-left"
								>
									Retry
								</button>
							</div>
						)}
					>
						<ExportDrawer manifest={manifest} fragSrc={fragSrc} shareId={shareId} />
					</ErrorBoundary>
				</section>
			)}
		</div>
	);
}
