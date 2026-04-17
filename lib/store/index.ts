import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UniformValue = number | number[];

interface UniformSlice {
	uniforms: Record<string, UniformValue>;
	setUniform: (name: string, value: UniformValue) => void;
	setUniforms: (cfg: Record<string, UniformValue>) => void;
	resetUniforms: (defaults: Record<string, UniformValue>) => void;
}

interface ShaderSlice {
	activeShaderId: string;
	setActiveShaderId: (id: string) => void;
}

// ── Feature 1: Monaco edited GLSL source ──────────────────────────────────────

interface EditorSlice {
	editedFragSrc: string | null;
	setEditedFragSrc: (src: string | null) => void;
	compileError: string | null;
	setCompileError: (err: string | null) => void;
}

// ── Feature 2: Text overlay ───────────────────────────────────────────────────

export interface TextOverlayState {
	enabled: boolean;
	headline: string;
	subtitle: string;
	alignment: "center" | "left" | "right";
	theme: "light-text" | "dark-text";
}

interface TextOverlaySlice {
	textOverlay: TextOverlayState;
	setTextOverlay: (partial: Partial<TextOverlayState>) => void;
}

// ── Feature 3: Perf HUD ───────────────────────────────────────────────────────

interface PerfSlice {
	perfHud: boolean;
	setPerfHud: (on: boolean) => void;
}

type StudioStore = UniformSlice & ShaderSlice & EditorSlice & TextOverlaySlice & PerfSlice;

const DEFAULT_SHADER_ID = "glass-orb";

const DEFAULT_TEXT_OVERLAY: TextOverlayState = {
	enabled: false,
	headline: "Fluid Design Excellence",
	subtitle:
		"Experience the future of web interfaces — liquid metal aesthetics that adapt, flow, and captivate.",
	alignment: "center",
	theme: "light-text",
};

export const useStore = create<StudioStore>()(
	persist(
		(set) => ({
			// Uniform slice
			uniforms: {},
			setUniform: (name, value) =>
				set((state) => ({
					uniforms: { ...state.uniforms, [name]: value },
				})),
			setUniforms: (cfg) =>
				set((state) => ({
					uniforms: { ...state.uniforms, ...cfg },
				})),
			resetUniforms: (defaults) => set({ uniforms: { ...defaults } }),

			// Shader slice
			activeShaderId: DEFAULT_SHADER_ID,
			setActiveShaderId: (id) => set({ activeShaderId: id }),

			// Editor slice
			editedFragSrc: null,
			setEditedFragSrc: (src) => set({ editedFragSrc: src }),
			compileError: null,
			setCompileError: (err) => set({ compileError: err }),

			// Text overlay slice
			textOverlay: DEFAULT_TEXT_OVERLAY,
			setTextOverlay: (partial) =>
				set((state) => ({
					textOverlay: { ...state.textOverlay, ...partial },
				})),

			// Perf HUD slice — default on in dev, off in prod
			perfHud: process.env.NODE_ENV !== "production",
			setPerfHud: (on) => set({ perfHud: on }),
		}),
		{
			name: "shader-studio:v1",
			partialize: (state) => ({
				uniforms: state.uniforms,
				activeShaderId: state.activeShaderId,
				// Do not persist editedFragSrc or compileError across sessions
				textOverlay: state.textOverlay,
				perfHud: state.perfHud,
			}),
		},
	),
);
