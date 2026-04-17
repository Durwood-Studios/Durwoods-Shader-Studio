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

export function ShaderCanvas({ fragSrc, manifest }: ShaderCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

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

		const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		if (motionQuery.matches) r.pause();

		const handleMotionChange = (e: MediaQueryListEvent) => {
			if (e.matches) r.pause();
			else r.resume();
		};
		motionQuery.addEventListener("change", handleMotionChange);

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
			motionQuery.removeEventListener("change", handleMotionChange);
			r.destroy();
		};
	}, [fragSrc, manifest]);

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
