"use client";

import { useStore } from "@/lib/store";
import { useEffect, useRef } from "react";

interface SplitItem {
	text: string;
	isSpace: boolean;
}

function splitIntoWords(text: string): SplitItem[] {
	return text
		.split(/(\s+)/)
		.filter(Boolean)
		.map((t) => ({ text: t, isSpace: /^\s+$/.test(t) }));
}

interface AnimOpts {
	stagger: number;
	duration: number;
	distance: number;
	blur: number;
	delayAfterHeadline?: number;
}

function animateIn(el: HTMLElement | null, opts: AnimOpts) {
	if (!el) return;
	const items = el.querySelectorAll<HTMLElement>(".reveal-word");

	// Skip animation if prefers-reduced-motion
	if (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		for (const w of items) {
			w.style.opacity = "1";
			w.style.transform = "";
			w.style.filter = "";
		}
		return;
	}

	// WAAPI not available — fall back to instant show
	if (!items[0] || typeof items[0].animate !== "function") {
		for (const w of items) {
			w.style.opacity = "1";
			w.style.transform = "";
			w.style.filter = "";
		}
		return;
	}

	items.forEach((word, i) => {
		word.animate(
			[
				{
					opacity: 0,
					transform: `translateX(${opts.distance}px)`,
					filter: `blur(${opts.blur}px)`,
				},
				{ opacity: 1, transform: "translateX(0)", filter: "blur(0)" },
			],
			{
				duration: opts.duration,
				delay: (opts.delayAfterHeadline ?? 0) + i * opts.stagger,
				// Matches GSAP's power2.out easing
				easing: "cubic-bezier(0.16, 1, 0.3, 1)",
				fill: "both",
			},
		);
	});
}

export function TextOverlay() {
	const overlay = useStore((s) => s.textOverlay);
	const headlineRef = useRef<HTMLHeadingElement>(null);
	const subtitleRef = useRef<HTMLParagraphElement>(null);

	useEffect(() => {
		if (!overlay.enabled) return;
		animateIn(headlineRef.current, {
			stagger: 60,
			duration: 700,
			distance: 24,
			blur: 10,
		});
		animateIn(subtitleRef.current, {
			stagger: 30,
			duration: 500,
			distance: 16,
			blur: 6,
			// Begin subtitle after headline has had ~400ms head-start
			delayAfterHeadline: 400,
		});
	}, [overlay]);

	if (!overlay.enabled) return null;

	const words = splitIntoWords(overlay.headline);
	const subWords = splitIntoWords(overlay.subtitle);

	const textColor = overlay.theme === "dark-text" ? "text-neutral-950" : "text-white";

	const alignment =
		overlay.alignment === "left"
			? "text-left items-start"
			: overlay.alignment === "right"
				? "text-right items-end"
				: "text-center items-center";

	return (
		<div
			aria-hidden
			className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-center px-6 sm:px-12 ${alignment} ${textColor}`}
		>
			<h1
				ref={headlineRef}
				className="max-w-4xl text-[clamp(2rem,6vw,5rem)] font-bold leading-[1.05] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)]"
			>
				{words.map((w, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: order is stable; text-split items never reorder
						key={i}
						className="reveal-word inline-block will-change-transform"
						style={{ whiteSpace: w.isSpace ? "pre" : "normal" }}
					>
						{w.text}
					</span>
				))}
			</h1>
			<p
				ref={subtitleRef}
				className="mt-4 max-w-2xl text-[clamp(0.95rem,1.5vw,1.25rem)] leading-relaxed text-current/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.5)]"
			>
				{subWords.map((w, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: order is stable; text-split items never reorder
						key={i}
						className="reveal-word inline-block will-change-transform"
						style={{ whiteSpace: w.isSpace ? "pre" : "normal" }}
					>
						{w.text}
					</span>
				))}
			</p>
		</div>
	);
}
