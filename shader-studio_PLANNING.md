# shader-studio — Master Build Plan

> **Paste this as `PLANNING.md` at the repo root.** It is the durable source of truth. Every Claude Code session starts by reading it. Every PR that changes scope updates it.

---

## 0. North star

A browser-based shader studio where you can fork, tweak, and export fragment shaders in under two minutes. Built for personal use, deployed to Vercel's free tier.

One sentence to ship: **"Copy, tweak, export. Any WebGL hero effect, sub-5 KB gzipped."**

Three things that must be true at every checkpoint:
1. **It feels instant.** 60 fps on a 2022 MacBook. Slider drag latency under 16 ms. Time-to-first-render under 1.5 s on a cold 4G connection.
2. **Exports are tiny.** Sub-5 KB gzipped for a standard component. Raw WebGL 1 + React, zero runtime deps beyond React itself.
3. **It's safe to use.** User-authored GLSL runs in a Web Worker sandbox with a watchdog. The app itself never phones home with user code.

Non-goals — say no even when tempting:
- User accounts, auth, databases. All state is URL-encoded or localStorage.
- npm package publication, custom domain, marketing site. The Vercel hobby URL IS the product.
- 3D mesh loading, glTF, scene graphs. Fragment shaders only.
- AI shader generation. Later, maybe.
- Mobile authoring. Viewing OK; sliders are desktop-first.

---

## 1. What ships

A single Next.js 15 app deployed to `shader-studio-<handle>.vercel.app` with a three-pane layout:

- **Left rail:** shader library. Built-in shaders (glass-orb, liquid-chrome, mesh-gradient, metaballs, iridescent-ribbons) and anything forked locally.
- **Center:** the live canvas. Full-bleed, DPR-capped at 2, IntersectionObserver pausing when off-screen.
- **Right rail:** two tabs. **Controls** (auto-generated sliders) and **Code** (Monaco GLSL editor). Slider changes update uniforms at 60 fps; code edits hot-reload the canvas sub-100 ms.

Below the canvas: an Export drawer with three tabs — **Component** (ready-to-paste React TSX), **Config** (JSON), **Embed** (iframe snippet that points back to a shareable URL). A "Share" button copies a URL that encodes the full state.

---

## 2. Stack (decisions, not options)

Every choice below has a reason. If you want to change one, update this doc first.

| Layer | Pick | Why |
|---|---|---|
| Framework | **Next.js 15.x App Router, TypeScript strict** | Already known stack from Turblu. |
| Build tool | **Webpack (Next 15 default, not Turbopack)** | Turbopack still has WebGL source-map edge cases. |
| Runtime | **Node 22 LTS** | Current LTS. |
| UI primitives | **shadcn/ui + Tailwind v4** | Copy-paste, owned code, zero vendor lock. |
| Code editor | **`@monaco-editor/react`** | Industry-standard GLSL editing. Lazy-loaded only when Code tab opens. |
| Rendering | **Raw WebGL 1, no three.js, no R3F, no OGL** | Non-negotiable. Export weight moat. |
| State (app) | **Zustand** with `persist` → localStorage | No provider trees. Canvas state in refs, never triggers re-renders. |
| State (URL) | **Custom URL codec** (binary-packed base64) | Shared URLs stay under 400 chars. |
| Validation | **Zod** for uniform manifests | Every uniform's range is a schema, auto-generates slider config. |
| Icons | **Lucide React** | Tree-shaken, matches your brand elsewhere. |
| Package manager | **pnpm** | Fast, strict, disk-efficient. |
| Linter | **Biome** | 30x faster than ESLint, single config. |
| Pre-commit | **Husky + lint-staged** | `tsc --noEmit` + `biome check` before every commit. |
| Hosting | **Vercel (free hobby tier)** | No domain, use the default `*.vercel.app` URL. |

---

## 3. Architecture

### 3.1 Layout

Single Next.js app, no monorepo overhead.

```
shader-studio/
  app/                            # Next.js App Router
    layout.tsx
    page.tsx                      # the three-pane studio
    s/[shareId]/page.tsx          # shareable preset URLs
  components/
    studio/                       # layout, toolbar, drawer
    shaders-library/              # left-rail shader list
    controls/                     # right-rail slider generator
    editor/                       # right-rail Monaco wrapper (lazy)
    canvas/                       # the center-pane WebGL surface
    export/                       # the export drawer (component, config, embed)
    ui/                           # shadcn components
  lib/
    runtime/                      # the ~1.5 KB WebGL runtime
    url-codec/                    # binary-packed URL state
    sandbox/                      # Web Worker for user GLSL
    shader-loader/                # reads manifest, builds uniform forms
  shaders-src/                    # GLSL source of truth
    glass-orb/
      shader.frag                 # GLSL with uniform annotations
      manifest.json               # generated from annotations
      README.md                   # authoring notes, visual reference
    liquid-chrome/
    ...
  scripts/
    generate-manifests.ts         # GLSL annotations → manifest.json + TS types
```

