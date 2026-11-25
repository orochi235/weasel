Spline editor's "cardinal (s = 0)" label clipped past the view box (A): fixed 035ba2870b

"Badge JSX" / "Changed params" textareas keep the old snippet after the config changes (A+B): fixed 6addc34951

Each wheel event over a spline anchor is its own undo step and steps a fixed 0.1 (B): fixed 29c8766517 for the step size. The weight now moves 0.1 per 100 units of `deltaY`, and a scroll too small for a whole step carries over to the next event on the same dot. The undo half is not a defect: labkit already merges writes to the same path that arrive within 500 ms (`GESTURE_MS`). The new test in `splineUndo.test.tsx` shows three scrolls undone by one Undo.

None of the fixes has a changeset. `apps/ui-lab` has no `package.json`, so there is no package for one to name.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file, one at a time: `splineGeometry.test.ts` 14 passed; `OctantSplineEditor.test.tsx` 10 passed; `splineUndo.test.tsx` 2 passed; `PresetsPanel.test.tsx` 1 passed; `ShapesInstrument.test.tsx` 1 passed. Each new test failed before its fix.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w <pkg>`: not run, since no package changed. The root `npm run lint` passed inside the gate.

tally: 3 of 3 fixed, 0 extra fixed