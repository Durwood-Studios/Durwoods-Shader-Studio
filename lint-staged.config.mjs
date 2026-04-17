const config = {
	"**/*.{ts,tsx,js,jsx}": ["biome check --write", "eslint --max-warnings=0 --no-warn-ignored"],
	"**/*.{md,json,yml,yaml,css}": ["prettier --write"],
	"**/*.{ts,tsx}": [() => "tsc --noEmit"],
};

export default config;
