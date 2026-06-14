# WebGL Step 10 — Final Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the 2D codepath, fold `@weasel-js/gl` source into thematic homes inside `@weasel-js/core`, and ship `0.2.0` as a GL-only kit.

**Architecture:** Three landing zones for renderer source: `src/renderer/` (GL machinery — `WeaselRenderer`, `draw`, caches, math, shaders, textures), `src/features/text/atlas/` (font atlasing — `FontAtlas`, `GlyphLayout`, `registerFont`), `src/features/paths/tessellate/` (path → mesh — `tessellate`, `polyline`, `stroke`). Font binary assets move to `assets/fonts/inter/` so `src/` stays source-only. `RenderLayer.drawGL` and siblings rename to `draw`/`drawOne`/`drawGhost` (the 2D versions are deleted in the same edit). `<Canvas>`/`<SceneCanvas>` lose the `backend` prop; the demo's `BackendContext` and `?backend=` query param are deleted.

**Tech Stack:** TypeScript, React, Vite (demo + swillustrator), tsup (kit bundle), vitest, Playwright. WebGL2 only.

**No external consumers.** All breaking changes are absorbed in-repo (demo, swillustrator, kit tests). No codemod, no MIGRATION.md, no deprecation cycle. Update callers directly, bump major version, ship.

---

## File structure (post-swap)

```
src/
  index.ts                         # barrel — re-exports renderer + features
  renderer/
    index.ts                       # internal barrel
    WeaselRenderer.ts
    draw.ts                        # DrawCommand interpreter
    DrawCommand.ts                 # public type
    state/GroupState.ts
    math/{mat3,viewToMat3,color}.ts
    cache/{cache,mesh,GLMeshCache,GLImageCache,GLTextureCache,GradientRampCache}.ts
    shaders/{ShaderProgram,registerProgram}.ts + shaders/* (.frag/.vert)
    textures/registerTexture.ts
  features/
    text/
      atlas/{FontAtlas,GlyphLayout,registerFont}.ts
      …existing text helpers…
    paths/
      tessellate/{tessellate,polyline,stroke}.ts
      …existing path helpers…
    …
  core/
    layers/render.ts               # RenderLayer interface — single draw() returning DrawCommand[]
    …
    (paint.ts deleted)
  …
assets/
  fonts/inter/{inter.json,inter.png}

(packages/gl/ deleted entirely)
(src/features/patterns/ deleted entirely — follow-up TODO)
(src/features/viewport/pixelDensity.ts deleted)
(demo/BackendContext.tsx deleted)
```

---

## Phase A — Mechanical source move (no semantic change)

### Task A1: Move font assets to repo-root `assets/`

**Files:**
- Create: `assets/fonts/inter/inter.json` (move from `packages/gl/fonts/inter/inter.json`)
- Create: `assets/fonts/inter/inter.png` (move from `packages/gl/fonts/inter/inter.png`)
- Modify: `vite.config.ts` (change `publicDir` target)
- Modify: `apps/swillustrator/vite.config.ts` (same)

- [ ] **Step 1: Create the new assets dir and move files**

```bash
mkdir -p assets/fonts/inter
git mv packages/gl/fonts/inter/inter.json assets/fonts/inter/inter.json
git mv packages/gl/fonts/inter/inter.png assets/fonts/inter/inter.png
git mv packages/gl/fonts/.gitkeep assets/fonts/.gitkeep
rmdir packages/gl/fonts/inter packages/gl/fonts
```

- [ ] **Step 2: Update root `vite.config.ts`** — change `publicDir` to point at `assets/fonts`

In `vite.config.ts`:

```ts
publicDir: resolve(__dirname, 'assets/fonts'),
```

- [ ] **Step 3: Update swillustrator vite config** if it references the old path

```bash
grep -n "weasel-gl/fonts" apps/swillustrator/vite.config.ts
```

If the grep returns lines, replace `packages/gl/fonts` → `assets/fonts` in the matched lines.

- [ ] **Step 4: Smoke-test demo loads fonts**

```bash
npx vite build 2>&1 | tail -5
```

Expected: build succeeds; the `inter.json` and `inter.png` get copied to `dist-demo/`. Verify with:

```bash
ls dist-demo/inter/
```

Expected: `inter.json  inter.png`.

- [ ] **Step 5: Commit**

```bash
git add assets/ packages/gl/fonts vite.config.ts apps/swillustrator/vite.config.ts
git commit -m "refactor(fonts): move font assets to repo-root assets/fonts/"
```

---

### Task A2: Move renderer source into `src/renderer/`

**Files:**
- Create: `src/renderer/{WeaselRenderer,draw,DrawCommand}.ts`
- Create: `src/renderer/state/GroupState.ts`
- Create: `src/renderer/math/{mat3,viewToMat3,color}.ts`
- Create: `src/renderer/cache/{cache,mesh,GLMeshCache,GLImageCache,GLTextureCache,GradientRampCache}.ts`
- Create: `src/renderer/shaders/{ShaderProgram,registerProgram}.ts` and `src/renderer/shaders/*` (existing shader source files)
- Create: `src/renderer/textures/registerTexture.ts`
- Create: `src/renderer/index.ts` (internal barrel)
- Modify: every `import` of these files (deferred to Task A5)

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p src/renderer/state src/renderer/math src/renderer/cache src/renderer/shaders src/renderer/textures
```

- [ ] **Step 2: Move files (preserve git history via `git mv`)**

```bash
# Top-level renderer files
git mv packages/gl/src/WeaselRenderer.ts src/renderer/WeaselRenderer.ts
git mv packages/gl/src/WeaselRenderer.test.ts src/renderer/WeaselRenderer.test.ts
git mv packages/gl/src/draw.ts src/renderer/draw.ts
git mv packages/gl/src/draw.test.ts src/renderer/draw.test.ts
git mv packages/gl/src/DrawCommand.ts src/renderer/DrawCommand.ts
git mv packages/gl/src/index.ts src/renderer/index.ts
git mv packages/gl/src/index.test.ts src/renderer/index.test.ts

