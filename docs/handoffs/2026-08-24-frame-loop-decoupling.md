# Frame-loop decoupling — in progress

**Worktree:** `.claude/worktrees/frame-loop-decoupling`, branch `worktree-frame-loop-decoupling`,
branched from `e5eaf7aa`. Nothing pushed.

**What this is:** implementing `docs/superpowers/specs/2026-08-24-frame-loop-decoupling-design.md`.
Two independent arcs, one plan each:

- `docs/superpowers/plans/2026-08-24-frame-loop-decoupling.md` — 11 tasks. **In progress.**
- `docs/superpowers/plans/2026-08-24-ephemeral-pose-overrides.md` — 13 tasks. **Not started.**

The plans carry the detail; this file only says where things stand.

## Status

Tasks 1-11 are committed (rAF paint loop, imperative view, pinch getter, SceneCanvas uncontrolled,
painted-version stamping, syncPaint, hidden-document deferral, non-subscribing useScene, live view thunk for
the text overlay, the demo camera on the handle, docs and the changeset). Tasks 1-4 were independently reviewed; 5-9 were implemented
with per-test mutation checks but have not had a separate review pass — do one over 5-11 together.
Running autonomously overnight 2026-08-24/25.

**What the arc actually bought, measured** (Task 10, second table in `docs/TODO.md`; the original
table's load was never recorded so it could not be reproduced, and was left untouched rather than
contaminated). The scene-graph platformer went 3.94 → 2.88-3.21 ms busy per frame, and effectively
all of that is the demo's own move to `setView`: with the camera left in `useState` the kit frame loop
alone measured 3.86 ms against main's 3.94, a 0.08 ms delta inside a 0.33 ms run-to-run spread — no
measurable timing difference. The mechanism, not the number, is the finding: a consumer rendering
every frame pays for that render whatever the canvas does underneath it. The immediate-mode twin,
which never had per-frame consumer state, gained **44% from the kit change alone**: 1.58 → 0.89
ms/frame, and 118 `CanvasInner.setState` per second → **0** — firm structurally rather than
statistically, since that twin was untouched by the branch and renders an empty scene at a constant
view. GC did not move, as expected — that is the ephemeral-pose-overrides arc.

**The remaining per-frame render cost is `SceneCanvas`'s own scene subscription.**
`useSyncExternalStore` at `SceneCanvas.tsx:894` means every `scene.batch` commits even when the host
opted out via `useScene({ subscribe: false })`, so the platformer still commits ~100-110x/s. Task 10's
demo test had to freeze the per-frame scene sync to isolate the camera at all. The ephemeral-pose-
overrides plan is what closes this: overrides never bump the version, so they never notify.

**Two decisions from Tasks 6-7 worth a second look.** (a) The redraw tripwire and the loop's
alive-arming are `useLayoutEffect`, not passive — `syncPaint` otherwise means "before the next frame"
rather than "before the browser paints the DOM", and passive arming makes the StrictMode remount
paint nothing. (b) `document.hidden` suppresses the *sync* paint too, so a background tab does no GPU
work per commit; the cost is that a synchronous readback taken from a hidden tab sees the pre-hide
frame until it becomes visible.
The plan's tasks are all committed. Baseline at branch point was 7372 tests; currently 7429, tsc and lint clean; visual baselines pass locally (36 passed, 3 skipped);
`check:bumps` OK with a single `patch` changeset.

**Task 3 must land before Task 4.** `usePinchZoomTool` mirrors its `view` argument into a ref per
render, and `usePinchGesture`'s `scaleFactor` is a per-frame delta, not cumulative — so once
`SceneCanvas` goes uncontrolled (Task 4) with no getter in place, every pinch move zooms from the
same frozen base and snaps back. A dead pinch, not a slow one. Not reachable before Task 4.

Task 1 grew one thing the plan didn't call for: the loop was extracted to
`packages/core/src/canvas/useFrameLoop.ts` (`@internal`), because Task 2 was about to add a second
ref-plus-subscriber-set to an already-1400-line `Canvas.tsx`.

## Decisions made in conversation, not visible in the code

- **No dev-mode warning for scene-derived DOM inside `startTransition`.** The spec asks for one "if
  detectable"; React exposes no way to ask whether the current render is a transition. It ships as a
  documented rule in Task 11 instead of a check that would give false confidence.
