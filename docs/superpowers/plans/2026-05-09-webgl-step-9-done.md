# WebGL Step 9 — Done (Rig + Wide GL Audit)

**Plan:** [`2026-05-09-webgl-step-9-visual-regression-rig.md`](./2026-05-09-webgl-step-9-visual-regression-rig.md)
**Date completed:** 2026-05-09 — scaffolding + audit / soak still pending CI

> **Honest framing:** This step's plan was the visual regression rig + a 30-day soak gate. The rig (tasks 1–8, 11–13) shipped; the soak (tasks 9, 10, 14–16) is deferred to actual CI infrastructure and a real 30-day window. **More importantly,** running the rig immediately surfaced a much bigger gap than expected: most demos were rendering empty under `backend='gl'` because the scene-slot wrapper and several tool/gesture overlay layers had never been ported. Step 7 ported public layer factories; step 8 flagged two SceneCanvas system layers; step 9 was the first time the *full* GL surface got exercised end-to-end. That deep-dive consumed most of the session and produced 6 follow-up commits beyond the rig itself.

## What shipped

### Visual regression rig (the original step 9 scope)

- **`?backend=2d|gl` query string in demo app** via a `BackendContext` provider. All 24 demos wired (`PixelDensityDemo` left raw — uses bare `<canvas>`).
- **`tests/visual/playwright.config.ts`** — port 5174, 1280×800 @1×, single worker, `ubuntu-22.04`-pinned.
- **`tests/visual/diff.ts`** — pixelmatch harness with `assertMatchesBaseline` + `UPDATE_SNAPSHOTS=1` write-mode.
- **24 visual specs**, one per demo, with 5% tolerance overrides on text/compound-paths/bezier-edit/pixel-density.
- **`.github/workflows/visual.yml`** — runs visual suite on PRs, uploads baselines artifact on failure.
- **Bundle-size CI gate hardened** to fail on > 50KB delta. Baseline captured at 67542 bytes.
- **`CONTRIBUTING.md`** documents the visual-regression workflow.
- **npm scripts**: `test:visual`, `test:visual:update`.

### Bug fixes surfaced by the rig

- **DPR / canvas style**: `WeaselRenderer` set the backing-store dims (`canvas.width = cssWidth × dpr`) but never set `canvas.style.width/height`. Under `backend='gl'` on Retina displays, a `width=400` demo laid out at 800 CSS px in the DOM. The 2D path's `setupCanvasDpr` always set both. Fixed `WeaselRenderer.constructor` and `WeaselRenderer.resize`.
- **`splitForDash` ignored `closed: true`**: 4-point closed rect polylines were dashed across only 3 segments — left edge of every marquee was undashed. Now iterates `ptCount` segments with wraparound when closed.

### GL surface gaps closed (the hard part)

The rig's first run revealed that most demos rendered empty under `backend='gl'`. Drag-select still worked (selection logic reads scene state), but nothing visible — the user reported "I can drag-select nested groups and tell that the objects are actually there, but they're invisible until then." Step 7's port covered public layer factories, step 8 flagged two system layers — but **the scene-slot wrapper and five tool/gesture overlay layers had never been audited**.

Closed in this session:

- **`SceneSlotConfig.drawOneGL?`** in `src/canvas/Canvas.tsx`. `buildSceneLayer` adds `RenderLayer.drawGL` when supplied; wraps per-object commands in `kind: 'group'` with `viewToMat3(view)`.
- **`SceneCanvas.previewLayer.drawGL`** uses `slot.drawOneGL` for in-flight gesture preview (move/resize/rotate ghosts).
- **`defineDragInsertTool` overlay**: in-flight insert/text marquee. New `marqueeDrawCommands` helper next to `drawMarquee`; both factories share the math.
- **`useRectTool` overlay**: rect-tool marquee — also goes through `marqueeDrawCommands`.
- **`useSelectTool` overlay** (area-select branch): the screen-space marquee for drag-select. Move/resize/rotate ghost branches stay 2D-only because `SceneCanvas`'s preview-ghost layer covers them via `slot.drawOneGL`.
- **`createAnchorEditOverlayLayer`**: bezier anchor-edit overlay (tangent lines, control handles, anchors). Circles emit as 12-segment polygon paths via a local `circlePath` helper.

### Demo ports

22 demos got `drawOneGL` callbacks alongside their existing `drawOne`. Three commits, grouped by complexity:

- **12 simple-rect demos**: Actions, Animation, Clone, Compose, DebugOverlay, Groups, Layout, Move, MultiSelect, Pan, Resize, Zoom. Mechanical: `ctx.fillRect` → `{ kind: 'path', path: { kind: 'rect', ... }, fill: { color } }`.
- **5 strokes/rotation/alpha demos**: Easings (scene rect only), Rotate (T·R·T composed inline as column-major Mat3), NestedGroups, Viewport, Scene.
- **4 path-rendering demos**: Quadtree (scene rects), BezierEdit, PathPose, CompoundPaths. Path is the same type on both sides of the kit boundary, so most ports were one-line.

