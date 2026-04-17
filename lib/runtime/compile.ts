// lib/runtime/compile.ts
// Low-level WebGL shader compilation helpers — no dependencies.

export class ShaderCompileError extends Error {
	constructor(
		message: string,
		public readonly infoLog: string,
	) {
		super(message);
		this.name = "ShaderCompileError";
	}
}

/**
 * Thrown when the WebGL context is lost (GPU reset, tab suspended, context
 * killed by a prior runtime, etc). Callers should treat this as RECOVERABLE:
 * the <canvas> element needs to be remounted or the context explicitly
 * restored via WEBGL_lose_context.restoreContext(). Never shown to the user
 * as a "compile error" — the shader source itself is fine.
 */
export class ContextLostError extends Error {
	constructor(message = "WebGL context is lost") {
		super(message);
		this.name = "ContextLostError";
	}
}

/**
 * Throws ContextLostError if the given WebGL context is not usable.
 * Call before ANY compile/link/draw operation to prevent opaque errors.
 */
export function assertContextAlive(gl: WebGLRenderingContext): void {
	if (gl.isContextLost()) {
		throw new ContextLostError();
	}
}

export function compileShader(gl: WebGLRenderingContext, type: GLenum, src: string): WebGLShader {
	assertContextAlive(gl);

	const shader = gl.createShader(type);
	if (!shader) {
		// createShader returns null when the context is lost OR on OOM.
		// Re-check to differentiate.
		if (gl.isContextLost()) throw new ContextLostError();
		throw new ShaderCompileError("createShader returned null", "");
	}

	gl.shaderSource(shader, src);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		// A failed compile on a lost context returns misleading info logs
		// (often empty or "vertex shader compile error"). Always re-check.
		if (gl.isContextLost()) {
			gl.deleteShader(shader);
			throw new ContextLostError();
		}
		const log = gl.getShaderInfoLog(shader) ?? "(no info log)";
		gl.deleteShader(shader);
		const typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
		throw new ShaderCompileError(`${typeName} shader compile error`, log);
	}

	return shader;
}

export function linkProgram(
	gl: WebGLRenderingContext,
	vs: WebGLShader,
	fs: WebGLShader,
): WebGLProgram {
	assertContextAlive(gl);

	const program = gl.createProgram();
	if (!program) {
		if (gl.isContextLost()) throw new ContextLostError();
		throw new ShaderCompileError("createProgram returned null", "");
	}

	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		if (gl.isContextLost()) {
			gl.deleteProgram(program);
			throw new ContextLostError();
		}
		const log = gl.getProgramInfoLog(program) ?? "(no info log)";
		gl.deleteProgram(program);
		throw new ShaderCompileError("program link error", log);
	}

	return program;
}
