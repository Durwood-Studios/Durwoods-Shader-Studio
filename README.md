# Shader Studio

Browser-based fragment shader studio. Fork, tweak, export — sub-5 KB gzipped.

Source of truth: [PLANNING.md](./PLANNING.md)

## Setup

Requires **Node 22+**.

```sh
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                 | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Start dev server (webpack)                      |
| `npm run build`         | Production build                                |
| `npm run lint`          | Biome check                                     |
| `npm run lint:fix`      | Biome check with auto-fix                       |
| `npm run typecheck`     | TypeScript check                                |
| `npm run format`        | Biome + Prettier write                          |
| `npm run check`         | Lint + format check + typecheck (CI-equivalent) |
| `npm run gen:manifests` | Regenerate shader manifests                     |
| `npm run size`          | Check bundle size budgets                       |
| `npm run ver:large`     | Bump version +1.0 (large development)           |
| `npm run ver:small`     | Bump version +0.01 (small iteration)            |

## Pre-commit

Every commit runs: Biome (lint + format on TS/JS), Prettier (on MD/JSON/YAML/CSS),
then a full `tsc --noEmit` and repo-wide `biome check`. Bypassing is disallowed.

---

Created with love by **Durwood Studios**.
