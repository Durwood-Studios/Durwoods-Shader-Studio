"use client";

import type { ReactNode } from "react";

interface Props {
	children: ReactNode;
	className?: string;
	/** Backdrop blur strength in px. Default 12px. */
	blur?: number;
	/** Tint overlay colour. Default: subtle dark tint. */
	tint?: string;
	/**
	 * Apply the SVG displacement filter for the "liquid" wavy distortion effect.
	 * Set to false on low-end GPUs or when `prefers-reduced-motion` is active.
	 *
	 * Perf note: `filter: url(#liquid-glass)` runs a GPU shader pass each frame
	 * on the surface. Cheap on desktop; moderate on low-end mobile. Safe for a
	 * small sticky header — do NOT apply to full-screen surfaces.
	 */
	liquid?: boolean;
}

/**
 * Apple-style liquid-glass surface.
 *
 * Safety pattern: the SVG displacement filter is applied to a NON-INTERACTIVE
 * sibling div that sits behind the content layer. This prevents the filter from
 * shifting hit areas and breaking pointer events on toolbar buttons.
 *
 * Requires <LiquidGlassFilter /> to be mounted once in the document (done in
 * app/layout.tsx) so that `url(#liquid-glass)` resolves correctly.
 */
export function LiquidGlass({
	children,
	className = "",
	blur = 12,
	tint = "rgba(10, 10, 10, 0.55)",
	liquid = true,
}: Props) {
	return (
		<div className={`relative isolate ${className}`}>
			{/* Liquid-glass backdrop — non-interactive, sits behind content.
			    The SVG filter goes here so pointer events on content are unaffected. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					backdropFilter: `blur(${blur}px) saturate(1.4)`,
					WebkitBackdropFilter: `blur(${blur}px) saturate(1.4)`,
					backgroundColor: tint,
					filter: liquid ? "url(#liquid-glass)" : undefined,
				}}
			/>

			{/* Subtle 1px glass-edge ring — matches the inherited border-radius */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/10"
			/>

			{/* Content layer — receives pointer events normally */}
			<div className="relative">{children}</div>
		</div>
	);
}
