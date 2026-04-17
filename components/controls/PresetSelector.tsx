"use client";

import type { Preset } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";

interface Props {
	presets: Preset[];
}

export function PresetSelector({ presets }: Props) {
	const setUniforms = useStore((s) => s.setUniforms);
	return (
		<section aria-label="Presets" className="px-4 pt-4">
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
				Presets
			</h3>
			<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
				{presets.map((p) => (
					<button
						key={p.name}
						type="button"
						onClick={() => setUniforms(p.uniforms)}
						title={p.description ?? p.name}
						className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-violet-500 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
					>
						{p.name}
					</button>
				))}
			</div>
		</section>
	);
}
