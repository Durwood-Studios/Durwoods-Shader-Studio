"use client";

import { SHADER_REGISTRY, getRegistryEntry } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";

interface LibraryRailProps {
	/** When true, render icon-only (first two chars) — used on tablet breakpoint. */
	compact?: boolean;
	/** Called when a shader is selected — useful for closing mobile drawers. */
	onSelect?: () => void;
}

export function LibraryRail({ compact = false, onSelect }: LibraryRailProps) {
	const activeShaderId = useStore((s) => s.activeShaderId);
	const setActiveShaderId = useStore((s) => s.setActiveShaderId);
	const resetUniforms = useStore((s) => s.resetUniforms);

	function handleSelect(id: string) {
		if (id === activeShaderId) {
			onSelect?.();
			return;
		}
		setActiveShaderId(id);
		const entry = getRegistryEntry(id);
		const defaults = entry
			? Object.fromEntries(entry.manifest.uniforms.map((u) => [u.name, u.default]))
			: {};
		resetUniforms(defaults);
		onSelect?.();
	}

	if (compact) {
		return (
			<nav
				aria-label="Shader library"
				className="flex flex-col items-center gap-1 py-3 overflow-y-auto w-12"
			>
				{SHADER_REGISTRY.map(({ manifest }) => {
					const isActive = manifest.id === activeShaderId;
					const initials = manifest.label.slice(0, 2).toUpperCase();
					return (
						<button
							type="button"
							key={manifest.id}
							onClick={() => handleSelect(manifest.id)}
							title={manifest.label}
							aria-label={manifest.label}
							aria-current={isActive ? "true" : undefined}
							className={[
								// Minimum 44×44 touch target
								"flex h-11 w-11 items-center justify-center rounded-md text-xs font-bold transition-colors",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
								isActive
									? "bg-violet-600/30 text-violet-300"
									: "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200",
							].join(" ")}
						>
							{initials}
						</button>
					);
				})}
			</nav>
		);
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
							// Minimum 44px height for touch
							"w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
							isActive
								? "bg-violet-600/20 text-violet-300 font-medium"
								: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
						].join(" ")}
					>
						{manifest.label}
						{manifest.description && !compact && (
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
