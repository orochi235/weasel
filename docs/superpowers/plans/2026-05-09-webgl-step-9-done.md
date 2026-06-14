# WebGL Step 9 — Done (Rig + Wide GL Audit + Live Soak Round)

**Plan:** [`2026-05-09-webgl-step-9-visual-regression-rig.md`](./2026-05-09-webgl-step-9-visual-regression-rig.md)
**Date completed:** 2026-05-09 — rig + drawGL audit shipped; iterative soak still pending CI

> **Honest framing:** Step 9's plan was the visual regression rig + a 30-day soak gate. The rig (tasks 1–8, 11–13) shipped; soak tasks (9, 10, 14–16) need CI infrastructure and a 30-day window. Far more importantly, the user did a live soak in the demo browser during this session. That surfaced an **enormous** number of GL-backend gaps that went undetected through steps 7 and 8 because the visual rig hadn't actually been driven against any rendered output. ~30 commits in this single session closed the major ones; many smaller follow-ups remain. The commit graph from `cda92c3` (`SceneSlotConfig.drawOneGL` wiring) onward is the trail.

## What shipped

### Visual regression rig (the original step 9 scope)

- **`?backend=2d|gl` query string** in demo via `BackendContext` provider. All 24 demos wired. `PixelDensityDemo` left raw (bare `<canvas>`).
- **`tests/visual/playwright.config.ts`** — port 5174, 1280×800 @1×, single worker, `ubuntu-22.04`-pinned.
- **`tests/visual/diff.ts`** — pixelmatch harness with `assertMatchesBaseline` + `UPDATE_SNAPSHOTS=1`.
- **24 visual specs**, one per demo, tolerance overrides on text/compound-paths/bezier-edit/pixel-density.
- **`.github/workflows/visual.yml`** runs visual suite on PRs.
- **Bundle-size CI gate hardened** to fail on > 50KB delta.
- **`CONTRIBUTING.md`** documents the visual-regression workflow.

### Bug fixes surfaced by the live soak

#### Kit-side (affect every consumer)

- **DPR / canvas style**: `WeaselRenderer` now sets `canvas.style.width/height` (CSS layout size) in addition to the backing-store dims. Previously canvases laid out at 2× their intended CSS size on Retina.
- **`splitForDash` for closed polylines**: closing edge of every closed-polyline marquee was undashed (left edge of every rect-marquee invisible). Now iterates `ptCount` segments with wraparound.
- **Tessellator for compound paths**: previous nonzero implementation passed every contour after the first as a hole to earcut. Now detects winding direction relative to the first contour; same-sign contours are independent positives, opposite-sign ones are holes (grouped by point-in-polygon containment) or orphans (promoted to positives if not contained). Significantly improves duck/octopus/hamburglar — though octopus tentacles remain imperfect because they're open polylines under nonzero, a semantic mismatch with `ctx.fill()`.
- **Rect-path cache by dimensions**: `getMesh` now caches rect paths by `${x}_${y}_${width}_${height}` instead of Path identity. Animated demos creating fresh Path objects per frame no longer leak GL buffers via per-frame cache misses. 1024-entry cap.
- **`<Canvas>` `background` prop honored under GL**: prepends a screen-space rect command with the background color when set. Mirrors what the 2D path does via `ctx.fillRect`.

#### GL surface gaps closed

The audit revealed 6 layers without `drawGL` beyond what step 7/8 covered. All ported in this session:

1. **`buildSceneLayer` (Canvas.tsx)** — `SceneSlotConfig.drawOneGL?` option; `RenderLayer.drawGL` wraps per-object commands in `viewToMat3(view)` group.
2. **`SceneCanvas.previewLayer`** — uses `slot.drawOneGL` for in-flight gesture preview (move/resize/rotate ghosts) with alpha=0.85.
3. **`defineDragInsertTool`** — in-flight insert/text marquee. New `marqueeDrawCommands` helper.
4. **`useRectTool`** — rect-tool marquee (uses same `marqueeDrawCommands`).
5. **`useSelectTool`** — area-select marquee branch + new `drawGhostGL?` option for move/resize/rotate ghosts. The 2D-only `drawGhost` callback stays; consumers using bare `<Canvas>` (not SceneCanvas) opt in to `drawGhostGL` for ghost rendering during drag.
6. **`useCloneTool`** — new `drawGhostGL?` and `drawOneGL?` options parallel to 2D versions. Default GL ghost mirrors the 2D fallback (translucent outline rect).
7. **`createAnchorEditOverlayLayer`** — bezier edit overlay (tangent lines, control handles, anchors as 12-segment polygon circles).

### Demo opt-ins

