"use client";

import type { ShaderManifest, UniformDef } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
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
			{Object.entries(groups).map(([group, defs]) => (
				<section key={group}>
					<h3 className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-neutral-500">
						{group}
					</h3>
					<div className="flex flex-col gap-3">
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
									onChange={(v) => setUniform(def.name, v)}
								/>
							);
						})}
					</div>
				</section>
			))}

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
