"use client";

// v0.1 stub — Monaco integration is scoped to v0.2.
// The real editor is lazy-loaded via dynamic(() => import('@monaco-editor/react'), { ssr: false })
// only when the Code tab is active.

export function CodeEditor() {
	return (
		<div className="flex h-full items-center justify-center p-8 text-center">
			<div>
				<p className="text-sm font-medium text-neutral-400">Code tab — v0.2</p>
				<p className="mt-1 text-xs text-neutral-600">
					Monaco GLSL editor with hot-reload arrives in the next milestone.
				</p>
			</div>
		</div>
	);
}
