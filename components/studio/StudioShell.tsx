"use client";

import { ShaderCanvas } from "@/components/canvas/ShaderCanvas";
import { ControlsPanel } from "@/components/controls/ControlsPanel";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { ExportDrawer } from "@/components/export/ExportDrawer";
import { LibraryRail } from "@/components/shaders-library/LibraryRail";
import { Button } from "@/components/ui/Button";
import { TabList, TabPanel, TabTrigger, Tabs } from "@/components/ui/Tabs";
import type { ShaderManifest as RuntimeManifest } from "@/lib/runtime";
import { SHADER_REGISTRY, type ShaderManifest, getRegistryEntry } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import { encode } from "@/lib/url-codec";
import { useCallback, useState } from "react";

interface StudioShellProps {
	shareId?: string;
}

const FALLBACK_ENTRY =
	SHADER_REGISTRY[0] ??
	(() => {
		throw new Error("SHADER_REGISTRY is empty — add at least one shader.");
	})();

export function StudioShell({ shareId }: StudioShellProps) {
	const activeShaderId = useStore((s) => s.activeShaderId);
	const uniforms = useStore((s) => s.uniforms);

	const entry = getRegistryEntry(activeShaderId) ?? FALLBACK_ENTRY;
	const manifest = entry.manifest as ShaderManifest;
	const fragSrc = entry.fragSrc;

	const [exportOpen, setExportOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleShare = useCallback(async () => {
		try {
			// encode(shaderId, version, manifest, config)
			const payload = encode(
				activeShaderId,
				manifest.version,
				manifest as unknown as RuntimeManifest,
				uniforms,
			);
			const url = `${window.location.origin}/${payload}`;
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Fallback: update URL bar without clipboard
			const payload = encode(
				activeShaderId,
				manifest.version,
				manifest as unknown as RuntimeManifest,
				uniforms,
			);
			window.history.replaceState(null, "", `/${payload}`);
		}
	}, [activeShaderId, uniforms, manifest]);

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-neutral-950">
			{/* Toolbar */}
			<header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 px-4">
				<span className="text-sm font-semibold tracking-tight text-neutral-100">Shader Studio</span>
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
						Export
					</Button>
				</div>
			</header>

			{/* Three-pane layout */}
			<div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_360px]">
				{/* Left rail — shader library */}
				<aside className="border-r border-neutral-800 overflow-y-auto" aria-label="Shader library">
					<LibraryRail />
				</aside>

				{/* Center — canvas. `relative` + absolute-positioned canvas guarantees
            a size-defining container regardless of flex/grid quirks. */}
				<main className="relative min-h-0 overflow-hidden bg-black">
					<ShaderCanvas fragSrc={fragSrc} manifest={manifest} />
				</main>

				{/* Right rail — controls / code tabs */}
				<aside
					className="border-l border-neutral-800 overflow-y-auto flex flex-col"
					aria-label="Shader controls"
				>
					<Tabs defaultTab="controls" className="flex flex-col flex-1">
						<TabList className="border-b border-neutral-800 px-3 pt-2 pb-0">
							<TabTrigger id="controls">Controls</TabTrigger>
							<TabTrigger id="code">Code</TabTrigger>
						</TabList>
						<TabPanel id="controls" className="flex-1 overflow-y-auto">
							<ControlsPanel manifest={manifest} />
						</TabPanel>
						<TabPanel id="code" className="flex-1">
							<CodeEditor />
						</TabPanel>
					</Tabs>
				</aside>
			</div>

			{/* Export drawer — slides up from bottom */}
			{exportOpen && (
				<section
					id="export-drawer"
					aria-label="Export options"
					className="shrink-0 max-h-80 overflow-y-auto border-t border-neutral-800"
				>
					<ExportDrawer manifest={manifest} fragSrc={fragSrc} shareId={shareId} />
				</section>
			)}
		</div>
	);
}
