# Frame-loop decoupling — in progress

**Worktree:** `.claude/worktrees/frame-loop-decoupling`, branch `worktree-frame-loop-decoupling`,
branched from `e5eaf7aa`. Nothing pushed.

**What this is:** implementing `docs/superpowers/specs/2026-08-24-frame-loop-decoupling-design.md`.
Two independent arcs, one plan each:

- `docs/superpowers/plans/2026-08-24-frame-loop-decoupling.md` — 11 tasks. **In progress.**
- `docs/superpowers/plans/2026-08-24-ephemeral-pose-overrides.md` — 13 tasks. **Not started.**

The plans carry the detail; this file only says where things stand.

## Status

Task 1 (rAF paint loop) and Task 2 (imperative view) are committed. Task 2's review is outstanding.
Tasks 3–11 not started. Baseline at branch point was 7372 tests; currently 7389, tsc and lint clean.

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
