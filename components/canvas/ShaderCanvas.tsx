"use client";

import { ShaderCompileError, createRuntime } from "@/lib/runtime";
import type { ShaderManifest as RuntimeManifest } from "@/lib/runtime";
import type { ShaderManifest } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import { useEffect, useRef, useState } from "react";

interface ShaderCanvasProps {
	fragSrc: string;
	manifest: ShaderManifest;
}

/** Test WebGL availability without throwing. */
function isWebGLAvailable(): boolean {
	try {
		const probe = document.createElement("canvas");
		return !!(probe.getContext("webgl") ?? probe.getContext("experimental-webgl"));
	} catch {
		return false;
	}
}

/** Write text to clipboard with execCommand fallback. */
function writeToClipboard(text: string): void {
	if (typeof navigator !== "undefined" && navigator.clipboard) {
		navigator.clipboard.writeText(text).catch(() => {
			execCommandCopy(text);
		});
	} else {
		execCommandCopy(text);
	}
}

function execCommandCopy(text: string): void {
	const ta = document.createElement("textarea");
	ta.value = text;
	ta.style.position = "fixed";
	ta.style.opacity = "0";
	document.body.appendChild(ta);
	ta.focus();
	ta.select();
	try {
		document.execCommand("copy");
	} catch {
		// silent — best-effort only
	}
	document.body.removeChild(ta);
}

// Export for potential use by other components
export { writeToClipboard };