# state/
git mv packages/gl/src/GroupState.ts src/renderer/state/GroupState.ts
git mv packages/gl/src/GroupState.test.ts src/renderer/state/GroupState.test.ts

# math/
git mv packages/gl/src/mat3.ts src/renderer/math/mat3.ts
git mv packages/gl/src/mat3.test.ts src/renderer/math/mat3.test.ts
git mv packages/gl/src/viewToMat3.ts src/renderer/math/viewToMat3.ts
git mv packages/gl/src/viewToMat3.test.ts src/renderer/math/viewToMat3.test.ts
git mv packages/gl/src/color.ts src/renderer/math/color.ts
git mv packages/gl/src/color.test.ts src/renderer/math/color.test.ts

# cache/
git mv packages/gl/src/cache.ts src/renderer/cache/cache.ts
git mv packages/gl/src/cache.test.ts src/renderer/cache/cache.test.ts
git mv packages/gl/src/mesh.ts src/renderer/cache/mesh.ts
git mv packages/gl/src/GLMeshCache.ts src/renderer/cache/GLMeshCache.ts
git mv packages/gl/src/GLMeshCache.test.ts src/renderer/cache/GLMeshCache.test.ts
git mv packages/gl/src/GLImageCache.ts src/renderer/cache/GLImageCache.ts
git mv packages/gl/src/GLImageCache.test.ts src/renderer/cache/GLImageCache.test.ts
git mv packages/gl/src/GLTextureCache.ts src/renderer/cache/GLTextureCache.ts
git mv packages/gl/src/GLTextureCache.test.ts src/renderer/cache/GLTextureCache.test.ts
git mv packages/gl/src/GradientRampCache.ts src/renderer/cache/GradientRampCache.ts
git mv packages/gl/src/GradientRampCache.test.ts src/renderer/cache/GradientRampCache.test.ts
git mv packages/gl/src/gradientTypes.test.ts src/renderer/cache/gradientTypes.test.ts

