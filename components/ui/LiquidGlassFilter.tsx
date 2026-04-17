"use client";

/**
 * Inline <svg> containing the SVG filter definitions referenced by <LiquidGlass>.
 * Rendered once at the app root (app/layout.tsx) so any LiquidGlass consumer can
 * reference the filter by `url(#liquid-glass)` without re-declaring it.
 *
 * Perf note: `feDisplacementMap` runs a GPU shader pass on the surface it is
 * applied to. Cost is proportional to surface area — fine for a small sticky
 * header, but do NOT apply to full-screen elements.
 */
export function LiquidGlassFilter() {
	return (
		<svg aria-hidden role="presentation" className="pointer-events-none absolute -z-[1] h-0 w-0">
			<defs>
				<filter id="liquid-glass" x="-20%" y="-20%" width="140%" height="140%">
					{/* Generate organic low-frequency noise */}
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.008 0.012"
						numOctaves="2"
						seed="7"
						result="noise"
					/>
					{/* Slight Gaussian blur on the source for the frosted-glass frost */}
					<feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blurred" />
					{/* Displace the blurred layer using the noise map to create the wavy liquid distortion */}
					<feDisplacementMap
						in="blurred"
						in2="noise"
						scale="4"
						xChannelSelector="R"
						yChannelSelector="G"
					/>
				</filter>
			</defs>
		</svg>
	);
}
