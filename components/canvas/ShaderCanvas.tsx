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

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		// Feature-detect WebGL before attempting to create runtime
		if (!isWebGLAvailable()) {
			setNoWebGL(true);
			return;
		}

		setError(null);

		const storeState = useStore.getState();
		const initial: Record<string, number | number[]> = {};
		for (const def of manifest.uniforms) {
			const stored = storeState.uniforms[def.name];
			initial[def.name] = stored !== undefined ? stored : def.default;
		}

		let runtime: ReturnType<typeof createRuntime> | null = null;
		try {
			runtime = createRuntime(canvas, {
				fragSrc,
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
			return;
		}

		const r = runtime;

		// Feature-detect matchMedia before using it
		if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
			const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
			if (motionQuery.matches) {
				// Render exactly one frame at t=0 then pause — avoids black canvas
				r.pause();
			}

			const handleMotionChange = (e: MediaQueryListEvent) => {
				if (e.matches) r.pause();
				else r.resume();
			};

			// addEventListener on MediaQueryList — feature-detect as well
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

		// Fallback path: no matchMedia — just subscribe and clean up
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
	}, [fragSrc, manifest]);

	// WebGL unavailable — show informative fallback, don't throw
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

	return (
		<>
			<canvas
				ref={canvasRef}
				className="absolute inset-0 block h-full w-full"
				aria-label="Shader preview canvas"
				role="img"
			/>
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
		</>
	);
}
