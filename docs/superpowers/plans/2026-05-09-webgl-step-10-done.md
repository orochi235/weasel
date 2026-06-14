# WebGL Step 10 — Done

**Plan:** [`2026-05-09-webgl-step-10-final-swap.md`](./2026-05-09-webgl-step-10-final-swap.md)
**Date completed:** 2026-05-09

## What shipped

- **`@weasel-js/gl` deleted as a separate package.** Renderer source folded into thematic homes inside `@weasel-js/core`:
  - GL machinery → `src/renderer/` (`WeaselRenderer`, `draw`, `state/`, `math/`, `cache/`, `shaders/`, `textures/`)
  - Font atlasing → `src/features/text/atlas/` (`FontAtlas`, `GlyphLayout`, `registerFont`)
  - Path tessellation → `src/features/paths/tessellate/` (`tessellate`, `polyline`, `stroke`)
  - Font binary assets → `assets/fonts/inter/`
- **2D codepath deleted.** Removed:
  - `src/core/paint.ts` (`applyPaint`, `applyStroke`, `renderFilledRegion`, `RenderFilledRegionOptions`). Public types (`Paint`, `Stroke`, `Region`, `StrokeAlign`, `GradStop`, `alignedStrokeRect`) preserved at `src/core/paint-types.ts`.
  - `src/features/viewport/pixelDensity.ts` (`setupCanvasDpr`, `useFixedPixelRatio`). The renderer reads `devicePixelRatio` itself.
  - `src/core/layers/LayerRenderer.ts` (orphan abstract base class, no consumers).
  - `src/features/drag/dragGhost.ts` (`createDragGhost` 2D-ctx helper, no callers).
  - `src/features/paths/canvas.ts` (`traceToContext`, no kit callers).
  - All `RenderLayer.draw(ctx, ...)` 2D bodies and per-tool 2D fallback methods.
- **`*GL` family collapsed.** `RenderLayer.drawGL` → `draw`, `SceneSlotConfig.drawOneGL` → `drawOne`, `*Tool.drawGhostGL` → `drawGhost`, `createChildrenLayer.drawChildGL` → `drawChild`, `drawLayersGL` → `drawLayers`, plus 6 file-private `emit*GL` debug helpers de-suffixed.
- **`backend` prop removed** from `<Canvas>` / `<SceneCanvas>`. `demo/BackendContext.tsx` deleted; `?backend=` URL query-param wiring gone. All 24 demos updated.
- **Pattern API rebuilt on `TextureHandle`.** `createTilePattern(opts)` (now `(opts) => TextureHandle | null`, no `ctx` parameter) renders the tile to an `OffscreenCanvas` and uploads via `registerTexture`. The four built-ins (`hatch`, `crosshatch`, `dots`, `chunks`) lose their `ctx` parameter and return `TextureHandle | null`. `Paint.pattern` variant payload changed `CanvasPattern` → `TextureHandle`.
- **`PixelDensityDemo` retired.** Its only purpose was demonstrating the deleted DPR helpers.
- **Build & config cleaned up.** Vite `publicDir` repointed to `assets/fonts`. Dropped weasel-gl-specific scripts (`test:smoke:step1`, `gen:font`, `bundlesize:weasel-gl`). Restored `patterns-builtin` tsup entry + `package.json` exports block.
- **Version bump** `0.1.0` → `0.2.0` with CHANGELOG entry.
- **README updated** — Backends section dropped; tagline rewritten as "rendered on WebGL2"; Custom-shaders + text-rendering sections updated to import from `@weasel-js/core`.

## Notable deviations from plan

- **Patterns ported, not deleted.** Plan Task C3 said to delete `src/features/patterns/` outright with a follow-up TODO for GL replacement. After the user reviewed the tradeoff, we ported the API forward in the same step (new `createTilePattern` returning `TextureHandle`). Nothing in-repo actually consumed patterns, so the user-visible cost of the port-vs-delete was just code-completeness.
- **`alignedStrokeRect` retained.** The plan characterized it as a 2D `(ctx,...)=>void` helper; in practice it's pure geometry (rect → adjusted rect) used by GL stroke tessellation and selection-overlay. Kept in `src/core/paint-types.ts`.
- **Phase-B coda commit (`c3ffedf`).** After B1/B2/B3, the code-quality reviewer flagged `drawLayersGL` (top-level dispatcher, no 2D sibling) and 6 `emit*GL` debug helpers (file-private, no 2D siblings) as remaining `*GL` suffixes. Renamed in a small follow-up commit before Phase C.
- **`createChildrenLayer.drawChild` rolled forward in B1** rather than B2. The 2D body deletion in B1 left no implementation to call; the GL-shape rename was unavoidable in the same edit.
- **Two tests skipped under jsdom** (`Canvas.test.tsx` debug recording + `layoutDemo.integration.test.tsx`'s "selects the child"). Both depended on stub-2D-ctx assertions that don't translate to GL output. Skip messages explain.
- **Three `_DEMO_SOURCE` template literals** with stale 2D shapes (`GroupsDemo`, `NestedGroupsDemo`, `BezierEditDemo`) were superseded by an in-flight demo source-viewer refactor that deleted the snippets entirely. No targeted edit needed.
- **No external-consumer migration tooling** — no codemod, no MIGRATION.md, no deprecation cycle. The repo has no published consumers; the breaking changes land directly with the version bump.

## Test results

- **Vitest:** 1571 pass + 2 skipped across 195 files (vs 1609 pre-step-10). Net drop of 38 tests is from deleting 2D-ctx-stub assertions that don't have GL equivalents (they were measuring 2D API call shapes, not behavior).
- **Typecheck:** clean.
- **Demo build:** `vite build` succeeds; `dist-demo/inter/` contains the relocated font assets.
- **Swillustrator build:** `vite build --config apps/swillustrator/vite.config.ts` succeeds.
- **Bundle:** `dist/index.js` ≈ 451KB (unchanged at the major-bundle level — the renderer was already compiled in via the alias).

## Follow-ups already tracked

- **Typed scene-object references** (TODO Tier 1.5, medium-high priority) — the parallel `kinds` array on `SelectionContextValue` is a temporary half-step toward a `{id, kind}` reference type.
- **`gen:font` script restoration** (TODO Pre-1.0 polish) — was deleted with `packages/gl/scripts/`; restore at `scripts/gen-font.ts` if we ever regenerate the Inter atlas.

## Lessons

- **Plan accuracy on small helpers matters.** `alignedStrokeRect` was misclassified as 2D; only-after-execution caught it. For future Phase-X plans, audit each named "delete X" target for actual current-day usage before committing the plan.
- **In-flight working-tree work coexists.** The user had a multi-file source-viewer refactor open across the demos throughout Phase A–C. `git stash` + selective staging kept the chain clean; the user pops the stash whenever they're ready. No rebase pain.
- **Phase A's broken-tree window** (between A2 file-move and A5 import-rewire) cost nothing because the gate is at A5 — no test/typecheck attempts in between. Worth doing again for similar surgical refactors.
- **Subagent dispatch pacing.** Per-task implementer + spec reviewer + code reviewer was right for 13 of 16 in-flight tasks; the smaller deletions (E1/D4 no-ops, C2 minor) were faster handled inline by the controller. Mixing modes per task complexity is the move.
