// lib/runtime/index.ts
// ~1.5 KB WebGL 1 runtime. No dependencies. Vanilla TS strict.

import { ContextLostError, ShaderCompileError, compileShader, linkProgram } from "./compile";

export { ContextLostError, ShaderCompileError } from "./compile";

// ─── Public types ────────────────────────────────────────────────────────────

export interface UniformDef {
	name: string;
	type: "float" | "vec2" | "vec3" | "vec4" | "int" | "bool";
	default: number | number[];
	range?: [number, number];
	label?: string;
	group?: string;
	storage?: "uint8" | "int16" | "float32";
}

export interface ShaderManifest {
	id: string;
	version: number;
	label: string;
	uniforms: UniformDef[];
}

export interface RuntimeOptions {
	vertSrc?: string;
	fragSrc: string;
	manifest: ShaderManifest;
	initial?: Record<string, number | number[]>;
	dprCap?: number;
}

export interface RuntimeInstance {
	setUniform(name: string, value: number | number[]): void;
	setUniforms(cfg: Record<string, number | number[]>): void;
	pause(): void;
	resume(): void;
	destroy(): void;
	readonly gl: WebGLRenderingContext;
}

// ─── Default vertex shader (fullscreen quad) ─────────────────────────────────

const DEFAULT_VERT = /* glsl */ `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`.trim();

// ─── Quad geometry (two triangles covering clip space) ────────────────────────

const QUAD_VERTS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

// ─── Uniform upload helper ────────────────────────────────────────────────────

