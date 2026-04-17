// lib/url-codec/index.ts
// Binary-packed base64url codec. No dependencies. Vanilla TS strict.
// Format: `${shaderId}#v${version}.${base64url(packedBytes)}`

import type { ShaderManifest, UniformDef } from "../runtime/index";

// ─── base64url (RFC 4648 §5, no padding) ─────────────────────────────────────

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
	let out = "";
	const len = bytes.length;
	let i = 0;
	while (i < len) {
		const b0 = bytes[i++] ?? 0;
		const b1 = i < len ? (bytes[i++] ?? 0) : 0;
		const b2 = i < len ? (bytes[i++] ?? 0) : 0;
		out += B64_CHARS[b0 >> 2] ?? "";
		out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)] ?? "";
		out += B64_CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] ?? "";
		out += B64_CHARS[b2 & 0x3f] ?? "";
	}
	// Trim to exact length (no padding)
	const extra = len % 3;
	return extra === 0 ? out : out.slice(0, out.length - (3 - extra));
}

function fromBase64Url(s: string): Uint8Array {
	const lookup = new Uint8Array(128).fill(255);
	for (let i = 0; i < B64_CHARS.length; i++) {
		lookup[B64_CHARS.charCodeAt(i)] = i;
	}

	// Restore padding to a multiple of 4
	const padded = s + "===".slice(0, (4 - (s.length % 4)) % 4);
	const byteLen = Math.floor((padded.length * 3) / 4);
	const out = new Uint8Array(byteLen);
	let pos = 0;

	for (let i = 0; i < padded.length; i += 4) {
		const a = lookup[padded.charCodeAt(i)] ?? 0;
		const b = lookup[padded.charCodeAt(i + 1)] ?? 0;
		const c = lookup[padded.charCodeAt(i + 2)] ?? 0;
		const d = lookup[padded.charCodeAt(i + 3)] ?? 0;
		out[pos++] = (a << 2) | (b >> 4);
		if (pos < byteLen) out[pos++] = ((b & 0xf) << 4) | (c >> 2);
		if (pos < byteLen) out[pos++] = ((c & 3) << 6) | d;
	}
	return out;
}

// ─── Storage sizing ───────────────────────────────────────────────────────────

function componentCount(type: UniformDef["type"]): number {
	if (type === "float" || type === "int" || type === "bool") return 1;
	if (type === "vec2") return 2;
	if (type === "vec3") return 3;
	if (type === "vec4") return 4;
	return 1;
}

function bytesPerComponent(storage: UniformDef["storage"]): number {
	if (storage === "int16") return 2;
	if (storage === "float32") return 4;
	return 1; // uint8 default
}

function totalBytes(manifest: ShaderManifest): number {
	let total = 0;
	for (const u of manifest.uniforms) {
		total += componentCount(u.type) * bytesPerComponent(u.storage);
	}
	return total;
}

// ─── Pack ─────────────────────────────────────────────────────────────────────

function packValue(
	view: DataView,
	offset: number,
	storage: UniformDef["storage"],
	range: [number, number] | undefined,
	raw: number,
): number {
	if (storage === "float32") {
		view.setFloat32(offset, raw, true);
		return offset + 4;
	}
	if (storage === "int16") {
		view.setInt16(offset, Math.round(raw), true);
		return offset + 2;
	}
	// uint8: normalise within range [A, B] → [0, 255]
	const lo = range?.[0] ?? 0;
	const hi = range?.[1] ?? 1;
	const norm = hi === lo ? 0 : (raw - lo) / (hi - lo);
	view.setUint8(offset, Math.round(Math.max(0, Math.min(1, norm)) * 255));
	return offset + 1;
}

function unpackValue(
	view: DataView,
	offset: number,
	storage: UniformDef["storage"],
	range: [number, number] | undefined,
): [number, number] {
	if (storage === "float32") {
		return [view.getFloat32(offset, true), offset + 4];
	}
	if (storage === "int16") {
		return [view.getInt16(offset, true), offset + 2];
	}
	// uint8
	const byte = view.getUint8(offset);
	const lo = range?.[0] ?? 0;
	const hi = range?.[1] ?? 1;
	const value = lo + (byte / 255) * (hi - lo);
	return [value, offset + 1];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function encode(
	shaderId: string,
	version: number,
	manifest: ShaderManifest,
	config: Record<string, number | number[]>,
): string {
	const buf = new ArrayBuffer(totalBytes(manifest));
	const view = new DataView(buf);
	let offset = 0;

	for (const u of manifest.uniforms) {
		const raw = config[u.name] ?? u.default;
		const components = componentCount(u.type);

		if (components === 1) {
			offset = packValue(view, offset, u.storage, u.range, raw as number);
		} else {
			const arr = raw as number[];
			for (let i = 0; i < components; i++) {
				offset = packValue(view, offset, u.storage, u.range, arr[i] ?? 0);
			}
		}
	}

	const bytes = new Uint8Array(buf);
	return `${shaderId}#v${version}.${toBase64Url(bytes)}`;
}

export function decode(
	hash: string,
	manifest: ShaderManifest,
): { shaderId: string; version: number; config: Record<string, number | number[]> } | null {
	try {
		const hashIdx = hash.indexOf("#v");
		if (hashIdx === -1) return null;

		const shaderId = hash.slice(0, hashIdx);
		const rest = hash.slice(hashIdx + 2); // after "#v"
		const dotIdx = rest.indexOf(".");
		if (dotIdx === -1) return null;

		const version = Number.parseInt(rest.slice(0, dotIdx), 10);
		if (Number.isNaN(version)) return null;

		if (version !== manifest.version) {
			console.warn(
				`[url-codec] version mismatch: URL has v${version}, manifest has v${manifest.version}. Falling back to defaults.`,
			);
			const defaults: Record<string, number | number[]> = {};
			for (const u of manifest.uniforms) defaults[u.name] = u.default;
			return { shaderId, version: manifest.version, config: defaults };
		}

		const b64 = rest.slice(dotIdx + 1);
		const bytes = fromBase64Url(b64);
		const view = new DataView(bytes.buffer);
		let offset = 0;

		const config: Record<string, number | number[]> = {};

		for (const u of manifest.uniforms) {
			const components = componentCount(u.type);
			if (components === 1) {
				const [val, next] = unpackValue(view, offset, u.storage, u.range);
				config[u.name] = val;
				offset = next;
			} else {
				const arr: number[] = [];
				for (let i = 0; i < components; i++) {
					const [val, next] = unpackValue(view, offset, u.storage, u.range);
					arr.push(val);
					offset = next;
				}
				config[u.name] = arr;
			}
		}

		return { shaderId, version, config };
	} catch {
		return null;
	}
}
