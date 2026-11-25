Canvas-stack loupe never resamples its color while timed layers animate (A): fixed 4b7638fe0d

`<SourceLoupe>` never retains its `CanvasSource`, so a captured WebGL source shows blank (A): fixed 01a14c3c4d

LoupeGestures registers on the camera's registry for its first commit, giving a false two-loupe warning and displacing the camera's loupe (A+B): fixed 188c25b07c

Lens with a camera fallback or `sceneView` thunk ignores camera moves under a still pointer (A): fixed 72aa5a9c34 (a new `useFollowed` hook re-reads the camera each visible frame and re-renders only when it changes)

Live clone lens shows a scrolled scroller at position 0 (B): fixed b72a615b57

Live clone lens goes stale on form input that doesn't change the DOM (B): fixed b72a615b57 (this shares a mirroring pass with the scroll fix, so one commit carries both, with a separate changeset for each)

Clone copy keeps the root's old size or offset after a DOM change (B): fixed b181b2502d (a recopy now repositions the copy, and a ResizeObserver catches a resize with no mutation; a root moved by layout outside it, with no resize, scroll, or reticle move, is still caught only on the next remeasure)

Checks:
- `npx vitest run --maxWorkers=1` passed for each touched or new file: LoupeGestures.test.tsx (9/9), SourceLoupe.density.test.tsx (2/2), TrialLoupe.sampling.test.tsx (2/2), LoupePainter.test.tsx (1/1), useFollowed.test.tsx (2/2), lens/cloneSource.test.ts (15/15). useLoupe.test.tsx (40/40) also passed as a neighbor check.
- Unrun browser tests: none were touched.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/labkit`: pass.
- `npm run check:changesets`: pass ("OK — 457 changeset(s)").
- The tree is clean.

tally: 8 of 8 fixed, 0 extra fixed