# Shader Studio

Browser-based fragment shader studio. Fork, tweak, export — sub-5 KB gzipped.

Source of truth: [PLANNING.md](./shader-studio_PLANNING.md)

## Setup

```sh
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start dev server (webpack)                            |
| `pnpm build`        | Production build                                      |
| `pnpm lint`         | Biome check                                           |
| `pnpm typecheck`    | TypeScript check                                      |
| `pnpm format`       | Biome + Prettier write                                |
| `pnpm check`        | Lint + format check + typecheck (CI-equivalent)       |
| `pnpm gen:manifests`| Regenerate shader manifests                           |
| `pnpm size`         | Check bundle size budgets                             |
| `pnpm ver:large`    | Bump version +1.0 (large development)                 |
| `pnpm ver:small`    | Bump version +0.01 (small iteration)                  |

## Pre-commit

Every commit runs: Biome (lint + format on TS/JS), Prettier (on MD/JSON/YAML/CSS),
then a full `tsc --noEmit` and repo-wide `biome check`. Bypassing is disallowed.

---

Created with love by **Durwood Studios**.
