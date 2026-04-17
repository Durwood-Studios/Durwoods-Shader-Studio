const config = {
	"**/*.{ts,tsx,js,jsx}": ["biome check --write"],
	"**/*.{md,json,yml,yaml,css}": ["prettier --write"],
	"**/*.{ts,tsx}": [() => "tsc --noEmit"],
};

export default config;
