"use client";

import {
	CATEGORY_LABELS,
	SHADER_REGISTRY,
	type ShaderCategory,
	getRegistryEntry,
} from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import { useCallback, useMemo, useRef, useState } from "react";

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

	const [query, setQuery] = useState("");
	const [collapsed, setCollapsed] = useState<Partial<Record<ShaderCategory, boolean>>>({});

	// Flat list of all shader ids for keyboard nav (stable order)
	const allShaderIds = useMemo(() => SHADER_REGISTRY.map(({ manifest }) => manifest.id), []);

	const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	const handleSelect = useCallback(
		(id: string) => {
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
		},
		[activeShaderId, setActiveShaderId, resetUniforms, onSelect],
	);

	function toggleCategory(cat: ShaderCategory) {
		setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
	}

	// Keyboard arrow nav across the flat list
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLButtonElement>, currentId: string) => {
			const idx = allShaderIds.indexOf(currentId);
			if (e.key === "ArrowDown") {
				e.preventDefault();
				const nextId = allShaderIds[idx + 1];
				if (nextId) buttonRefs.current.get(nextId)?.focus();
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				const prevId = allShaderIds[idx - 1];
				if (prevId) buttonRefs.current.get(prevId)?.focus();
			} else if (e.key === "Enter") {
				handleSelect(currentId);
			}
		},
		[allShaderIds, handleSelect],
	);

	// Grouped + filtered list — only recomputed when query changes
	const groupedFiltered = useMemo(() => {
		const lowerQ = query.trim().toLowerCase();

		const filtered = SHADER_REGISTRY.filter(({ manifest }) => {
			if (!lowerQ) return true;
			const inLabel = manifest.label.toLowerCase().includes(lowerQ);
			const inDesc = manifest.description?.toLowerCase().includes(lowerQ) ?? false;
			const inTags = manifest.tags?.some((t) => t.toLowerCase().includes(lowerQ)) ?? false;
			return inLabel || inDesc || inTags;
		});

		// Group by category in canonical order
		const catOrder = Object.keys(CATEGORY_LABELS) as ShaderCategory[];
		const groups = new Map<ShaderCategory, typeof filtered>();

		for (const entry of filtered) {
			const cat = (entry.manifest.category ?? "primitives") as ShaderCategory;
			if (!groups.has(cat)) groups.set(cat, []);
			groups.get(cat)?.push(entry);
		}

		return catOrder
			.filter((cat) => groups.has(cat))
			.map((cat) => ({ cat, entries: groups.get(cat) ?? [] }));
	}, [query]);

	// ── Compact mode (tablet icon rail) ──────────────────────────────────────
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
							ref={(el) => {
								if (el) buttonRefs.current.set(manifest.id, el);
								else buttonRefs.current.delete(manifest.id);
							}}
							onClick={() => handleSelect(manifest.id)}
							onKeyDown={(e) => handleKeyDown(e, manifest.id)}
							title={manifest.label}
							aria-label={manifest.label}
							aria-current={isActive ? "true" : undefined}
							className={[
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

	// ── Full mode ─────────────────────────────────────────────────────────────
	return (
		<nav aria-label="Shader library" className="flex flex-col overflow-y-auto">
			{/* Search box */}
			<div className="mb-3 px-3 pt-3">
				<input
					type="search"
					placeholder="Search shaders…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
					aria-label="Search shader library"
				/>
			</div>

			{/* Empty state */}
			{groupedFiltered.length === 0 && (
				<p className="px-5 py-4 text-xs text-neutral-500">No shaders match "{query}"</p>
			)}

			{/* Category sections */}
			{groupedFiltered.map(({ cat, entries }) => {
				const isCollapsed = collapsed[cat] ?? false;
				return (
					<section key={cat} aria-label={CATEGORY_LABELS[cat]}>
						{/* Category header toggle */}
						<button
							type="button"
							onClick={() => toggleCategory(cat)}
							aria-expanded={!isCollapsed}
							className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
						>
							<span
								className={[
									"text-[9px] transition-transform",
									isCollapsed ? "-rotate-90" : "rotate-0",
								].join(" ")}
								aria-hidden="true"
							>
								▾
							</span>
							<span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
								{CATEGORY_LABELS[cat]}
							</span>
							<span className="ml-auto text-[10px] text-neutral-600">({entries.length})</span>
						</button>

						{/* Shader tiles */}
						{!isCollapsed && (
							<ul className="flex flex-col gap-1 px-2 pb-2">
								{entries.map(({ manifest }) => {
									const isActive = manifest.id === activeShaderId;
									const tags = manifest.tags ?? [];
									const visibleTags = tags.slice(0, 3);
									const overflowCount = tags.length - visibleTags.length;

									return (
										<li key={manifest.id}>
											<button
												type="button"
												ref={(el) => {
													if (el) buttonRefs.current.set(manifest.id, el);
													else buttonRefs.current.delete(manifest.id);
												}}
												onClick={() => handleSelect(manifest.id)}
												onKeyDown={(e) => handleKeyDown(e, manifest.id)}
												aria-current={isActive ? "true" : undefined}
												className={[
													"w-full rounded-md px-3 py-2.5 text-left transition-colors",
													"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
													isActive
														? "bg-violet-600/20 text-violet-300"
														: "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200",
												].join(" ")}
											>
												{/* Label */}
												<span
													className={["block text-sm", isActive ? "font-medium" : ""].join(" ")}
												>
													{manifest.label}
												</span>

												{/* Description */}
												{manifest.description && (
													<span className="mt-0.5 block truncate text-[10px] text-neutral-600">
														{manifest.description}
													</span>
												)}

												{/* Tag pills */}
												{tags.length > 0 && (
													<span className="mt-1.5 flex flex-wrap gap-1">
														{visibleTags.map((tag) => (
															<span
																key={tag}
																className="inline-flex items-center rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 ring-1 ring-neutral-700"
															>
																{tag}
															</span>
														))}
														{overflowCount > 0 && (
															<span className="inline-flex items-center rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 ring-1 ring-neutral-700">
																+{overflowCount}
															</span>
														)}
													</span>
												)}
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</section>
				);
			})}
		</nav>
	);
}
