"use client";

import { SHADER_REGISTRY } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";

export function LibraryRail() {
	const activeShaderId = useStore((s) => s.activeShaderId);
	const setActiveShaderId = useStore((s) => s.setActiveShaderId);
	const resetUniforms = useStore((s) => s.resetUniforms);

	function handleSelect(id: string) {
		if (id === activeShaderId) return;
		setActiveShaderId(id);
		resetUniforms();
	}

	return (
		<nav aria-label="Shader library" className="flex flex-col gap-1 p-3 overflow-y-auto">
			<p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
				Built-in
			</p>
			{SHADER_REGISTRY.map(({ manifest }) => {
				const isActive = manifest.id === activeShaderId;
				return (
					<button
						type="button"
						key={manifest.id}
						onClick={() => handleSelect(manifest.id)}
						aria-current={isActive ? "true" : undefined}
						className={[
							"w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
							isActive
								? "bg-violet-600/20 text-violet-300 font-medium"
								: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
						].join(" ")}
					>
						{manifest.label}
						{manifest.description && (
							<span className="mt-0.5 block truncate text-[10px] text-neutral-600">
								{manifest.description}
							</span>
						)}
					</button>
				);
			})}
		</nav>
	);
}
