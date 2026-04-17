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

export function compileShader(gl: WebGLRenderingContext, type: GLenum, src: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new ShaderCompileError("createShader returned null", "");

	gl.shaderSource(shader, src);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
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
	const program = gl.createProgram();
	if (!program) throw new ShaderCompileError("createProgram returned null", "");

	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? "(no info log)";
		gl.deleteProgram(program);
		throw new ShaderCompileError("program link error", log);
	}

	return program;
}
