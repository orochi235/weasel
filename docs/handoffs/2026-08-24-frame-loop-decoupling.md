# Frame-loop decoupling — in progress

**Worktree:** `.claude/worktrees/frame-loop-decoupling`, branch `worktree-frame-loop-decoupling`,
branched from `e5eaf7aa`. Nothing pushed.

**What this is:** implementing `docs/superpowers/specs/2026-08-24-frame-loop-decoupling-design.md`.
Two independent arcs, one plan each:

- `docs/superpowers/plans/2026-08-24-frame-loop-decoupling.md` — 11 tasks. **In progress.**
- `docs/superpowers/plans/2026-08-24-ephemeral-pose-overrides.md` — 13 tasks. **Not started.**

The plans carry the detail; this file only says where things stand.

## Status

Tasks 1-4 are committed and reviewed (rAF paint loop, imperative view, pinch getter, SceneCanvas
uncontrolled). Task 5 in progress; running autonomously overnight 2026-08-24/25.
Tasks 6-11 not started. Baseline at branch point was 7372 tests; currently 7401, tsc and lint clean.

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

Task 3 (pinch zoom reads a view getter). Two things to fold in when it or Task 4 is dispatched:

- `usePinchZoomTool` currently reads `viewRef.current` at render scope, so in uncontrolled mode a
  pinch after an imperative `setView` zooms from a stale camera. Task 3 closes it.
- The controlled-mode `setView` warning fires per pinch-move and says "ignored" when `onViewChange`
  still honors the write. Task 4 removes the controlled path for `SceneCanvas`, but a bare
  controlled `<Canvas>` with pinch keeps it. Warn once per mount, or reword.


## Two adjacent arcs this work spawned

**`mac-pinch-zoom` branch** (worktree `.claude/worktrees/mac-pinch-zoom`, off `main`) — three
pre-existing bugs, unrelated to the frame loop, found because the user reported the viewport demo's
pinch not working:

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
