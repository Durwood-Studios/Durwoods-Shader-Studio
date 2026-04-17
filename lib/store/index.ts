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

type StudioStore = UniformSlice & ShaderSlice;

const DEFAULT_SHADER_ID = "glass-orb";

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
		}),
		{
			name: "shader-studio:v1",
			partialize: (state) => ({
				uniforms: state.uniforms,
				activeShaderId: state.activeShaderId,
			}),
		},
	),
);