function uploadUniform(
	gl: WebGLRenderingContext,
	loc: WebGLUniformLocation,
	type: UniformDef["type"],
	value: number | number[],
): void {
	if (type === "float") {
		gl.uniform1f(loc, value as number);
	} else if (type === "int" || type === "bool") {
		gl.uniform1i(loc, value as number);
	} else if (type === "vec2") {
		const v = value as number[];
		gl.uniform2f(loc, v[0] ?? 0, v[1] ?? 0);
	} else if (type === "vec3") {
		const v = value as number[];
		gl.uniform3f(loc, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
	} else if (type === "vec4") {
		const v = value as number[];
		gl.uniform4f(loc, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0);
	}
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createRuntime(canvas: HTMLCanvasElement, opts: RuntimeOptions): RuntimeInstance {
	const dprCap = opts.dprCap ?? 2;

	// Acquire context (rebind so narrowing is preserved through closures).
	// `preserveDrawingBuffer: false` is default; we leave it that way.
	const rawGl = canvas.getContext("webgl");
	if (!rawGl) throw new Error("WebGL 1 not available");
	const gl: WebGLRenderingContext = rawGl;

	// Defensive: if a previous runtime (or tab backgrounding) left the context
	// in a lost state, opt into restore and throw a recoverable error so the
	// caller can remount. See compile.ts ContextLostError.
	if (gl.isContextLost()) {
		throw new ContextLostError(
			"WebGL context is lost at createRuntime; remount the canvas to recover.",
		);
	}

	// Context-loss recovery — if the GPU resets or the tab is suspended,
	// call preventDefault() so the browser will fire webglcontextrestored
	// later, and dispatch a custom event the React layer listens for.
	function handleContextLost(e: Event): void {
		e.preventDefault();
		console.warn("[runtime] WebGL context lost; pausing until restored");
		paused = true;
		cancelAnimationFrame(rafId);
	}
	function handleContextRestored(): void {
		console.info("[runtime] WebGL context restored — requesting remount");
		canvas.dispatchEvent(new CustomEvent("shader-studio:context-restored"));
	}
	canvas.addEventListener("webglcontextlost", handleContextLost, false);
	canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

	// Compile shaders — compile.ts helpers check isContextLost() internally
	// and throw ContextLostError instead of a misleading compile error.
	const vs = compileShader(gl, gl.VERTEX_SHADER, opts.vertSrc ?? DEFAULT_VERT);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, opts.fragSrc);
	const program = linkProgram(gl, vs, fs);

	// Quad buffer
	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW);

	const aPos = gl.getAttribLocation(program, "aPosition");
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

	gl.useProgram(program);

	// Built-in uniform locations
	const locTime = gl.getUniformLocation(program, "uTime");
	const locRes = gl.getUniformLocation(program, "uResolution");
	const locMouse = gl.getUniformLocation(program, "uMouse");

	// Manifest uniform locations + current values
	const uniformLocs = new Map<string, WebGLUniformLocation | null>();
	const uniformTypes = new Map<string, UniformDef["type"]>();
	const values = new Map<string, number | number[]>();

	for (const def of opts.manifest.uniforms) {
		uniformLocs.set(def.name, gl.getUniformLocation(program, def.name));
		uniformTypes.set(def.name, def.type);
		const initial =
			opts.initial?.[def.name] !== undefined
				? (opts.initial[def.name] as number | number[])
				: def.default;
		values.set(def.name, initial);
	}

	// Upload initial uniform values
	function flushAll(): void {
		gl.useProgram(program);
		for (const def of opts.manifest.uniforms) {
			const loc = uniformLocs.get(def.name);
			if (!loc) continue;
			const v = values.get(def.name);
			if (v === undefined) continue;
			uploadUniform(gl, loc, def.type, v);
		}
	}
	flushAll();

	// Resize handler
	function resize(): void {
		const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
		const w = Math.floor(canvas.clientWidth * dpr);
		const h = Math.floor(canvas.clientHeight * dpr);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		gl.viewport(0, 0, w, h);
		if (locRes) gl.uniform2f(locRes, w, h);
	}

	const resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(canvas);
	resize();
	// Second resize after first rAF, by which time layout has committed and
	// canvas.clientWidth/Height are populated even if ResizeObserver hasn't
	// fired yet. Protects against initial 0x0 canvas → NaN uResolution.
	requestAnimationFrame(resize);

	// Mouse tracking — stored as normalised 0–1, uploaded as pixel coords so
	// GLSL `uMouse` shares the same coordinate space as `gl_FragCoord.xy`.
	let mouseX = 0.5;
	let mouseY = 0.5;
	function onMouseMove(e: MouseEvent): void {
		const rect = canvas.getBoundingClientRect();
		mouseX = (e.clientX - rect.left) / Math.max(1, rect.width);
		mouseY = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
	}
	canvas.addEventListener("mousemove", onMouseMove);

	// rAF loop
	let rafId = 0;
	let paused = false;
	let startTime = performance.now();
	let lastTime = startTime;

	function frame(now: number): void {
		if (paused) return;
		rafId = requestAnimationFrame(frame);

		const elapsed = (now - startTime) / 1000;
		// delta kept for potential future use; currently only uTime is elapsed
		lastTime = now;

		gl.useProgram(program);
		if (locTime) gl.uniform1f(locTime, elapsed);
		if (locMouse) gl.uniform2f(locMouse, mouseX * canvas.width, mouseY * canvas.height);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	// IntersectionObserver — pause when off-screen
	const io = new IntersectionObserver(
		(entries) => {
			const entry = entries[0];
			if (!entry) return;
			if (entry.isIntersecting) {
				if (paused) {
					paused = false;
					startTime = performance.now() - (lastTime - startTime);
					rafId = requestAnimationFrame(frame);
				}
			} else {
				paused = true;
				cancelAnimationFrame(rafId);
			}
		},
		{ threshold: 0 },
	);
	io.observe(canvas);

	// Kick off the loop
	rafId = requestAnimationFrame(frame);

	// ─── Public API ────────────────────────────────────────────────────────────

	function setUniform(name: string, value: number | number[]): void {
		const loc = uniformLocs.get(name);
		if (!loc) return;
		const type = uniformTypes.get(name);
		if (!type) return;
		values.set(name, value);
		gl.useProgram(program);
		uploadUniform(gl, loc, type, value);
	}

	function setUniforms(cfg: Record<string, number | number[]>): void {
		gl.useProgram(program);
		for (const [name, value] of Object.entries(cfg)) {
			const loc = uniformLocs.get(name);
			if (!loc) continue;
			const type = uniformTypes.get(name);
			if (!type) continue;
			values.set(name, value);
			uploadUniform(gl, loc, type, value);
		}
	}

	function pause(): void {
		if (paused) return;
		paused = true;
		cancelAnimationFrame(rafId);
	}

	function resume(): void {
		if (!paused) return;
		paused = false;
		startTime = performance.now() - (lastTime - startTime);
		rafId = requestAnimationFrame(frame);
	}

	function destroy(): void {
		paused = true;
		cancelAnimationFrame(rafId);
		io.disconnect();
		resizeObserver.disconnect();
		canvas.removeEventListener("mousemove", onMouseMove);
		canvas.removeEventListener("webglcontextlost", handleContextLost);
		canvas.removeEventListener("webglcontextrestored", handleContextRestored);
		gl.deleteProgram(program);
		gl.deleteShader(vs);
		gl.deleteShader(fs);
		if (buf) gl.deleteBuffer(buf);
		// NOTE: do NOT call WEBGL_lose_context.loseContext() here.
		// ShaderCanvas destroys + recreates the runtime on every shader swap
		// (useEffect deps [fragSrc, manifest]); if we killed the context,
		// the next createRuntime call on the same <canvas> would fail its
		// first compileShader with a misleading "vertex shader compile error".
		// Per-shader resources are already freed by deleteProgram/Shader/Buffer.
	}

	return { setUniform, setUniforms, pause, resume, destroy, gl };
}