- **`useSceneRef` became `useScene(..., { subscribe: false })`** — two hooks differing by one line
  isn't worth the surface.
- **One changeset for the whole arc**, written in Task 11. Reviewers have asked for one per task;
  decline. It is `patch`, like every changeset in this repo.
- **A throwing layer's `catch` belongs in `drawLayers`, not `useFrameLoop`** — scheduling has no
  information about what a draw failure means, and the granularity is wrong. Recorded as a P2 under
  "Rendering & paint" in `docs/TODO.md`; explicitly out of this arc.

## Traps this arc keeps hitting — read before writing a test

Five green signals so far have meant nothing. The plan's "How to test" section states the first two;
all five are worth knowing:

0. **Object literals in JSX defeat identity-based tests.** An inline `layers={{…}}` is fresh every
   render and fires a repaint by itself. Dropping `viewProp` from the canvas repaint tripwire left
   all 643 canvas tests green for exactly this reason — the one test guarding it passed for an
   unrelated cause.
1. A test counting renders of an **outer wrapper** proves nothing — a `setState` inside `Canvas`
   never re-renders its parent. Count commits with `<Profiler>` around the component under test.
2. A canvas test only paints if `getContext('webgl2')` answers like WebGL2. `vitest.setup.ts` stubs
   it to `null`; install the GL recorder in `beforeAll` or every painting assertion passes vacuously.
3. **Refs survive StrictMode's simulated remount** (setup → cleanup → setup). Task 1 shipped a blank
   canvas in every demo — 7379 tests green — because a flag cleared in cleanup was never re-armed in
   setup. Any flag with that shape needs a `<StrictMode>` test.
4. `--project=kit packages/hud` matches **no files** and passes cheerfully. Hud tests are
   `--project=weasel-ui`. Use `npm run test:unit`.
5. A "renders without throwing" smoke test stayed green through a total break (shaders were never
   compiled for several commits). Assert the effect, not the absence of an exception.

## Next

Nothing in the plan is outstanding. What remains before the branch merges is the "Before merging"
list below: a review pass over Tasks 5-11, and driving the demos by hand.

## Two adjacent arcs this work spawned

**`mac-pinch-zoom` branch** (worktree `.claude/worktrees/mac-pinch-zoom`, off `main` at `7b0f20b8`)
— created and branched, **no work done in it yet**. Every agent spawned from a worktree-pinned
session inherits that pin, so nothing can write there until a session switches into it
(`EnterWorktree` with its path). Needs `npm install` first. Three pre-existing bugs, unrelated to the
frame loop, found because the user reported the viewport demo's pinch not working — all three
confirmed read-only against `main`:

1. A Mac trackpad pinch (`wheel { ctrlKey: true }`) matches no binding. `matchModifiers`
   (`packages/gestures/src/ui/match.ts:71-101`) treats `mods: { mod: true }` as platform-*exclusive* —
   on Mac it requires `meta` and leaves `ctrl` forbidden. Unmatched means no `preventDefault`, so the
   browser's native ctrl+wheel page zoom runs instead. `viewportZoom.ts:5-6` claims the opposite.
   Fix is a dedicated `mods: { ctrl: true }` binding, **not** relaxing `mod` — Ctrl+click is the
   macOS context menu and must not become Cmd+click kit-wide.
2. `IS_MAC` (`useGestureDispatcher.tsx:61-65`) uses `navigator.platform ?? navigator.userAgent`;
   jsdom's `platform` is `''`, which is not nullish, so **the whole suite runs as non-Mac** and
   never exercised bug 1. `??` should be `||`.
3. `viewport.pinchZoom: true` double-applies: `pinchZoomAction` is already unconditional in
   `useStandardActions.ts:161`, and the flag additionally mounts the legacy hook at
   `Canvas.tsx:925`. Measured `[2]` vs `[2, 4]` — the demo's own opt-in breaks the default path.

**`animatedZoom` — decided, not started.** The prop is declared (`SceneCanvas.tsx:600`), documented,
and read by nothing; Cmd+= is a bare `view.set`. The user chose to **implement it on the animation
system** rather than drop it: the zoom action tweens through `Animator`, and `useViewTween`'s bespoke
rAF loop (its own `lerp`, its own private `easeOutCubic` while `animation/easings` exports that plus
~40 more) folds into it or is deleted. This lands **after** the frame-loop arc merges — driving the
view per tick is only free once `setView` costs no render. The false blurb claims in
`apps/site/registry.ts:343` and `ViewportDemo.tsx:100` are being removed now and should be restored
when this ships.

