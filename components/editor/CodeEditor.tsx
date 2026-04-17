"use client";

import { SHADER_REGISTRY, getRegistryEntry } from "@/lib/shader-registry";
import { useStore } from "@/lib/store";
import type { editor as MonacoEditor, languages } from "monaco-editor";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";

// ── Lazy-load Monaco — NOT included in the main bundle chunk ──────────────────
const MonacoEditorComponent = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center text-neutral-500 text-sm">
			Loading editor…
		</div>
	),
});

// ── Minimal GLSL tokenizer (C-like) ──────────────────────────────────────────

function registerGlslLanguage(monaco: typeof import("monaco-editor")): void {
	const id = "glsl";
	// Only register once
	const langs: { id: string }[] = monaco.languages.getLanguages();
	if (langs.some((l) => l.id === id)) return;

	monaco.languages.register({ id });

	const keywords = [
		"float",
		"vec2",
		"vec3",
		"vec4",
		"mat2",
		"mat3",
		"mat4",
		"int",
		"uint",
		"bool",
		"void",
		"uniform",
		"varying",
		"attribute",
		"precision",
		"highp",
		"mediump",
		"lowp",
		"if",
		"else",
		"for",
		"while",
		"do",
		"break",
		"continue",
		"return",
		"discard",
		"struct",
		"in",
		"out",
		"inout",
		"const",
		"true",
		"false",
	];

	const tokenizer: languages.IMonarchLanguage = {
		keywords,
		tokenizer: {
			root: [
				// Line comment
				[/\/\/.*$/, "comment"],
				// Block comment
				[/\/\*/, "comment", "@comment"],
				// Preprocessor
				[/#\w+/, "keyword"],
				// Numbers: float / int / hex
				[/\d+\.\d*([eE][+-]?\d+)?[fF]?/, "number.float"],
				[/\d+[eE][+-]?\d+[fF]?/, "number.float"],
				[/0[xX][0-9a-fA-F]+/, "number.hex"],
				[/\d+[uU]?/, "number"],
				// Identifiers / keywords
				[
					/[a-zA-Z_]\w*/,
					{
						cases: {
							"@keywords": "keyword",
							"@default": "identifier",
						},
					},
				],
				// Built-in functions hint (gl_*)
				[/gl_\w+/, "variable.predefined"],
				// Strings (GLSL has no strings, but keep for safety)
				[/"([^"\\]|\\.)*"/, "string"],
				// Punctuation
				[/[{}()[\]]/, "@brackets"],
				[/[<>](?!@symbols)/, "@brackets"],
				[/[;,.]/, "delimiter"],
			],
			comment: [
				[/[^/*]+/, "comment"],
				[/\*\//, "comment", "@pop"],
				[/[/*]/, "comment"],
			],
		},
	};

	monaco.languages.setMonarchTokensProvider(id, tokenizer);

	monaco.languages.setLanguageConfiguration(id, {
		comments: {
			lineComment: "//",
			blockComment: ["/*", "*/"],
		},
		brackets: [
			["{", "}"],
			["[", "]"],
			["(", ")"],
		],
		autoClosingPairs: [
			{ open: "{", close: "}" },
			{ open: "[", close: "]" },
			{ open: "(", close: ")" },
		],
	});
}

// ── CodeEditor ────────────────────────────────────────────────────────────────

const FALLBACK_ENTRY =
	SHADER_REGISTRY[0] ??
	(() => {
		throw new Error("SHADER_REGISTRY is empty");
	})();

export function CodeEditor() {
	const activeShaderId = useStore((s) => s.activeShaderId);
	const editedFragSrc = useStore((s) => s.editedFragSrc);
	const compileError = useStore((s) => s.compileError);
	const setEditedFragSrc = useStore((s) => s.setEditedFragSrc);

	const entry = getRegistryEntry(activeShaderId) ?? FALLBACK_ENTRY;
	const originalSrc = entry.fragSrc;

	// Debounce timer ref — 500ms after last keystroke
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Track current editor value via ref to avoid stale closures
	const currentValueRef = useRef<string>(originalSrc);

	// When the active shader changes, clear any pending edit
	useEffect(() => {
		currentValueRef.current = originalSrc;
	}, [originalSrc]);

	const handleChange = useCallback(
		(value: string | undefined) => {
			const src = value ?? "";
			currentValueRef.current = src;
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				setEditedFragSrc(src === originalSrc ? null : src);
			}, 500);
		},
		[originalSrc, setEditedFragSrc],
	);

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const handleRevert = useCallback(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		setEditedFragSrc(null);
	}, [setEditedFragSrc]);

	const handleEditorMount = useCallback(
		(
			editorInstance: MonacoEditor.IStandaloneCodeEditor,
			monacoInstance: typeof import("monaco-editor"),
		) => {
			registerGlslLanguage(monacoInstance);

			// Cmd+S / Ctrl+S → force-flush any pending recompile immediately
			editorInstance.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
				if (debounceRef.current) {
					clearTimeout(debounceRef.current);
					debounceRef.current = null;
				}
				const src = currentValueRef.current;
				setEditedFragSrc(src === originalSrc ? null : src);
			});
		},
		[originalSrc, setEditedFragSrc],
	);

	const isModified = editedFragSrc !== null;
	const hasError = compileError !== null;

	return (
		<div className="flex flex-col h-full bg-[#1e1e1e]">
			{/* ── Toolbar ── */}
			<div className="flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800 shrink-0">
				<button
					type="button"
					onClick={handleRevert}
					disabled={!isModified}
					className={[
						"px-2 py-0.5 rounded text-xs font-medium transition-colors",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
						isModified
							? "bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
							: "bg-transparent text-neutral-600 cursor-not-allowed",
					].join(" ")}
				>
					Revert
				</button>

				{/* Compile status indicator */}
				<div className="flex items-center gap-1.5 ml-auto">
					<span
						className={[
							"w-2 h-2 rounded-full shrink-0",
							hasError ? "bg-red-500" : "bg-green-500",
						].join(" ")}
						aria-label={hasError ? "Compile error" : "Compiled OK"}
					/>
					<span className="text-xs text-neutral-500">
						{hasError ? "Error" : isModified ? "Compiled" : "OK"}
					</span>
				</div>

				<span className="text-xs text-neutral-600 ml-2 hidden lg:block">⌘S to apply</span>
			</div>

			{/* ── Monaco Editor ── */}
			<div className="flex-1 min-h-0">
				<MonacoEditorComponent
					key={activeShaderId}
					defaultLanguage="glsl"
					language="glsl"
					defaultValue={originalSrc}
					theme="vs-dark"
					options={{
						minimap: { enabled: false },
						fontSize: 13,
						fontFamily: "JetBrains Mono, Consolas, monospace",
						tabSize: 2,
						scrollBeyondLastLine: false,
						wordWrap: "on",
						automaticLayout: true,
					}}
					onChange={handleChange}
					onMount={handleEditorMount}
				/>
			</div>

			{/* ── Error panel ── */}
			{hasError && compileError && (
				<div
					role="alert"
					className="shrink-0 border-t border-red-900 bg-red-950/90 px-3 py-2 max-h-[10lh] overflow-y-auto"
				>
					<div className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">
						GLSL Error
					</div>
					<pre className="font-mono text-xs text-red-200 whitespace-pre-wrap leading-relaxed line-clamp-10">
						{compileError}
					</pre>
				</div>
			)}
		</div>
	);
}