22 demos got `drawOneGL` callbacks alongside `drawOne` (initial implementer pass). 6 demos got `drawGhostGL` opt-ins on `useSelectTool`/`useCloneTool` (Actions, Animation, NestedGroups, Groups, BezierEdit, Clone). Custom non-scene RenderLayers in 2 demos got `drawGL`:
- **`QuadtreeDemo`** quadtree-cell overlay (rect strokes, world-space)
- **`EasingsDemo`** track lines + curve plots + per-row labels
- **`CompoundPathsDemo` signature** ("original artwork by claude" — falls back to sans-serif since Comic Sans isn't a registered MSDF font; rendered red under GL to make the GL render path visually obvious)

### Font registration

- **`vite.config.ts`** `publicDir → packages/gl/fonts` so the inter atlas is served at `/weasel/inter/inter.json` + `/inter.png`.
- **`BackendProvider`** awaits `registerFont('sans-serif', …)` + `registerFont('Inter', …)` before mounting children when `backend='gl'`. First paint includes glyphs.

### New conventions

- **§17 (Audit *every* layer for `drawGL`)** — captured the lesson before the soak began. The grep recipe: `grep -rl "draw: (ctx" src/ | xargs grep -L "drawGL"`. Should run *before* asserting GL correctness on any future step.

## Notable deviations from plan

- **Soak compressed into one session.** The plan called for a 30-day soak window with iterative per-demo fix cycles. The user did a live soak in the demo browser; ~30 fix commits in one session compressed weeks of plan-time work. Real soak still needed to catch regressions over time, but the major rendering gaps are closed.
- **Octopus tentacles intentionally left imperfect.** They're open polylines under nonzero fill rule — `ctx.fill()` implicitly closes them and produces strange-looking fills that the GL tessellator can't easily match. Documented as a semantic mismatch; not fixable without changing `ctx.fill()` semantics or asking the demo to use `evenodd`/closed paths.
- **Easings text overlap pre-dates GL.** User identified during soak that emitting one TextDrawCommand per easing label produces multi-glyph overlap — but that's a pre-existing bug in the demo or 2D rendering, not GL-specific. Restored the labels to drawGL after temporarily removing them.
- **Tasks 9, 10, 14–16 deferred** to actual CI infrastructure + soak window. These are process / time-based, not code.
- **`PathPoseDemo` background-draggable, `SceneDemo` cream background draggable** — the user surfaced these but they're pre-existing gesture issues, not backend-related. Out of scope for this session.

## Test results

- **Vitest: 1477/1477 pass** (180 test files; +1 from baseline-set test split).
- **Playwright (existing GL smoke suite): 17/17 pass**. Visual rig's 24 specs aren't run in this session — they expect baselines from CI.
- **Typecheck**: clean for `packages/gl` modulo one pre-existing `draw.ts(138,84)` warning unchanged from steps 7/8.
- **Browser-verified** by the user across many demos under both backends. Most demos render correctly under GL after this session's fixes. Gaps documented below.

## Open follow-ups

### Soak gate (cannot run in this session)

- **Task 9** — capture 2D baselines on `ubuntu-22.04` runner.
- **Task 10** — iterative GL switchover with diff-tolerance-based fixes.
- **Task 14** — flip default backend to `'gl'`.
- **Tasks 15–16** — 30-day soak clock + exit.

### Known visual gaps (not yet fixed; user-surfaced during soak)

- **BezierEdit selection**: `pickEvery` uses `pointInPath` which returns false for open paths. Click-selection has never worked on this demo regardless of backend (the user re-reported it after my first explanation; unclear if there's a different selection mechanism we're both missing). Drag-marquee selection should work after the marquee + drawGL fixes.
- **Easings labels overlapping glyphs**: pre-existing demo bug per user — not GL-specific. Notation in done note for future fix.
- **AnimationDemo lag after first drag-release**: rect-cache fix should help but not yet user-verified. If still laggy, deeper profiling needed (React rerender storms, DPR scale loop, etc.).
- **Octopus tentacles partial fill**: open polylines under nonzero — semantic mismatch.

### Known kit-API gaps (architectural follow-up)

- **`Canvas` `background` honors color string but not Paint variants** — gradient/pattern backgrounds aren't supported under either backend. Out of scope.
- **`useCloneTool.drawGhostGL` default fallback** uses outline rects when `drawOneGL` isn't supplied. Consumers who set `drawOne` but forget `drawOneGL` get the fallback under GL; a future improvement could synthesize the GL ghost from `drawOne` via a 2D-canvas-to-DrawCommand bridge (not in scope).
- **Rect cache dimensions key uses raw float strings** — sub-pixel motion (e.g., 100.5px → 100.6px → 100.7px) thrashes the cache. Quantizing to int-pixels would help but lose smooth animation. Could be a future optimization.

### Architectural

- **`<Canvas>` is 1055 lines.** Step 10's swap halves it; further decomposition is a follow-up.
- **Pre-existing `draw.ts(138,84)` typecheck warning** still standing — clean up in step 10.

## Process lessons (in addition to §17)

1. **Live soak finds bugs that planning misses by an order of magnitude.** The plan estimated step 9 as "rig + iterative fix-loop." The reality was "rig + ~30 immediate kit-and-demo fixes that should have been caught in steps 7 and 8 if there had been any rendered-output testing."
2. **An implementer's "expected failure shape" report deserves verification when something feels off.** Lost ~30 min early in the session accepting the implementer's framing that "dimension mismatch is the no-baseline shape" before bisecting and finding the real DPR bug.
3. **Compound paths under nonzero fill are a semantic minefield.** Multi-positive vs outer-with-holes vs orphan-opposite-wound subpaths — the right algorithm depends on author intent that the path data doesn't always communicate. Document the contract in spec; recommend `evenodd` for ambiguous cases.
4. **Tool/gesture overlay layers are easy to forget** when porting public layer factories. They don't show up in a public API audit because they're internal to `useSelectTool`, `useCloneTool`, etc. The §17 grep recipe explicitly catches them.