Two more things found while confirming those:

- `packages/core/src/canvas/Canvas.viewport.test.tsx:58` is `it('mounts without error when
  viewport.pinchZoom=true')` — the smoke-test shape that has hidden three separate breaks on this
  arc, and the reason the double-apply went unnoticed.
- No Safari `gesturestart`/`gesturechange` handling exists anywhere in the repo; that is the other
  trackpad-pinch channel.

**The main checkout is not on `main`.** `/Users/mike/src/weasel` sits on
`feat/labkit-presentation-pass` at `b2c403b5` (a concurrent session). Do not assume that tree is on
trunk, and do not switch it.

## A pre-existing bug this arc fixed in passing

**Double-click-to-edit text had been broken for twelve days.** `d6c2effa` (2026-08-13) swapped a loop
from ids to nodes and updated the loop body but not the two `startEdit` calls, leaving
`String(order[i])` to stringify a node as `"[object Object]"` — so every double-click started an edit
on a nonexistent id and no overlay appeared. Fixed in Task 9's commit (`99e2f969`), because the thunk
test could not assert anything real over a broken path. No test in the repo caught it.

## Follow-ups this arc surfaced but does not own

- **Demos that could adopt `useScene(..., { subscribe: false })`** — they mutate scene poses from an
  animation tick, so each mutation currently forces a blocking render: `EasingsDemo.tsx:49` (a
  `setPose` per marker per frame; its track layer draws from constants, not scene data) and
  `TimelineDemo.tsx:43` (`move()` from a sampled track's `onTick`; its DOM state is its own, not
  scene-derived). `SideScrollerDemo.tsx:68` is Task 10's.
- **A host's scene subscription is redundant for painting** when the scene only reaches
  `<SceneCanvas>`, which runs its own `useSyncExternalStore` at `SceneCanvas.tsx:894`.

## Before merging

- **Two commits share the subject "give the canvas view an imperative setter, getter and
  subscription"** (`f0822a01`, then `feed266d` with the review fixes). The second was meant to be an
  amend, but an unrelated commit had landed in between. Content is correct and linear; reword or
  squash when merging.
- **Drive the demos.** Task 4 moved ~39 of ~52 SceneCanvas demos from the controlled path to the
  uncontrolled one. Only `#viewport` and `#pan-zoom` have been driven by hand. The suite does not
  cover this: it has been green through a blank canvas, uncompiled shaders, and a doubled zoom
  factor.
- **The visual baselines pass locally** after the paint moved a frame later (36 passed, 3 skipped,
  2026-08-25) — `tests/visual/diff.ts:81-86` waits two rAFs plus 150 ms, which the loop satisfies. A
  local pass does not imply CI passes for hairline strokes in this repo; check the CI run.
- **Run `npm run prepublishOnly`-equivalent gates** (`tsc --noEmit && vitest run && tsup build`)
  before any push; `vitest` alone does not typecheck production code.


## What the review caught after the arc "finished"

Worth reading before trusting a green suite here again:

- **`syncPaint` + `subscribeFrame` recursed without bound.** `useFrameLoop` released its re-entrancy
  guard before notifying subscribers, so a subscriber calling `requestRedraw` re-entered the paint
  synchronously — 21 paints from one request, capped only by the probe. The comment two lines below
  claimed the case was handled. The changeset prescribes `subscribeFrame` as the fix for the loupe's
  stale readback, so the documented remedy would have hung a `syncPaint` tab.
- **The skew was documented backwards** — and the correction is not a flip: a *view* change leads
  with pixels (no render happens), a *scene* change leads with DOM (`SceneCanvas` commits, pixels
  land next frame). That is why `getPaintedVersion()` exists.
- **The "~2%" figure was below the instrument's resolution** — a 0.08 ms delta inside an 11%
  run-to-run spread. The conclusion is structural and stands; the number is gone.
- **Two more false-green tests**, bringing the arc's total to six. One passed only because `paint`
  bails on a null canvas ref rather than because the flag under test worked.