`InsertDemo` had been ported earlier as proof-of-concept. `TextDemo` needed no demo-side change — `createTextLayer`'s built-in `drawGL` covered it. `PixelDensityDemo` is bare `<canvas>` and not affected by the backend prop.

### Convention §17

Captured the lesson: **audit *every* layer for `drawGL`, not just the public ones**. The grep audit (in §17) is what would have caught the gap before step 9 ran. Step 7's port skipped scene-slot + tool overlays; step 8's done note flagged two but didn't enumerate the rest; step 9 was the first time the full surface ran end-to-end.

## Notable deviations from plan

- **Tasks 9, 10, 14, 15, 16 deferred**: baseline capture on `ubuntu-22.04`, iterative GL switchover, default flip, 30-day soak start, soak exit. These need the real CI runner *and* a calendar window we can't compress in a single session.
- **The "scaffolding only" framing was incomplete.** I scoped the implementer to tasks 1–8 + 11–13 thinking the rig would "just need baselines later." It actually couldn't have produced meaningful diffs even with baselines because half the rendering surface didn't exist under GL. The right framing was "step 9 is the rig PLUS a comprehensive GL-surface audit." Future-you: do the audit FIRST.
- **Implementer mis-reported the visual rig output as expected ("23 GL specs fail with dimension mismatch")**: the dimension mismatch was a real DPR bug (now fixed), not the plan-anticipated "no baseline" failure shape. I read the report at face value initially; should have bisected the failures instead of accepting the framing.

## Test results

- **Vitest: 1476/1476 pass**.
- **Playwright (existing GL smoke suite): 17/17 pass**. Visual rig is a separate test config not run in this session beyond verifying it boots; expects baselines to come from CI.
- **Typecheck**: only the pre-existing `draw.ts(138,84)` warning, unchanged from step 7/8.
- **Browser-verified**: every demo at `?backend=gl#<id>` renders scene content. Drag-insert / rect-tool / area-select marquees render correctly with dashed strokes on all four edges. The user did the verification interactively across many demos during the session.

## Lessons folded into conventions

- **§17 (new)** — Audit *every* layer for `drawGL`, not just the public ones. Grep recipe included.

## Open follow-ups

### Soak gate (cannot run in this session)

- **Task 9** — capture 2D baselines on `ubuntu-22.04` runner. Push the branch to a PR; let CI run `test:visual:update` and commit the baseline PNGs. This MUST happen on the pinned runner image; macOS Retina baselines are not portable.
- **Task 10** — iterative GL switchover: per-demo, run the visual suite under `backend='gl'`, fix divergences (text-baseline drift, stroke AA differences), iterate until ≤ 2% diff.
- **Task 14** — flip the demo's default backend to `'gl'` (one-line change once 10 is green).
- **Tasks 15–16** — 30-day soak clock + exit criterion.

### Remaining drawGL gaps (must close before flipping default)

- **`useCloneTool`'s `drawGhost` callback**: 2D-only API. Clone preview ghosts are invisible under `backend='gl'`. Needs a parallel `drawGhostGL?` option (or a default that uses scene-slot `drawOneGL`).
- **`EasingsDemo` track curve-plot RenderLayer**: custom screen-space layer with only `draw` — the curve plot doesn't render under GL.
- **`QuadtreeDemo` quadtree-cell overlay**: same shape as Easings — custom layer needs `drawGL`.
- **`CompoundPathsDemo` Comic Sans signature**: 2D-only text layer; needs `registerFont` + `kind: 'text'` port.
- **`ViewportDemo` / `SceneDemo` per-node text labels**: deferred; need `registerFont` asset wiring at the demo level.
- **`useEditAnchorsTool` overlay**: ported (anchor-edit overlay), but the circle approximation uses 12 segments — visually fine at typical sizes; might shimmer at large radii. Acceptable for v1.

### Pre-existing

- **`packages/weasel-gl/src/draw.ts(138,84)`** typecheck warning — flagged in step 7 and 8; clean up in step 10.

## Process lessons (process, not code)

1. **Run the comprehensive grep audit BEFORE shipping a "GL works end-to-end" step.** §17 captures the recipe.
2. **An implementer's report saying "X is the expected failure shape" deserves bisect verification when X feels off.** I lost ~30 min of investigation time accepting the implementer's framing of "dimension mismatch is the no-baseline shape" before bisecting and finding it was a real DPR bug.
3. **Step 9 is a soak, not a feature ship.** The rig is a means to the end. The real exit criterion is "30 days of `'gl'` default with zero regression bugs." That criterion can't be met in a single session and shouldn't be claimed prematurely.
