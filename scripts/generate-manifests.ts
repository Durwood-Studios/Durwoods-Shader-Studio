#!/usr/bin/env tsx
// scripts/generate-manifests.ts
// Run with: pnpm gen:manifests   (add to package.json: "gen:manifests": "tsx scripts/generate-manifests.ts")
//
// For every directory in shaders-src/:
//   1. Parses shader.frag for @uniform annotation comments
//   2. Writes shaders-src/<id>/manifest.json
//   3. Copies shader.frag → public/shaders/<id>/shader.frag
//   4. Writes lib/shader-loader/registry.generated.ts with SHADER_IDS const

import fs from "node:fs";
import path from "node:path";

// ─── Annotation regex ─────────────────────────────────────────────────────────
// Matches:
//   // @uniform NAME: TYPE, range: [A,B], default: D, label: "X", group: "Y", storage: "uint8"
// All fields after TYPE are optional.

const ANNOTATION_RE =
	/\/\/\s*@uniform\s+(\w+)\s*:\s*(float|vec2|vec3|vec4|int|bool)(?:[\s\S]*?(?:range:\s*\[([^\]]+)\])?[\s\S]*?(?:default:\s*([^\s,]+(?:\s*,\s*[^\s,\]]+)*))?[\s\S]*?(?:label:\s*"([^"]*)")?[\s\S]*?(?:group:\s*"([^"]*)")?[\s\S]*?(?:storage:\s*"(uint8|int16|float32)")?)?\s*$/gm;

type UniformType = "float" | "vec2" | "vec3" | "vec4" | "int" | "bool";
type StorageType = "uint8" | "int16" | "float32";

interface UniformDef {
	name: string;
	type: UniformType;
	default: number | number[];
	range?: [number, number];
	label?: string;
	group?: string;
	storage?: StorageType;
}

interface ShaderManifest {
	id: string;
	version: number;
	label: string;
	uniforms: UniformDef[];
}

function componentCount(type: UniformType): number {
	if (type === "vec2") return 2;
	if (type === "vec3") return 3;
	if (type === "vec4") return 4;
	return 1;
}

function parseDefault(raw: string | undefined, type: UniformType): number | number[] {
	if (!raw) {
		const n = componentCount(type);
		return n === 1 ? 0 : (Array(n).fill(0) as number[]);
	}
	const parts = raw.split(",").map((s) => Number.parseFloat(s.trim()));
	if (componentCount(type) === 1) return parts[0] ?? 0;
	return parts;
}

function parseRange(raw: string | undefined): [number, number] | undefined {
	if (!raw) return undefined;
	const parts = raw.split(",").map((s) => Number.parseFloat(s.trim()));
	const a = parts[0];
	const b = parts[1];
	if (a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b)) return undefined;
	return [a, b];
}

function parseAnnotations(glsl: string, id: string): UniformDef[] {
	const uniforms: UniformDef[] = [];
	// Reset lastIndex for global regex reuse
	ANNOTATION_RE.lastIndex = 0;

	let match = ANNOTATION_RE.exec(glsl);
	while (match !== null) {
		const [, name, typeRaw, rangeRaw, defaultRaw, label, group, storageRaw] = match;

		if (name && typeRaw) {
			const type = typeRaw as UniformType;
			const storage = storageRaw as StorageType | undefined;
			const range = parseRange(rangeRaw);
			const def = parseDefault(defaultRaw, type);

			const uniform: UniformDef = { name, type, default: def };
			if (range) uniform.range = range;
			if (label) uniform.label = label;
			if (group) uniform.group = group;
			if (storage) uniform.storage = storage;

			uniforms.push(uniform);
		}

		match = ANNOTATION_RE.exec(glsl);
	}
	return uniforms;
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const SHADERS_SRC = path.join(ROOT, "shaders-src");
const PUBLIC_SHADERS = path.join(ROOT, "public", "shaders");
const REGISTRY_OUT = path.join(ROOT, "lib", "shader-loader", "registry.generated.ts");

// ─── Main ─────────────────────────────────────────────────────────────────────

function run(): void {
	if (!fs.existsSync(SHADERS_SRC)) {
		console.error(`shaders-src/ not found at ${SHADERS_SRC}`);
		process.exit(1);
	}

	const entries = fs.readdirSync(SHADERS_SRC, { withFileTypes: true });
	const shaderIds: string[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const id = entry.name;
		const fragPath = path.join(SHADERS_SRC, id, "shader.frag");

		if (!fs.existsSync(fragPath)) {
			console.warn(`  [skip] ${id}: no shader.frag found`);
			continue;
		}

		const glsl = fs.readFileSync(fragPath, "utf8");
		const uniforms = parseAnnotations(glsl, id);

		// Read existing manifest to preserve version, or start at 1
		const manifestPath = path.join(SHADERS_SRC, id, "manifest.json");
		let version = 1;
		if (fs.existsSync(manifestPath)) {
			try {
				const existing = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
					version?: unknown;
				};
				if (typeof existing.version === "number") version = existing.version;
			} catch {
				// corrupt — reset to 1
			}
		}

		const manifest: ShaderManifest = {
			id,
			version,
			label: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			uniforms,
		};

		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
		console.log(`  [manifest] ${id}/manifest.json (${uniforms.length} uniforms)`);

		// Copy shader.frag to public/shaders/<id>/shader.frag
		const pubDir = path.join(PUBLIC_SHADERS, id);
		fs.mkdirSync(pubDir, { recursive: true });
		fs.copyFileSync(fragPath, path.join(pubDir, "shader.frag"));
		console.log(`  [copy]     public/shaders/${id}/shader.frag`);

		shaderIds.push(id);
	}

	// Write registry
	const registryContent = [
		"// AUTO-GENERATED by scripts/generate-manifests.ts — do not edit manually.",
		`// Last generated: ${new Date().toISOString()}`,
		"",
		"export const SHADER_IDS = [",
		...shaderIds.map((id) => `  "${id}",`),
		"] as const;",
		"",
		"export type ShaderId = (typeof SHADER_IDS)[number];",
		"",
	].join("\n");

	fs.mkdirSync(path.dirname(REGISTRY_OUT), { recursive: true });
	fs.writeFileSync(REGISTRY_OUT, registryContent);
	console.log(`  [registry] lib/shader-loader/registry.generated.ts (${shaderIds.length} shaders)`);

	console.log(`\nDone. Processed ${shaderIds.length} shader(s).`);
}

run();
