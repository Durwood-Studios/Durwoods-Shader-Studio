import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
	// Global ignores — must be a standalone object with only `ignores`
	{
		ignores: [
			".next/**",
			"node_modules/**",
			"public/**",
			"*.generated.ts",
			"next-env.d.ts",
			"eslint.config.mjs",
			"lint-staged.config.mjs",
			"postcss.config.mjs",
			"next.config.ts",
		],
	},
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		// Only keep Next-specific rules — Biome handles style/formatting/imports.
		rules: {
			"@typescript-eslint/no-unused-vars": "off", // Biome handles
			"@typescript-eslint/no-explicit-any": "off", // Biome handles
			"react/no-unescaped-entities": "off",
			"react-hooks/exhaustive-deps": "warn", // keep, useful
		},
	},
];
