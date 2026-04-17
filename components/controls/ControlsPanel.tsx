"use client";

import type { ShaderManifest, UniformDef } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import { useCallback, useState } from "react";
import { Slider } from "./Slider";

interface ControlsPanelProps {
	manifest: ShaderManifest;
}

function getUniformDefault(def: UniformDef): number {
	const d = def.default;
	return typeof d === "number" ? d : (d[0] ?? 0);
}

// ── Chevron icon (inline SVG, no extra dep) ────────────────────────────────
function ChevronIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			width="10"
			height="10"
			viewBox="0 0 10 10"
			fill="none"
			aria-hidden="true"
			className="shrink-0 text-neutral-500 transition-transform duration-200"
			style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
		>
			<path
				d="M2 3.5L5 6.5L8 3.5"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function ControlsPanel({ manifest }: ControlsPanelProps) {
	const uniforms = useStore((s) => s.uniforms);
	const setUniform = useStore((s) => s.setUniform);
	const resetUniforms = useStore((s) => s.resetUniforms);

	// Group collapse state keyed by group name (all expanded by default)
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

	const toggleGroup = useCallback((group: string) => {
		setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
	}, []);

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

	return (
		<div className="flex flex-col gap-5 p-4">
			{Object.entries(groups).map(([group, defs]) => {
				const isExpanded = !collapsed[group];
				const headingId = `group-heading-${group.replace(/\s+/g, "-").toLowerCase()}`;
				const regionId = `group-region-${group.replace(/\s+/g, "-").toLowerCase()}`;

				return (
					<section key={group} aria-labelledby={headingId}>
						{/* Clickable group header */}
						<button
							id={headingId}
							type="button"
							aria-expanded={isExpanded}
							aria-controls={regionId}
							onClick={() => toggleGroup(group)}
							className={[
								"mb-2.5 flex w-full items-center gap-1.5",
								"text-xs font-semibold uppercase tracking-widest text-neutral-500",
								"hover:text-neutral-300 transition-colors",
								"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 rounded",
							].join(" ")}
						>
							<ChevronIcon expanded={isExpanded} />
							{group}
						</button>

						{/* Collapsible region */}
						<div
							id={regionId}
							role="region"
							aria-labelledby={headingId}
							hidden={!isExpanded}
							className="flex flex-col gap-3"
						>
							{defs.map((def) => {
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
					</section>
				);
			})}

			<button
				type="button"
				onClick={() =>
					resetUniforms(Object.fromEntries(manifest.uniforms.map((u) => [u.name, u.default])))
				}
				className={[
					"mt-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400",
					"hover:border-neutral-500 hover:text-neutral-200 transition-colors",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
				].join(" ")}
			>
				Reset to defaults
			</button>
		</div>
	);
}