### 3.2 The shader runtime

`lib/runtime/` is the ~1.5 KB module every export depends on. It does four things:

1. Compile a vertex + fragment shader pair
2. Bind a fullscreen quad
3. Resolve uniforms from a typed config object using the shader's manifest
4. Run an rAF loop with pause-on-hidden, ResizeObserver, and DPR capping

Every exported component is `runtime + shader string + uniform mapping`. This is the performance moat. Guard it.

### 3.3 State model

Three layers, each with a clear owner:

- **Canvas state** (time, mouse, resize) — refs only, never triggers React renders
- **Uniform state** (slider values) — Zustand, subscribed by the runtime via `getState`, slider updates don't re-render the UI
- **Editor state** (GLSL source, active tab, dirty flags) — Zustand, subscribed by React components

Dragging a slider is a pure WebGL uniform update. This is how we hit 60 fps on complex shaders.

### 3.4 URL state codec

URLs look like `/s/glass-orb#v1.KzE2MC4zMi4x...` — shader ID + version + binary-packed base64 payload.

- Each uniform's manifest declares storage precision (uint8, int16, float32)
- A pack function flattens the config into a typed-array and base64's it
- Unpack hydrates on load; if the shader schema has drifted, fall back to defaults with one console warning

Target: **under 400 chars per shader** so URLs survive Twitter, Slack, Discord truncation.

### 3.5 The shader authoring format

Every shader in `shaders-src/<name>/` has two committed files:

**`shader.frag`** — GLSL source with annotation comments:
```glsl
// @uniform ior: float, range: [1.0, 2.0], default: 1.48, label: "IOR", group: "Glass"
uniform float uIOR;
```

**`README.md`** — authoring notes, visual reference image, performance notes.

A build step (`pnpm gen:manifests`) parses the annotations and generates:
- `manifest.json` (single source of truth for controls UI, URL packing)
- TypeScript types for the config object
- The entry in the shader library

One source, three outputs.

---

## 4. Security (non-negotiable)

### 4.1 User-authored GLSL

Users can write arbitrary fragment shaders in the Code tab. Fragment shaders can't access the DOM, network, or filesystem, but they can hang the GPU via infinite loops. Mitigations:

- **User GLSL runs in an OffscreenCanvas inside a Web Worker** with a 500 ms watchdog that terminates on unresponsiveness
- **`WEBGL_lose_context` on compile errors**, full recovery flow documented
- **Reject shaders that declare textures in v1** (textures are built-in shaders only)
- **No `eval`, no `new Function`, no dynamic `require`.** GLSL strings are passed to `shaderSource()`. That's it.

### 4.2 CSP

Strict Content Security Policy on the app:

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

- `wasm-unsafe-eval` is for Monaco's WebAssembly
- `frame-ancestors 'none'` means the app can't be iframed

### 4.3 No data leaves the browser

- **No cookies.** None.
- **No analytics** in v1. If you add them later, pick a cookie-free option.
- **User GLSL is localStorage only** unless the user explicitly clicks "Share" — which encodes to URL locally, no POST.
- **Share URLs only encode built-in shader IDs + uniform values.** Custom GLSL is never transmitted via URL. Sharing a custom shader requires the user to paste the source to the recipient directly (via GitHub Gist, a chat, whatever).

This is the single most important security decision. Read it twice. A malicious share link cannot ship arbitrary code to someone's browser.

### 4.4 Supply chain

- **pnpm with `--frozen-lockfile`** in CI
- **`pnpm audit`** on every PR
- **No `postinstall` scripts** allowed; enforced via `pnpm.onlyBuiltDependencies` allowlist
- **Renovate or Dependabot** for dependency updates, grouped weekly

---

## 5. Performance (the bar)

These are acceptance criteria. A PR that regresses any of them is not merged.

- **Lighthouse performance ≥ 95** on desktop, ≥ 85 on mobile
- **LCP ≤ 1.5 s** on simulated 4G
- **First canvas paint ≤ 800 ms** after LCP
- **Slider drag latency ≤ 16 ms** (single frame)
- **Monaco lazy-load ≤ 300 ms** after tab switch
- **Zero layout shift** (CLS = 0)
- **Gzipped export component ≤ 5 KB** for any built-in shader
- **60 fps sustained** on M1 MacBook Air; ≥ 45 fps on iPhone 12

Enforcement:
- **`size-limit`** in CI on the export runtime
- **Lighthouse CI** on every PR, blocks on regression

---

## 6. Accessibility (keep the bar up)

- **`prefers-reduced-motion`** freezes all shader animation (time frozen, rotation frozen, cursor tilt still works)
- **Keyboard-operable number input** for every slider
- **Color contrast** on all UI ≥ 4.5:1
- **Visible focus indicators** on every interactive element
- **axe-core** automated check on every PR

---

## 7. Roadmap

