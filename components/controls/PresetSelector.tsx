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
			{/*
			  2 cols on narrow (mobile drawer / tablet), 3 cols on wider.
			  preset-chip class is referenced by the @media (pointer: coarse) rule
			  in globals.css to enforce min-h:44px on touch devices.
			*/}
			<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
				{presets.map((p) => (
					<button
						key={p.name}
						type="button"
						onClick={() => setUniforms(p.uniforms)}
						title={p.description ?? p.name}
						className={[
							"preset-chip rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-xs text-neutral-300",
							// min-h-[44px] satisfies touch target on all devices
							"min-h-[44px]",
							// Clip long names with ellipsis rather than overflowing
							"overflow-hidden text-ellipsis whitespace-nowrap",
							"transition-colors hover:border-violet-500 hover:text-neutral-100",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
							"[-webkit-tap-highlight-color:transparent]",
						].join(" ")}
					>
						{p.name}
					</button>
				))}
			</div>
		</section>
	);
}
