// lib/sandbox/index.ts
// Main-thread wrapper for the sandbox Web Worker.
// Spawns a worker, handles timeout, resolves with ok/error.

import type { ShaderManifest } from "../runtime/index";

export type CompileResult = { ok: true } | { ok: false; error: string };

// The worker is imported as a Worker URL via Next.js's built-in
// `new Worker(new URL(..., import.meta.url))` pattern.
// This keeps the worker in its own bundle chunk.

const TIMEOUT_MS = 1500; // generous main-thread timeout (worker has its own 500 ms watchdog)

export function compileInWorker(fragSrc: string, manifest: ShaderManifest): Promise<CompileResult> {
	return new Promise<CompileResult>((resolve) => {
		let settled = false;
		let worker: Worker | null = null;

		function settle(result: CompileResult): void {
			if (settled) return;
			settled = true;
			clearTimeout(timerId);
			if (worker) {
				worker.terminate();
				worker = null;
			}
			resolve(result);
		}

		const timerId = setTimeout(() => {
			settle({ ok: false, error: "Shader compile timed out (main thread)" });
		}, TIMEOUT_MS);

		try {
			worker = new Worker(new URL("./worker.ts", import.meta.url), {
				type: "module",
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to spawn worker";
			settle({ ok: false, error: msg });
			return;
		}

		worker.onmessage = (evt: MessageEvent<unknown>) => {
			const data = evt.data;
			if (!data || typeof data !== "object") {
				settle({ ok: false, error: "Unexpected worker response" });
				return;
			}
			const d = data as Record<string, unknown>;

			if (d.type === "ready") {
				settle({ ok: true });
			} else if (d.type === "error") {
				const info = typeof d.info === "string" ? d.info : "Compile error";
				settle({ ok: false, error: info });
			} else if (d.type === "timeout") {
				settle({ ok: false, error: "Shader compile timed out (worker watchdog)" });
			} else {
				settle({ ok: false, error: "Unknown worker message type" });
			}
		};

		worker.onerror = (evt: ErrorEvent) => {
			settle({ ok: false, error: evt.message || "Worker error" });
		};

		// Send the compile job
		worker.postMessage({ fragSrc, manifest });
	});
}
