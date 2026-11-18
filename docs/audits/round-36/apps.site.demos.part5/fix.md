Nine findings: all fixed, none disputed. Nothing in `docs/unruled.md` changed.

- **Second "save frames" click while one is running breaks the run** (A+B): fixed 064520c958. The button is now disabled while a save runs, a second save is refused, and a run only clears the controller it owns.
- **Frames save keeps downloading after the demo unmounts** (A+B): fixed 76d37ef4ad. An effect cleanup aborts the running save.
- **Flick block held still before release is thrown at stale velocity** (A): fixed 92bf5fd276. Velocity is now read with `getVelocity(performance.now())`. No other caller in `apps` or `packages` has the bare `getVelocity()` form.
- **Flick dropped with too few moves lands off the grid** (A): fixed 574aad5418. A flight that settles before the 180 ms retarget now snaps to the nearest cell when it lands.
- **TrialClock loses its direction on Pause then Play, and Reverse while paused starts it** (A+B): fixed c7db9b6a4d. The direction is kept as its own state beside `rate`.
- **VertexColor tween or stagger clicked mid-run snaps back and replays** (A+B): fixed 53eb107896. Tweens on one node and channel add, so each new run starts from where the last one was headed and goes to the other end. The wave now turns back from the colors on screen with no jump, and the final colors are committed.
- **Near-circle preset promises an exact NURBS circle it never draws** (B): fixed 89eb3021cc, by correcting the description. Adding weights would not help: the lab's NURBS is cubic on uniform clamped knots and cannot draw an exact circle from four cardinal anchors.
- **Inflection overlay misses a curvature that lands exactly on 0 at a sample** (B): fixed 28a40bf7c5. The sign is now compared against the last nonzero curvature. A straight run between curvatures of one sign still gets no marker.
- **TextOutlinesDemo caches a failed font load forever** (B): fixed fc552bfdab. A rejected load is forgotten so the next mount retries, and the effect warns instead of leaving the rejection unhandled.

No extra defects found while fixing.

There are no changesets: every change is in `apps/site`, which is not a published package.

Checks:
- vitest, one file at a time with `--maxWorkers=1`: all pass.
  - `apps/site/demos/__tests__/TimelineFramesDemo.test.tsx`: pass (2)
  - `apps/site/demos/__tests__/animationDemo.integration.test.tsx`: pass (7)
  - `apps/site/demos/__tests__/TrialClockDemo.test.tsx`: pass (2)
  - `apps/site/demos/__tests__/VertexColorAnimationDemo.test.tsx`: pass (4)
  - `apps/site/demos/__tests__/curveLabPresets.test.ts`: pass (1)
  - `apps/site/demos/__tests__/CurveLabDemo.test.tsx`: pass (2)
  - `apps/site/demos/__tests__/curveLabInflections.test.ts`: pass (3)
  - `apps/site/demos/__tests__/TextOutlinesDemo.test.tsx`: pass (1)
- `npm run typecheck`: pass. I ran this instead of `typecheck:packages` because no package changed; the site is covered by the root program.
- eslint on every changed file: pass.
- `npm run check:size`: pass ("no file or function grew past its cap").
- `npm run check:changesets`: pass ("OK — 1699 changeset(s)").
- `check:test-projects`, `check:frame-loops`, `check:timers`: pass.
- Unrun: no `*.browser.test.*` files were touched.

The tree is clean and `.skulk/` is untouched.