// lib/shader-loader/index.ts
// Loads a shader manifest + GLSL source by ID.
// Manifests are read from /shaders/<id>/manifest.json via dynamic import.
// GLSL source is fetched from /shaders/<id>/shader.frag (static asset).

import type { ShaderManifest } from "../runtime/index";

export type { ShaderManifest };

export interface LoadedShader {
	manifest: ShaderManifest;
	fragSrc: string;
}

// Zod is listed in the stack but we keep runtime lean — validate the shape
// manually so this module has zero imports from node_modules.
function isShaderManifest(v: unknown): v is ShaderManifest {
	if (!v || typeof v !== "object") return false;
	const m = v as Record<string, unknown>;
	return (
		typeof m.id === "string" &&
		typeof m.version === "number" &&
		typeof m.label === "string" &&
		Array.isArray(m.uniforms)
	);
}

export async function loadShader(id: string): Promise<LoadedShader> {
	// Dynamic import of the JSON manifest (bundler resolves at build time).
	// Next.js treats resolveJsonModule + dynamic import from a known path as
	// a static asset — the literal template here is intentional.
	const manifestModule = (await import(`../../shaders/${id}/manifest.json`)) as {
		default: unknown;
	};

	const raw: unknown = "default" in manifestModule ? manifestModule.default : manifestModule;

	if (!isShaderManifest(raw)) {
		throw new Error(`[shader-loader] Invalid manifest for shader "${id}"`);
	}

	// Fetch GLSL source from the static /public/shaders/<id>/shader.frag route.
	const res = await fetch(`/shaders/${id}/shader.frag`);
	if (!res.ok) {
		throw new Error(
			`[shader-loader] Failed to fetch GLSL for "${id}": ${res.status} ${res.statusText}`,
		);
	}
	const fragSrc = await res.text();

	return { manifest: raw, fragSrc };
}
