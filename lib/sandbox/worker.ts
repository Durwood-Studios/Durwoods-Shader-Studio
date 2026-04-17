// lib/sandbox/worker.ts
// Web Worker: receives { fragSrc, manifest }, sets up OffscreenCanvas + runtime,
// posts {type:'ready'} or {type:'error', info} or {type:'timeout'} then terminates.
// 500 ms compile watchdog guards against GPU hangs.

import type { ShaderManifest } from "../runtime/index";
import { ShaderCompileError, createRuntime } from "../runtime/index";

// ─── Message shapes ───────────────────────────────────────────────────────────

interface InboundMessage {
	fragSrc: string;
	manifest: ShaderManifest;
}

type OutboundMessage = { type: "ready" } | { type: "error"; info: string } | { type: "timeout" };

// ─── Watchdog ─────────────────────────────────────────────────────────────────

const WATCHDOG_MS = 500;
const watchdog = setTimeout(() => {
	const msg: OutboundMessage = { type: "timeout" };
	self.postMessage(msg);
	self.close();
}, WATCHDOG_MS);

// ─── Worker entry ─────────────────────────────────────────────────────────────

self.onmessage = (evt: MessageEvent<unknown>) => {
	// Narrow the unknown message
	const data = evt.data;
	if (
		!data ||
		typeof data !== "object" ||
		!("fragSrc" in data) ||
		!("manifest" in data) ||
		typeof (data as Record<string, unknown>).fragSrc !== "string"
	) {
		clearTimeout(watchdog);
		const msg: OutboundMessage = { type: "error", info: "Invalid worker message" };
		self.postMessage(msg);
		self.close();
		return;
	}

	const { fragSrc, manifest } = data as InboundMessage;

	try {
		// OffscreenCanvas is available in Workers in modern browsers.
		const canvas = new OffscreenCanvas(1, 1);

		// createRuntime compiles shaders synchronously — if it throws, we catch below.
		// The runtime's rAF loop won't run in a worker (no requestAnimationFrame),
		// which is fine: we only need compile success/failure here.
		const runtime = createRuntime(
			// OffscreenCanvas doesn't extend HTMLCanvasElement but the WebGL context
			// acquisition interface is identical; cast is intentional and safe.
			canvas as unknown as HTMLCanvasElement,
			{ fragSrc, manifest },
		);

		clearTimeout(watchdog);

		// Immediately destroy — we have no rendering use here.
		runtime.destroy();

		const msg: OutboundMessage = { type: "ready" };
		self.postMessage(msg);
	} catch (err) {
		clearTimeout(watchdog);

		let info = "Unknown compile error";
		if (err instanceof ShaderCompileError) {
			info = err.infoLog || err.message;
		} else if (err instanceof Error) {
			info = err.message;
		}

		const msg: OutboundMessage = { type: "error", info };
		self.postMessage(msg);
	}

	self.close();
};