# shaders/
git mv packages/gl/src/ShaderProgram.ts src/renderer/shaders/ShaderProgram.ts
git mv packages/gl/src/ShaderProgram.test.ts src/renderer/shaders/ShaderProgram.test.ts
git mv packages/gl/src/registerProgram.ts src/renderer/shaders/registerProgram.ts
git mv packages/gl/src/registerProgram.test.ts src/renderer/shaders/registerProgram.test.ts
# Move existing shaders/ subdir contents
git mv packages/gl/src/shaders/* src/renderer/shaders/
rmdir packages/gl/src/shaders

# textures/
git mv packages/gl/src/registerTexture.ts src/renderer/textures/registerTexture.ts
git mv packages/gl/src/registerTexture.test.ts src/renderer/textures/registerTexture.test.ts
```

- [ ] **Step 3: Verify all renderer files moved**

```bash
ls packages/gl/src/
```

Expected remaining: `FontAtlas.ts`, `FontAtlas.test.ts`, `GlyphLayout.ts`, `GlyphLayout.test.ts`, `registerFont.ts`, `registerFont.test.ts`, `tessellate.ts`, `tessellate.test.ts`, `polyline.ts`, `polyline.test.ts`, `stroke.ts`, `stroke.test.ts`. (Those move in Tasks A3 and A4.)

- [ ] **Step 4: Commit (without import fixes — those land in A5)**

```bash
git commit -m "refactor(renderer): move weasel-gl renderer source into src/renderer/"
```

Note: TypeScript will be broken until Task A5. That's intentional — we move first, fix imports in one pass.

---

### Task A3: Move text atlas source into `src/features/text/atlas/`

**Files:**
- Create: `src/features/text/atlas/{FontAtlas,GlyphLayout,registerFont}.ts` (+ tests)

- [ ] **Step 1: Create dir and move files**

```bash
mkdir -p src/features/text/atlas
git mv packages/gl/src/FontAtlas.ts src/features/text/atlas/FontAtlas.ts
git mv packages/gl/src/FontAtlas.test.ts src/features/text/atlas/FontAtlas.test.ts
git mv packages/gl/src/GlyphLayout.ts src/features/text/atlas/GlyphLayout.ts
git mv packages/gl/src/GlyphLayout.test.ts src/features/text/atlas/GlyphLayout.test.ts
git mv packages/gl/src/registerFont.ts src/features/text/atlas/registerFont.ts
git mv packages/gl/src/registerFont.test.ts src/features/text/atlas/registerFont.test.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor(text): move font atlas source into src/features/text/atlas/"
```

---

### Task A4: Move path tessellation source into `src/features/paths/tessellate/`

**Files:**
- Create: `src/features/paths/tessellate/{tessellate,polyline,stroke}.ts` (+ tests)

- [ ] **Step 1: Create dir and move files**

```bash
mkdir -p src/features/paths/tessellate
git mv packages/gl/src/tessellate.ts src/features/paths/tessellate/tessellate.ts
git mv packages/gl/src/tessellate.test.ts src/features/paths/tessellate/tessellate.test.ts
git mv packages/gl/src/polyline.ts src/features/paths/tessellate/polyline.ts
git mv packages/gl/src/polyline.test.ts src/features/paths/tessellate/polyline.test.ts
git mv packages/gl/src/stroke.ts src/features/paths/tessellate/stroke.ts
git mv packages/gl/src/stroke.test.ts src/features/paths/tessellate/stroke.test.ts
```

- [ ] **Step 2: Verify weasel-gl/src/ is now empty**

```bash
ls packages/gl/src/
```

Expected: empty (or just shows zero entries).

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(paths): move path tessellation source into src/features/paths/tessellate/"
```

---

### Task A5: Replace `@weasel-js/gl` imports with relative imports

**Files:**
- Modify: every file that imports from `@weasel-js/gl` or `@weasel-js/gl/...`

This is a mechanical s/// pass, but because the moved files are scattered across three new homes (`src/renderer/`, `src/features/text/atlas/`, `src/features/paths/tessellate/`), the replacement isn't a single sed. The cleanest path is to add a transitional alias in `tsconfig.json` + `vite.config.ts` that points `@weasel-js/gl` at `src/renderer/index.ts`, then update individual call sites file-by-file as the renderer's barrel re-exports the moved-out symbols too.

- [ ] **Step 1: Make `src/renderer/index.ts` re-export font + tessellate symbols**

The pre-move barrel exported everything via `packages/gl/src/index.ts`. Open `src/renderer/index.ts` and ensure it re-exports symbols that moved to `src/features/text/atlas/` and `src/features/paths/tessellate/`:

```ts
// In src/renderer/index.ts, add transitional re-exports so @weasel-js/gl
// keeps resolving to a single module while we migrate call sites.
export { registerFont } from '../features/text/atlas/registerFont';
export type { FontAtlas } from '../features/text/atlas/FontAtlas';
// (preserve every existing export; only add the moved-out re-exports here)
```

Read the current `src/renderer/index.ts` first and append re-exports for everything that moved to features.

- [ ] **Step 2: Verify `tsc --noEmit` resolves @weasel-js/gl**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no `Cannot find module '@weasel-js/gl'` errors. Existing tsconfig path alias `"@weasel-js/gl": ["./packages/gl/src/index.ts"]` no longer resolves (we deleted that file). Update `tsconfig.json`:

```json
"@weasel-js/gl": ["./src/renderer/index.ts"],
```

And `vite.config.ts`:

```ts
{
  find: '@weasel-js/gl',
  replacement: resolve(__dirname, 'src/renderer/index.ts'),
},
```

(Also update `apps/swillustrator/vite.config.ts` if it has its own copy.)

- [ ] **Step 3: Re-run `tsc --noEmit`**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: clean. If any errors, they're real cross-package import paths inside `src/renderer/` itself referring to the old `packages/gl/src/` neighbors. Fix per error: change `from './FontAtlas'` (now broken) to `from '../features/text/atlas/FontAtlas'`.

- [ ] **Step 4: Replace `@weasel-js/gl` imports with relative paths**

Now that the alias works, switch in-`src` consumers off the package import. They should use relative imports because the renderer is now a sibling, not a peer:

```bash
grep -rln "@weasel-js/gl" src/ demo/ apps/
```

For each match:
- If it's in `src/`: replace with a relative import (e.g. `from '../renderer'`).
- If it's in `demo/` or `apps/`: replace with `from '@weasel-js/core'` if the symbol is re-exported from the kit barrel; otherwise use a relative import via the demo's existing alias.

The full list will be visible via the grep above. The most common patterns:
- `import { WeaselRenderer } from '@weasel-js/gl'` → `from '@weasel-js/core'` (after barrel update in Step 5)
- `import { tessellate } from '@weasel-js/gl'` → `from '@weasel-js/core'`
- `import type { DrawCommand } from '@weasel-js/gl'` → `from '@weasel-js/core'`

- [ ] **Step 5: Update `src/index.ts` to re-export the renderer surface**

Open `src/index.ts` and add at the bottom:

```ts
// Renderer surface (was @weasel-js/gl pre-0.2.0)
export {
  WeaselRenderer,
  registerFont,
  registerProgram,
  registerTexture,
  ShaderCompileError,
} from './renderer';
export type {
  DrawCommand,
  ShaderProgramHandle,
  TextureHandle,
  ShaderUniform,
} from './renderer';
```

(Audit `src/renderer/index.ts` for the actual symbol list. Add any missing public types.)

- [ ] **Step 6: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: same pass count as before the move (1609 at last count, may shift slightly if test files were also moved). All green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(renderer): re-route imports through src/renderer barrel"
```

---

### Task A6: Delete `packages/gl/` and update build config

**Files:**
- Delete: `packages/gl/` (entire directory)
- Modify: `tsconfig.json` (drop weasel-gl path alias)
- Modify: `vite.config.ts` (drop weasel-gl alias)
- Modify: `apps/swillustrator/vite.config.ts` (drop weasel-gl alias)
- Modify: `package.json` (drop `bundlesize:weasel-gl` script, drop `test:smoke:step1` script if it references weasel-gl playwright config, drop `gen:font` script if it references weasel-gl path)

- [ ] **Step 1: Delete the package directory**

```bash
git rm -r packages/gl/
```

- [ ] **Step 2: Drop weasel-gl tsconfig path**

In `tsconfig.json`, remove the `@weasel-js/gl` and `@weasel-js/gl/*` entries from `paths` and the `packages/gl/src` etc. entries from `include`.

- [ ] **Step 3: Drop weasel-gl vite alias**

In `vite.config.ts` remove the `@weasel-js/gl` alias entries (both the prefixed `/(.*)$` form and the bare form).

In `apps/swillustrator/vite.config.ts` do the same.

- [ ] **Step 4: Drop weasel-gl-specific package.json scripts**

In `package.json`, remove these lines:

```json
"test:smoke:step1": "playwright test --config=packages/gl/dev/playwright.config.ts",
"gen:font": "tsx packages/gl/scripts/gen-font.ts",
"bundlesize:weasel-gl": "rm -rf /tmp/weasel-gl-bundle && tsup packages/gl/src/index.ts ...",
```

If a `gen:font` replacement is needed, point it at the new home (`tsx scripts/gen-font.ts` after moving the script — out of scope for step 10; just delete for now and add a TODO if the user asks).

- [ ] **Step 5: Run prepublishOnly to verify the world**

```bash
npm run prepublishOnly 2>&1 | grep -E "Tests|error|FAIL|Build success" | tail -10
```

Expected: typecheck clean, all tests pass, tsup builds successfully.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "build: delete packages/gl/ and clean up aliases/scripts"
```

---

## Phase B — Collapse the *GL family

Each task in this phase: edit one interface + every implementer + every caller in one commit. Search/replace plus deletion of the 2D version. Use the kit-wide tests as the gate.

### Task B1: `RenderLayer.draw` rename + 2D delete

**Files:**
- Modify: `src/core/layers/render.ts` (the `RenderLayer` interface + `drawLayers` dispatcher)
- Modify: every layer implementer (factories + tests)

- [ ] **Step 1: Read the current RenderLayer interface**

```bash
sed -n '1,80p' src/core/layers/render.ts
```

Confirm the current shape: `draw?(ctx, ...)` (2D) + `drawGL?(...): DrawCommand[]` (GL).

- [ ] **Step 2: Edit the interface — keep only the GL signature, rename to `draw`**

In `src/core/layers/render.ts`, change:

```ts
export interface RenderLayer<TData> {
  id?: string;
  draw?(ctx: CanvasRenderingContext2D, …): void;
  drawGL?(view: View, …): DrawCommand[];
}
```

to:

```ts
export interface RenderLayer<TData> {
  id?: string;
  draw(view: View, …): DrawCommand[];
}
```

Adjust the exact signature to match what `drawGL` previously took (read the existing definition first; preserve the typing).

- [ ] **Step 3: Delete the 2D `drawLayers` function from `src/core/layers/render.ts`**

The file currently has both a 2D dispatch `drawLayers(ctx, layers, ...)` and a GL one. Delete the 2D variant entirely. The GL one stays but its parameter type needs updating to call `layer.draw(...)` (no longer `layer.drawGL(...)`).

- [ ] **Step 4: Find every layer implementer**

```bash
grep -rln "drawGL\b" src/ packages/ 2>/dev/null
```

For each file, in one edit:
1. Delete the 2D `draw(ctx, ...)` method body.
2. Rename `drawGL` → `draw`.

The list is roughly:
- `src/features/grid/layer.ts`
- `src/features/grid/cellHighlight.ts`
- `src/features/groups/children.ts`
- `src/features/paths/pathLayer.ts`
- `src/features/paths/penPreviewLayer.ts`
- `src/features/selection/overlay.ts` (multiple sub-layers)
- `src/features/text/textLayer.ts`
- `src/canvas/SceneCanvas/usePreviewGhostLayer.ts`
- `src/debug/debugOverlayLayer.ts`
- `src/canvas/Canvas.tsx` (inline layer construction)

(Run the grep above for the authoritative list.)

- [ ] **Step 5: Update tests**

```bash
grep -rln "drawGL\b" src/ 2>/dev/null
```

Should now only show test files. Each test invokes `layer.drawGL(...)` — rename to `layer.draw(...)` and assert on the same returned `DrawCommand[]`.

- [ ] **Step 6: Verify**

```bash
grep -rn "drawGL\b" src/ packages/ demo/ apps/ 2>/dev/null
```

Expected: empty. If non-empty, finish the renames.

```bash
npm test 2>&1 | tail -8
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(layers): rename RenderLayer.drawGL → draw, delete 2D path"
```

---

### Task B2: `SceneSlotConfig.drawOne` rename + 2D delete

**Files:**
- Modify: `src/canvas/Canvas.tsx` (or wherever `SceneSlotConfig` lives — search if uncertain)
- Modify: every consumer that passes `drawOne` / `drawOneGL` to `<Canvas>` or `<SceneCanvas>` (24 demos + tests)

- [ ] **Step 1: Find the SceneSlotConfig type**

```bash
grep -rn "drawOne\b\|drawOneGL\b" src/ --include="*.ts" --include="*.tsx" | head -10
```

Open the file declaring the type. Apply the same transformation: delete `drawOne(ctx, ...)`, rename `drawOneGL` → `drawOne`.

- [ ] **Step 2: Bulk-rename every `drawOneGL:` usage to `drawOne:`**

```bash
# Dry-run scan
grep -rln "drawOneGL" src/ demo/ apps/
# Apply (BSD sed):
grep -rl "drawOneGL" src/ demo/ apps/ | xargs sed -i '' 's/drawOneGL/drawOne/g'
```

- [ ] **Step 3: Delete `drawOne(ctx, ...)` 2D bodies**

Each call site that passed both `drawOne` and `drawOneGL` now has two `drawOne` keys after the rename. Open each and delete the 2D one (the one taking `ctx: CanvasRenderingContext2D`).

```bash
grep -rln "ctx: CanvasRenderingContext2D" src/ demo/ apps/
```

Visit each, identify the 2D `drawOne` arrow-function body, delete it. Be careful where `drawOne` is the only key — those are already GL and should not be touched.

- [ ] **Step 4: Verify**

```bash
grep -rn "drawOneGL" src/ demo/ apps/
```

Expected: empty.

```bash
npm test 2>&1 | tail -8
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(canvas): rename SceneSlotConfig.drawOneGL → drawOne, delete 2D"
```

---

### Task B3: `*Tool.drawGhost` rename + 2D delete

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts` (and other tools that expose `drawGhost`/`drawGhostGL`)
- Modify: every demo + test that supplies a `drawGhost` callback

- [ ] **Step 1: Locate every `drawGhost` / `drawGhostGL` declaration and call site**

```bash
grep -rn "drawGhost\b\|drawGhostGL\b" src/ demo/ apps/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Bulk-rename `drawGhostGL` → `drawGhost`**

```bash
grep -rl "drawGhostGL" src/ demo/ apps/ | xargs sed -i '' 's/drawGhostGL/drawGhost/g'
```

- [ ] **Step 3: Delete the 2D `drawGhost(ctx, ...)` bodies**

For each duplicate-keyed object literal where both arrows now match, delete the 2D one (the one whose first parameter is typed as `CanvasRenderingContext2D`).

- [ ] **Step 4: Verify**

```bash
grep -rn "drawGhostGL" src/ demo/ apps/
npm test 2>&1 | tail -8
```

Both clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(tools): rename *Tool.drawGhostGL → drawGhost, delete 2D"
```

---

## Phase C — Delete 2D infrastructure

### Task C1: Delete `src/core/paint.ts` (`applyPaint`, `applyStroke`, `renderFilledRegion`)

**Files:**
- Delete: `src/core/paint.ts`, `src/core/paint.test.ts`
- Modify: `src/index.ts` (drop `Paint`/`applyPaint`/`applyStroke` re-exports — but keep `Paint`, `Stroke`, `Region` types if they live in `paint.ts`)
- Modify: any kit module still importing `applyPaint`/`applyStroke`/`renderFilledRegion`

- [ ] **Step 1: Find current consumers**

```bash
grep -rln "applyPaint\|applyStroke\|renderFilledRegion" src/ demo/ apps/ --include="*.ts" --include="*.tsx"
```

The test files for paint.ts can be deleted with the source. Other callers should already have switched to `DrawCommand` trees in step 7. If any non-test caller remains, it's a residual 2D path that needs porting (or deletion).

- [ ] **Step 2: Extract `Paint` / `Stroke` / `Region` types into a separate file before deletion**

If `paint.ts` declares the public types `Paint`, `Stroke`, `StrokeAlign`, `Region`, `RenderFilledRegionOptions`, `GradStop` etc., move them to `src/core/paint-types.ts` first:

```bash
# Read the type-only declarations
sed -n '1,200p' src/core/paint.ts
```

Identify lines that declare `export type` / `export interface` for the paint types. Move those declarations into a new file `src/core/paint-types.ts`. Update imports kit-wide (paths previously importing types from `./paint` now import from `./paint-types`).

- [ ] **Step 3: Delete the implementation file**

```bash
git rm src/core/paint.ts src/core/paint.test.ts
```

- [ ] **Step 4: Update barrel**

In `src/index.ts`, replace the existing paint exports:

```ts
// Before:
export {
  applyPaint, applyStroke, renderFilledRegion, alignedStrokeRect,
} from './core/paint';
export type {
  Paint, GradStop, Stroke, StrokeAlign, Region, RenderFilledRegionOptions,
} from './core/paint';

// After:
export type {
  Paint, GradStop, Stroke, StrokeAlign, Region,
} from './core/paint-types';
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit 2>&1 | head -20
npm test 2>&1 | tail -8
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(paint): delete 2D applyPaint family; preserve Paint types"
```

---

### Task C2: Delete `src/features/viewport/pixelDensity.ts` (`setupCanvasDpr`, `useFixedPixelRatio`)

**Files:**
- Delete: `src/features/viewport/pixelDensity.ts` (and any test file)
- Modify: `src/index.ts` (drop the `setupCanvasDpr`, `useFixedPixelRatio`, `SetupCanvasDprOptions` re-exports)
- Modify: any caller of `setupCanvasDpr` / `useFixedPixelRatio` (renderer owns DPR now)

- [ ] **Step 1: Find current consumers**

```bash
grep -rln "setupCanvasDpr\|useFixedPixelRatio" src/ demo/ apps/
```

- [ ] **Step 2: Update each consumer**

If a consumer is `Canvas.tsx`, the call should already be in the 2D-only path (which is going away in Phase D). Other callers — delete the `setupCanvasDpr(...)` call; the GL renderer reads `devicePixelRatio` itself.

- [ ] **Step 3: Delete the file**

```bash
ls src/features/viewport/pixelDensity*
git rm src/features/viewport/pixelDensity.ts
# Also delete test if present:
[ -f src/features/viewport/pixelDensity.test.ts ] && git rm src/features/viewport/pixelDensity.test.ts
```

- [ ] **Step 4: Update barrel**

In `src/index.ts`, delete:

```ts
export { setupCanvasDpr, useFixedPixelRatio } from './features/viewport/pixelDensity';
export type { SetupCanvasDprOptions } from './features/viewport/pixelDensity';
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -8
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(viewport): delete setupCanvasDpr; renderer owns DPR"
```

---

### Task C3: Delete `src/features/patterns/` (CanvasPattern-based)

**Files:**
- Delete: `src/features/patterns/` (entire directory)
- Modify: `src/index.ts` (drop `createTilePattern` and `TilePatternOpts` re-exports)
- Modify: `src/subpaths/patterns-builtin.ts` (delete file)
- Modify: `tsup.config.ts` (drop the `patterns-builtin` entry)
- Modify: `package.json` (drop `./patterns-builtin` exports entry)
- Modify: any demo using `createTilePattern` / `hatch` / `crosshatch` / `dots` / `chunks`

The replacement story (consumer registers a texture via `registerTexture` and uses it as a `Paint.fill = 'pattern'` value) will land as a follow-up TODO; for step 10 we just remove the broken 2D primitives.

- [ ] **Step 1: Find consumers**

```bash
grep -rln "createTilePattern\|patterns-builtin\|\bhatch\b\|crosshatch\|chunks\b" src/ demo/ apps/
```

For each demo/app caller, replace the pattern paint with a solid color (placeholder). Add a comment marking the regression so the follow-up is obvious:

```ts
// TODO(post-0.2.0): restore pattern fill via registerTexture (see TODO.md "GL pattern factories").
fill: { kind: 'solid', color: '#aaa' },
```

- [ ] **Step 2: Delete the patterns directory and subpath**

```bash
git rm -r src/features/patterns
git rm src/subpaths/patterns-builtin.ts
```

- [ ] **Step 3: Update barrel**

In `src/index.ts`, delete:

```ts
export { createTilePattern } from './features/patterns';
export type { TilePatternOpts } from './features/patterns';
```

- [ ] **Step 4: Update tsup.config.ts**

Remove the `'patterns-builtin'` entry from the `entry` map.

- [ ] **Step 5: Update package.json**

Delete the `"./patterns-builtin"` block from `exports`.

- [ ] **Step 6: Add follow-up TODO**

Append to `docs/TODO.md` under Tier 1.5:

```md
- **GL pattern factories.** `createTilePattern` and the `patterns-builtin`
  catalog (hatch, crosshatch, dots, chunks) were CanvasPattern-based and
  deleted in Step 10. Replacement story: render a tile to an
  `OffscreenCanvas`, hand it to `registerTexture()`, use the resulting
  `TextureHandle` as `Paint.fill = 'pattern'`. Wrap that pattern in a
  `createTilePattern(draw, opts)` factory returning a `TextureHandle` so
  the consumer surface stays one call. Until then, demos that want
  patterns substitute solid fills.
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -8
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(patterns): delete CanvasPattern primitives (GL replacement TBD)"
```

---

### Task C4: Delete `LayerRenderer` 2D dispatcher path

**Files:**
- Modify: `src/core/layers/LayerRenderer.ts` (and tests)

`LayerRenderer` today has both a 2D `drawLayers(ctx, ...)` codepath and a GL one. After Tasks B1/C1 the 2D path is unreferenced. Delete it.

- [ ] **Step 1: Read the file**

```bash
sed -n '1,80p' src/core/layers/LayerRenderer.ts
```

- [ ] **Step 2: Identify and delete the 2D codepath**

The file likely has a class or function with branches keyed off the backend. Delete the 2D branches and keep only the GL one. The result: `LayerRenderer` calls `layer.draw(view, ...)` (the GL signature post-B1) and pipes returned `DrawCommand[]` to `WeaselRenderer`.

- [ ] **Step 3: Update tests**

`src/core/layers/LayerRenderer.test.ts` — delete tests asserting 2D behavior; keep the GL ones.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(layers): delete 2D dispatcher from LayerRenderer"
```

---

### Task C5: Delete misc 2D helpers

Sweep for stragglers: `src/features/drag/dragGhost.ts` ctx variant, `src/features/paths/canvas.ts`, `src/tools/builtin/marquee.ts` 2D draw methods, etc.

- [ ] **Step 1: Find every file still referencing `CanvasRenderingContext2D` in `src/`**

```bash
grep -rln "CanvasRenderingContext2D" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Triage each match**

For each file, decide:
- **Test file using a real ctx for measurement** (e.g. `useTextEdit.test.ts` building a contenteditable overlay): keep — `CanvasRenderingContext2D` is still legal in test environments and not gated on a backend.
- **Source file with a 2D draw helper used only internally**: delete the helper.
- **Source file declaring `CanvasRenderingContext2D` in a public interface**: delete the public surface; emit `DrawCommand[]` instead.

A complete walkthrough of the ~32 files is what this task does. Take them in `src/`-tree order and commit at the end.

Expected residual users in `src/` after this task:
- `src/features/text/measureText.ts` — uses an offscreen 2D ctx for width measurement. Keep (measurement, not rendering).
- `src/features/text/useTextEdit.ts` — uses a 2D ctx to position the contenteditable overlay. Keep.
- `src/features/text/textStyle.ts` — `fontString()` builder reads ctx properties only for parity. Keep.
- All test files for the above. Keep.

Everything else that uses `CanvasRenderingContext2D` should be deleted or de-2D'd.

- [ ] **Step 3: Verify**

```bash
grep -rln "CanvasRenderingContext2D" src/ --include="*.ts" --include="*.tsx" | grep -v test
```

Expected: only the offscreen-measurement files listed above.

```bash
npm test 2>&1 | tail -8
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(2d): delete remaining 2D draw helpers (keep offscreen measurement)"
```

---

## Phase D — Drop the `backend` prop and demo wiring

### Task D1: Remove `backend` from `<Canvas>`

**Files:**
- Modify: `src/canvas/Canvas.tsx` (drop `backend` prop, collapse render path)

- [ ] **Step 1: Read the current Canvas component**

```bash
grep -n "backend\b" src/canvas/Canvas.tsx | head -20
```

- [ ] **Step 2: Delete the backend prop and its branches**

In `src/canvas/Canvas.tsx`:
- Remove `backend?: '2d' | 'gl'` from `CanvasProps`.
- Delete every `if (backend === '2d') { ... } else { ... }` branch — keep only the GL branch body.
- Delete the runtime warning about `backend` changing post-mount.
- Delete any `useRef`/`useState` tracking the backend.

- [ ] **Step 3: Verify**

```bash
grep -n "backend\b" src/canvas/Canvas.tsx
```

Expected: empty.

```bash
npx tsc --noEmit
npm test 2>&1 | tail -8
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(canvas): drop backend prop; GL is the only backend"
```

---

### Task D2: Remove `backend` from `<SceneCanvas>`

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx` (drop forwarding of `backend`)

- [ ] **Step 1: Find backend references**

```bash
grep -n "backend\b" src/canvas/SceneCanvas.tsx
```

- [ ] **Step 2: Delete them**

Remove the `backend` line from the destructure of `rest`, the `Omit<…, 'backend'>` (if present in the prop type), and the conditional spread `{...(backend !== undefined ? { backend } : {})}` on the `<Canvas>` JSX.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm test 2>&1 | tail -8
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(scene-canvas): drop backend prop forwarding"
```

---

### Task D3: Delete `demo/BackendContext.tsx` and `?backend=` wiring

**Files:**
- Delete: `demo/BackendContext.tsx`
- Modify: `demo/main.tsx` (drop `<BackendProvider>` wrap)
- Modify: every file in `demo/demos/*.tsx` that calls `useBackend()` and forwards to a `backend` prop

- [ ] **Step 1: Find every consumer**

```bash
grep -rln "BackendContext\|useBackend\|BackendProvider" demo/
```

- [ ] **Step 2: For every demo, delete the useBackend() call and the backend prop forwarding**

A typical demo has:

```tsx
import { useBackend } from '../BackendContext';
…
const backend = useBackend();
…
<Canvas backend={backend} ... />  // or <SceneCanvas backend={backend} ... />
```

Delete the import, the `const backend = useBackend()` line, and the `backend={backend}` JSX attribute.

```bash
grep -l "useBackend\|backend={backend}" demo/demos/*.tsx | while read f; do
  echo "Editing $f"
  # Manual: open and remove the three patterns.
done
```

The list of files to touch will be ~24 (one per demo). Edit each.

- [ ] **Step 3: Drop `<BackendProvider>` from `demo/main.tsx`**

```diff
-import { BackendProvider } from './BackendContext';
…
-      <SelectionContextProvider>
-        <BackendProvider>
-          <CanvasKitDemo />
-        </BackendProvider>
-      </SelectionContextProvider>
+      <SelectionContextProvider>
+        <CanvasKitDemo />
+      </SelectionContextProvider>
```

- [ ] **Step 4: Delete the file**

```bash
git rm demo/BackendContext.tsx
```

- [ ] **Step 5: Verify**

```bash
grep -rn "BackendContext\|useBackend\|backend={" demo/
```

Expected: empty.

```bash
npx vite build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(demo): delete BackendContext and ?backend= wiring"
```

---

### Task D4: Same cleanup in `apps/swillustrator`

**Files:**
- Modify: `apps/swillustrator/src/App.tsx` (and any other swillustrator file that references `backend`)

- [ ] **Step 1: Find backend references**

```bash
grep -rn "backend\b" apps/swillustrator/
```

- [ ] **Step 2: Delete each**

Same pattern as the demo: drop the prop, drop any `useBackend` wiring.

- [ ] **Step 3: Verify swillustrator builds**

```bash
npx vite build --config apps/swillustrator/vite.config.ts 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(swillustrator): drop backend prop wiring"
```

---

## Phase E — Polish, version bump, ship

### Task E1: Update `tsup.config.ts`

**Files:**
- Modify: `tsup.config.ts`

After Task C3 deleted `patterns-builtin`, the entry map has one fewer key. Verify the file is clean.

- [ ] **Step 1: Read**

```bash
cat tsup.config.ts
```

- [ ] **Step 2: Confirm `patterns-builtin` is gone**

If still present, delete the line.

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -5
```

Expected: success; no `patterns-builtin.js` in `dist/`.

- [ ] **Step 4: Commit (only if changes)**

```bash
git add tsup.config.ts && git commit -m "build(tsup): remove patterns-builtin entry"
```

If no changes, skip.

---

### Task E2: Bump version to `0.2.0`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Edit `package.json`**

```diff
-  "version": "0.1.0",
+  "version": "0.2.0",
```

- [ ] **Step 2: Verify**

```bash
node -e "console.log(require('./package.json').version)"
```

Expected: `0.2.0`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(release): bump to 0.2.0"
```

---

### Task E3: Update `CHANGELOG.md`

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Read the existing changelog**

```bash
head -30 CHANGELOG.md
```

- [ ] **Step 2: Prepend a new release entry**

At the top of `CHANGELOG.md`, after the title, insert:

```md
## 0.2.0 — 2026-05-09

### Breaking changes (final WebGL swap)

- **2D backend removed.** `<Canvas>` and `<SceneCanvas>` no longer accept `backend?: '2d' | 'gl'`. WebGL2 is the only backend.
- **`@weasel-js/gl` deleted.** All renderer source folded into `@weasel-js/core`:
  - GL machinery → `src/renderer/`
  - Font atlasing → `src/features/text/atlas/`
  - Path tessellation → `src/features/paths/tessellate/`
- **`RenderLayer` interface simplified.** Single `draw(view, ...)` method returning `DrawCommand[]`. The 2D `draw(ctx, ...)` and GL-suffixed `drawGL(...)` are gone.
- **Pair renames** for the same reason: `SceneSlotConfig.drawOneGL` → `drawOne`, `*Tool.drawGhostGL` → `drawGhost`. The 2D originals are deleted.
- **Deleted exports:** `applyPaint`, `applyStroke`, `renderFilledRegion`, `alignedStrokeRect`, `setupCanvasDpr`, `useFixedPixelRatio`, `createTilePattern`, the `patterns-builtin` subpath (hatch/crosshatch/dots/chunks).
- **`Paint`, `Stroke`, `Region` types preserved** (they're shared with the GL Paint dispatch). They now live in `src/core/paint-types.ts`.

### Migration notes (in-repo)

- Demos and `apps/swillustrator` updated in this release. No external consumers exist.
- Pattern factories (`createTilePattern` etc.) are gone pending a `registerTexture`-based replacement; demos that used them now show a solid fill.

### Font assets

Font binaries (`inter.json` + `inter.png`) moved from `packages/gl/fonts/inter/` to `assets/fonts/inter/`. Vite `publicDir` updated.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): document 0.2.0 GL-only swap"
```

---

### Task E4: Update `README.md` — drop "Backends" section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the Backends section**

```bash
grep -n "## Backends\|backend prop\|backend=" README.md
```

- [ ] **Step 2: Delete it**

Open `README.md`, delete the entire `## Backends` section (and any sentence in surrounding text that says "the kit ships two backends" or similar).

- [ ] **Step 3: Verify the rest of the README isn't broken** (no orphan refs)

```bash
grep -n "backend\b" README.md
```

Expected: no occurrences (or only in a context where "back end" means something else like "back-end developer").

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): drop Backends section; GL is now the only renderer"
```

---

### Task E5: Mark Step 10 done in `TODO.md`, write `done.md`

**Files:**
- Modify: `docs/TODO.md`
- Create: `docs/superpowers/plans/2026-05-09-webgl-step-10-done.md`

- [ ] **Step 1: Update TODO.md**

In `docs/TODO.md`, change:

```md
- [ ] Step 10 — Final swap (delete 2D, rename `weasel-gl` → `weasel`, major version bump) (plan TBW)
```

to:

```md
- [x] Step 10 — Final swap shipped 2026-05-09 (`docs/superpowers/plans/2026-05-09-webgl-step-10-done.md`)
```

- [ ] **Step 2: Write `done.md`**

Create `docs/superpowers/plans/2026-05-09-webgl-step-10-done.md` with content matching past `*-done.md` siblings (cross-reference `2026-05-09-webgl-step-9-done.md` for format). The body should summarize: what shipped (every Phase A/B/C/D/E task as a bullet), notable deviations from plan (whatever surfaced during execution), test results (vitest count, build size delta vs 0.1.0), lessons for future work.

A starting skeleton:

```md
# WebGL Step 10 — Done

**Plan:** [`2026-05-09-webgl-step-10-final-swap.md`](./2026-05-09-webgl-step-10-final-swap.md)
**Date completed:** 2026-05-09

## What shipped

- **`@weasel-js/gl` deleted.** Renderer source folded into `src/renderer/` (GL machinery), `src/features/text/atlas/` (font atlasing), `src/features/paths/tessellate/` (path tessellation).
- **2D codepath deleted.** `applyPaint`/`applyStroke`/`renderFilledRegion`, `setupCanvasDpr`/`useFixedPixelRatio`, the patterns-builtin catalog, all `RenderLayer.draw(ctx, …)` 2D method bodies.
- **`*GL` family collapsed.** `RenderLayer.drawGL` → `draw`, `SceneSlotConfig.drawOneGL` → `drawOne`, `*Tool.drawGhostGL` → `drawGhost`.
- **`backend` prop removed** from `<Canvas>` / `<SceneCanvas>`. Demo `BackendContext` and `?backend=` query param deleted.
- **Font assets relocated** to `assets/fonts/inter/`.
- **Version bump** `0.1.0` → `0.2.0` with CHANGELOG entry.
- **README updated** — Backends section dropped.

## Notable deviations from plan

(Fill in during execution — anything that diverged from the bite-sized tasks goes here.)

## Test results

- **Vitest:** N/N pass (vs 1609 pre-step-10).
- **Typecheck:** clean.
- **Bundle size:** dist/index.js delta vs 0.1.0 = TODO.
- **Demo build:** `vite build` succeeds.
- **Swillustrator build:** `vite build --config apps/swillustrator/vite.config.ts` succeeds.

## Follow-ups

- **GL pattern factories.** Tracked in TODO.md Tier 1.5 — restore pattern-fill UX via `registerTexture`.
- **`gen:font` script home.** Was `packages/gl/scripts/gen-font.ts`; deleted in step 10. If we ever regenerate the Inter atlas, restore the script under `scripts/gen-font.ts` at repo root.
```

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md docs/superpowers/plans/2026-05-09-webgl-step-10-done.md
git commit -m "docs(todo): mark WebGL Step 10 done; write done.md"
```

---

### Task E6: Final pre-publish gate + push

**Files:** none

- [ ] **Step 1: Run full prepublishOnly**

```bash
npm run prepublishOnly 2>&1 | grep -E "Tests|Test Files|error|FAIL|Build success" | tail -10
```

Expected: typecheck clean, all tests pass, tsup builds.

- [ ] **Step 2: Build the demo**

```bash
npx vite build 2>&1 | tail -5
```

Expected: success.

- [ ] **Step 3: Build swillustrator**

```bash
npx vite build --config apps/swillustrator/vite.config.ts 2>&1 | tail -5
```

Expected: success.

- [ ] **Step 4: Push**

```bash
git push origin main
```

Step 10 is shipped.

---

## Self-review

**1. Spec coverage.** The umbrella spec (`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`) Step-10 row asks for: delete 2D codepath; drop `backend` prop; rename `@weasel-js/gl` → `@weasel-js/core`; bump major version; document migration. Coverage:
- Delete 2D codepath → Phase C.
- Drop `backend` → Phase D (D1, D2).
- Fold `weasel-gl` → Phase A.
- Bump major → Task E2.
- Migration doc → not applicable (no external consumers — established in feedback memory).
- Delete `BackendContext` and the `?backend=` wiring → Task D3.
- `paint.ts`, `setupCanvasDpr` deletions called out by spec → Tasks C1, C2.

All covered.

**2. Placeholder scan.** No "TBD", "fill in later," or "similar to Task N" patterns. The skeleton in Task E5 Step 2 is an explicit fill-in-during-execution scaffold, which is appropriate for a done.md (the deviations and bundle-size delta aren't knowable until the work is done).

**3. Type consistency.** `RenderLayer.draw(view, ...)` signature is referenced consistently across Tasks B1, B2, C4 (LayerRenderer dispatcher). The deleted exports list in CHANGELOG (Task E3) matches the deletes in Tasks C1–C5. The `Paint` types preserved location (`src/core/paint-types.ts`) is consistent across Tasks C1 and the CHANGELOG note.

**Risk summary.**
- Phase A leaves the tree in a broken state between Tasks A2 and A5 (imports refer to deleted source paths). Tests will not run cleanly during that window. Acceptable because A5 is the resolution and the phase commits in sequence — a bisect lands at a known broken commit if anyone runs `git bisect` across the move. Mitigation: run prepublishOnly only at the end of Phase A.
- Phase C3 (delete patterns) creates a visible regression in the demos that used `hatch`/`dots`. Documented in CHANGELOG and in a TODO.md Tier 1.5 entry. Acceptable per the no-consumers feedback.
- Tasks B1/B2/B3 are bulk-rename-then-delete-2D-bodies. The risk is leaving an object literal with two keys named `draw` (or `drawOne` etc.), which TypeScript will catch as duplicate property — that's a fail-fast, so the typecheck step in each task will surface it.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-webgl-step-10-final-swap.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
