"use client";

import type { ShaderManifest, UniformDef } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { PresetSelector } from "./PresetSelector";
import { Slider } from "./Slider";

interface ControlsPanelProps {
	manifest: ShaderManifest;
}

function getUniformDefault(def: UniformDef): number {
	const d = def.default;
	return typeof d === "number" ? d : (d[0] ?? 0);
}

export function ControlsPanel({ manifest }: ControlsPanelProps) {
	const uniforms = useStore((s) => s.uniforms);
	const setUniform = useStore((s) => s.setUniform);
	const resetUniforms = useStore((s) => s.resetUniforms);

	// Derive unique group names in declaration order
	const groupNames = Array.from(new Set(manifest.uniforms.map((def) => def.group)));

	const [activeGroup, setActiveGroup] = useState<string>(groupNames[0] ?? "");

	// Group uniforms by their group label
	const groups = manifest.uniforms.reduce<Record<string, UniformDef[]>>((acc, def) => {
		const key = def.group;
		if (!acc[key]) acc[key] = [];
		acc[key]?.push(def);
		return acc;
	}, {});

	function getValue(def: UniformDef): number {
		const stored = uniforms[def.name];
		if (typeof stored === "number") return stored;
		return getUniformDefault(def);
	}

	const activeDefs = groups[activeGroup] ?? [];

	return (
		<div className="flex flex-col gap-0">
			{/* Presets section */}
			{(manifest.presets?.length ?? 0) > 0 && manifest.presets && (
				<PresetSelector presets={manifest.presets} />
			)}

			{/* Group tabs — horizontally scrollable for >4 groups.
			    touch-action: pan-x allows horizontal swipe without blocking vertical scroll.
			    Each tab has min-h-[44px] for touch target (class `group-tab-btn`). */}
			<div className="px-4 pt-4">
				<div
					role="tablist"
					aria-label="Uniform groups"
					className="flex overflow-x-auto gap-1 scrollbar-none overscroll-x-contain"
					style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
				>
					{groupNames.map((name) => {
						const isActive = name === activeGroup;
						return (
							<button
								key={name}
								role="tab"
								type="button"
								aria-selected={isActive}
								onClick={() => setActiveGroup(name)}
								className={[
									// group-tab-btn targets the @media (pointer: coarse) rule in globals.css
									"group-tab-btn flex-1 min-w-fit whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
									// Explicit min-h so it meets 44px tap target
									"min-h-[44px]",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
									"[-webkit-tap-highlight-color:transparent]",
									isActive
										? "border-neutral-600 bg-neutral-800 text-neutral-100"
										: "border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300",
								].join(" ")}
							>
								{name}
							</button>
						);
					})}
				</div>
			</div>

			{/* Active group sliders.
			    touch-action: pan-y on the container lets vertical swipes scroll the panel
			    instead of being captured by child pointer handlers. */}
			<div
				role="tabpanel"
				aria-label={activeGroup}
				className="flex flex-col gap-3 px-4 pt-4 pb-2"
				style={{ touchAction: "pan-y" }}
			>
				{activeDefs.map((def) => {
					const range = def.range ?? [0, 1];
					return (
						<Slider
							key={def.name}
							label={def.label}
							name={def.name}
							min={range[0]}
							max={range[1]}
							step={(range[1] - range[0]) / 255}
							value={getValue(def)}
							defaultValue={getUniformDefault(def)}
							onChange={(v) => setUniform(def.name, v)}
						/>
					);
				})}
			</div>

			{/* Reset button — min-h-[44px] meets tap target */}
			<div className="px-4 pb-4 pt-2">
				<button
					type="button"
					onClick={() =>
						resetUniforms(Object.fromEntries(manifest.uniforms.map((u) => [u.name, u.default])))
					}
					className={[
						"w-full rounded-md border border-neutral-700 px-3 py-2 text-xs text-neutral-400",
						"min-h-[44px]",
						"hover:border-neutral-500 hover:text-neutral-200 transition-colors",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
						"[-webkit-tap-highlight-color:transparent]",
					].join(" ")}
				>
					Reset to defaults
				</button>
			</div>
		</div>
	);
}