### v0.1 — "Hello, orb" (Week 1)
- Next.js 15 app scaffolded, Vercel deployed at `shader-studio-<handle>.vercel.app`
- `lib/runtime/` working (~1 KB WebGL runtime)
- One shader: `glass-orb` (port from the playground we already built)
- Three-pane layout, Controls tab only (no Code tab yet)
- URL state codec working
- CI green: lint, typecheck, build, size-limit

### v0.2 — "The Code tab" (Week 2)
- Monaco editor integrated, lazy-loaded
- Hot-reload on GLSL edit
- Web Worker sandbox for user GLSL with watchdog
- Error overlays for compile failures
- Three more built-in shaders: liquid-chrome, mesh-gradient, metaballs

### v0.3 — "Share + Export" (Week 3)
- Shareable URL flow
- Export drawer: Component (TSX), Config (JSON), Embed (iframe snippet)
- "Copy as download" option
- `prefers-reduced-motion` audit

### v0.4 — "Polish" (Week 4)
- Performance audit against §5 budgets
- Accessibility audit (axe-core clean)
- Two more shaders: iridescent-ribbons, ferro-fluid
- Done. Done-done.

---

## 8. Development workflow

Copied from the Turblu dev loop. Do not deviate without updating this doc.

### 8.1 Two interfaces

- **Claude (web chat):** planning, architecture, prompting strategy, decisions. Where we think.
- **Claude Code (in VS Code):** live codebase access, implementation. Where we execute.

Dustin uses Claude Web specifically to write and refine prompts for Claude Code. When Claude Code gets stuck, bring it back to Claude Web for better prompt wording.

### 8.2 Standing rules for every Claude Code prompt

Every Claude Code prompt ends with these exact instructions:

```
RULES:
- READ before WRITE. Never invent APIs, columns, props, imports, or file paths.
- Read dependencies of any file you intend to edit first.
- No speculative imports. If you don't know the path, grep.
- Two-step pattern: Step 1 research (read-only), Step 2 implementation.
- Step 0 in any implementation: read existing patterns in the file before writing new code.
- Do NOT commit. Report what changed with a diff. Await human review.
- If you add a `// TODO:` inline, mention it in the summary. Never act on a TODO in the same session.
- Run the build (`pnpm build`) and tests (`pnpm test`) before reporting "done". Do not claim a fix without verifying.
- Commit messages, when later requested, must be descriptive and multi-line.
```

### 8.3 The loop

1. Discuss architecture in Claude Web → produce a targeted prompt
2. Run prompt in Claude Code → paste findings back
3. Analyze results, write implementation prompt → include "Do NOT commit. Report what changed."
4. Claude Code executes → user reports results
5. Claude Web writes the commit message
6. Branch → feature PR → GitHub Actions CI → merge → Vercel auto-deploys

### 8.4 Branch conventions

- Branch prefixes: `feature/`, `fix/`, `perf/`, `chore/`, `security/`
- Protected `main`: require CI to pass before merge
- All PRs auto-deploy a preview via Vercel; preview URL appears as a PR comment

---

## 9. The first Claude Code prompt

When you open VS Code, the very first prompt is this. Nothing before it.

```
You are helping bootstrap a new project called "shader-studio."

The authoritative spec is in PLANNING.md at the repo root. Before you do
anything else:

1. Read PLANNING.md in full. Stop and ask for clarification on any point
   that conflicts with common practice or that you can't reconcile.

2. Once you've confirmed understanding, in a single response, produce a
   shell script `scripts/bootstrap.sh` that:

   a. Initializes a pnpm project with the folder structure in PLANNING.md §3.1.
   b. Creates a minimal Next.js 15 app with App Router and TypeScript strict.
   c. Installs: tailwindcss v4, zustand, zod, lucide-react, @monaco-editor/react.
      Dev: biome, husky, lint-staged, size-limit, @size-limit/preset-small-lib.
   d. Creates biome.json at the root with the shared config.
   e. Creates .github/workflows/ci.yml: lint, typecheck, build, size-limit.
   f. Sets up Husky + lint-staged for pre-commit hooks
      (tsc --noEmit + biome check).
   g. Creates a top-level README.md that is intentionally terse, linking
      to PLANNING.md as the source of truth.
   h. Prints a final checklist of manual steps: create GitHub repo, push,
      connect Vercel project, etc.

3. Do NOT run the script. Do NOT commit. Show me the script and wait for
   approval.

RULES:
- READ before WRITE. The script is your only artifact right now.
- No dependencies I don't see justified in PLANNING.md.
- Pin every tool version exactly.
- If PLANNING.md is ambiguous on any decision, ask. Do not guess.
```

That's the entry point. Every subsequent prompt follows §8.3.

---

## 10. A living document

This file is the project's constitution. Update it when:

- A stack decision changes (§2)
- A security rule changes (§4)
- A performance budget changes (§5)
- The roadmap changes (§7)

Every Claude Code session starts with "read PLANNING.md." Every PR that changes scope updates this file in the same commit.

When in doubt: PLANNING.md wins.