export function ShaderCanvas({ fragSrc, manifest }: ShaderCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [noWebGL, setNoWebGL] = useState(false);

	// FPS counter — DOM refs for imperative updates (no re-render per frame)
	const fpsNodeRef = useRef<HTMLSpanElement>(null);
	const msNodeRef = useRef<HTMLSpanElement>(null);
	const fpsHudRef = useRef<HTMLDivElement>(null);

	// Store state
	const editedFragSrc = useStore((s) => s.editedFragSrc);
	const setCompileError = useStore((s) => s.setCompileError);
	const perfHud = useStore((s) => s.perfHud);
	const textOverlay = useStore((s) => s.textOverlay);

	// Effective frag src: prefer edited (Monaco) if present
	const effectiveFragSrc = editedFragSrc ?? fragSrc;

	// ── Shader runtime effect ─────────────────────────────────────────────────

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		if (!isWebGLAvailable()) {
			setNoWebGL(true);
			return;
		}

		setError(null);
		setCompileError(null);

		const storeState = useStore.getState();
		const initial: Record<string, number | number[]> = {};
		for (const def of manifest.uniforms) {
			const stored = storeState.uniforms[def.name];
			initial[def.name] = stored !== undefined ? stored : def.default;
		}

		let runtime: ReturnType<typeof createRuntime> | null = null;
		try {
			runtime = createRuntime(canvas, {
				fragSrc: effectiveFragSrc,
				manifest: manifest as unknown as RuntimeManifest,
				initial,
			});
		} catch (err) {
			const msg =
				err instanceof ShaderCompileError
					? `GLSL compile error:\n${err.message}`
					: err instanceof Error
						? err.message
						: String(err);
			console.error("[ShaderCanvas]", err);
			setError(msg);
			setCompileError(msg);
			return;
		}

		const r = runtime;

		if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
			const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
			if (motionQuery.matches) {
				r.pause();
			}

			const handleMotionChange = (e: MediaQueryListEvent) => {
				if (e.matches) r.pause();
				else r.resume();
			};

			if (typeof motionQuery.addEventListener === "function") {
				motionQuery.addEventListener("change", handleMotionChange);
				const unsub = () => motionQuery.removeEventListener("change", handleMotionChange);

				const unsubscribe = useStore.subscribe((state, prevState) => {
					if (state.uniforms === prevState.uniforms) return;
					for (const name of Object.keys(state.uniforms)) {
						if (state.uniforms[name] !== prevState.uniforms[name]) {
							const value = state.uniforms[name];
							if (value !== undefined) r.setUniform(name, value);
						}
					}
				});

				return () => {
					unsubscribe();
					unsub();
					r.destroy();
				};
			}
		}

		// Fallback path: no matchMedia
		const unsubscribe = useStore.subscribe((state, prevState) => {
			if (state.uniforms === prevState.uniforms) return;
			for (const name of Object.keys(state.uniforms)) {
				if (state.uniforms[name] !== prevState.uniforms[name]) {
					const value = state.uniforms[name];
					if (value !== undefined) r.setUniform(name, value);
				}
			}
		});

		return () => {
			unsubscribe();
			r.destroy();
		};
	}, [effectiveFragSrc, manifest, setCompileError]);

	// ── FPS counter — imperative DOM update every second ─────────────────────

	useEffect(() => {
		if (!perfHud) return;

		// Rolling frame times (last 60 frames)
		const frameTimes: number[] = [];
		let lastFrameTime = performance.now();
		let rafId = 0;

		function rafLoop(now: number) {
			const delta = now - lastFrameTime;
			lastFrameTime = now;
			frameTimes.push(delta);
			if (frameTimes.length > 60) frameTimes.shift();
			rafId = requestAnimationFrame(rafLoop);
		}

		rafId = requestAnimationFrame(rafLoop);

		// Update DOM once per second
		const intervalId = setInterval(() => {
			if (frameTimes.length === 0) return;
			const avgMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
			const fps = Math.round(1000 / avgMs);
			const ms = avgMs.toFixed(1);

			if (fpsNodeRef.current) fpsNodeRef.current.textContent = `${fps} fps`;
			if (msNodeRef.current) msNodeRef.current.textContent = `${ms}ms`;

			// Color-code the HUD element
			if (fpsHudRef.current) {
				fpsHudRef.current.style.color = fps > 55 ? "#4ade80" : fps >= 30 ? "#facc15" : "#f87171";
			}
		}, 1000);

		return () => {
			cancelAnimationFrame(rafId);
			clearInterval(intervalId);
		};
	}, [perfHud]);

	// ── WebGL unavailable fallback ────────────────────────────────────────────

	if (noWebGL) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-neutral-950 p-6">
				<div className="w-full max-w-sm rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-xl text-center">
					<p className="mb-2 text-sm font-semibold text-neutral-200">
						WebGL isn&rsquo;t available in this browser
					</p>
					<p className="mb-4 text-xs text-neutral-400">
						Shader Studio requires WebGL to render fragment shaders. Try a different browser or
						enable hardware acceleration in your settings.
					</p>
					<a
						href="https://get.webgl.org"
						target="_blank"
						rel="noreferrer"
						className={[
							"inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white",
							"hover:bg-violet-500 transition-colors",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
						].join(" ")}
					>
						Check WebGL support
					</a>
				</div>
			</div>
		);
	}

	// ── Text overlay alignment helper ─────────────────────────────────────────

	const alignClass =
		textOverlay.alignment === "left"
			? "items-start text-left"
			: textOverlay.alignment === "right"
				? "items-end text-right"
				: "items-center text-center";

	const textColorClass = textOverlay.theme === "dark-text" ? "text-neutral-900" : "text-white";

	const headlineDropShadow =
		textOverlay.theme === "light-text"
			? "drop-shadow(0 2px 8px rgba(0,0,0,0.8)) drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
			: "drop-shadow(0 2px 4px rgba(255,255,255,0.3))";

	return (
		<>
			{/* ── WebGL canvas ── */}
			<canvas
				ref={canvasRef}
				className="absolute inset-0 block h-full w-full"
				aria-label="Shader preview canvas"
				role="img"
			/>

			{/* ── Shader compile error overlay ── */}
			{error && (
				<div
					role="alert"
					className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-1/2 overflow-auto border-t border-red-900 bg-red-950/90 p-3 font-mono text-xs text-red-200 backdrop-blur"
				>
					<div className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-300">
						Shader error
					</div>
					<pre className="whitespace-pre-wrap">{error}</pre>
				</div>
			)}

			{/* ── FPS / ms counter — imperative update, no re-render per frame ── */}
			{perfHud && (
				<div
					ref={fpsHudRef}
					className="pointer-events-none absolute top-2 left-2 z-10 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-neutral-300"
					aria-hidden="true"
				>
					<span ref={fpsNodeRef}>-- fps</span>
					{" / "}
					<span ref={msNodeRef}>--ms</span>
				</div>
			)}

			{/* ── Text overlay for readability testing ── */}
			{textOverlay.enabled && (
				<div
					className={[
						"pointer-events-none absolute inset-0 z-20",
						"flex flex-col justify-center px-6 md:px-12",
						alignClass,
					].join(" ")}
					aria-hidden="true"
				>
					<div className={["max-w-4xl w-full", textColorClass].join(" ")}>
						<h2
							className="font-bold leading-tight tracking-tight"
							style={{
								fontSize: "clamp(2rem, 6vw, 5rem)",
								filter: headlineDropShadow,
							}}
						>
							{textOverlay.headline}
						</h2>
						<p
							className="mt-4 leading-relaxed"
							style={{
								fontSize: "clamp(0.9rem, 1.5vw, 1.25rem)",
								filter: headlineDropShadow,
								opacity: 0.9,
							}}
						>
							{textOverlay.subtitle}
						</p>
					</div>
				</div>
			)}
		</>
	);
}
