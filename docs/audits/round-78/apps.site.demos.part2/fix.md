Repeat connect keeps one edge per id (A+B): fixed 968bafdaef. `diagramScene` already drops the repeat, so the scene never collided, but the demo's data kept an edge nothing drew. The same append in `DiagramDropDemo` is fixed in that commit too.

Preview bitmaps minted in `useMemo` leak (A+B): fixed e559fd01a8. I measured the old pattern under StrictMode before fixing: 8 bitmap sets minted over 4 renders, 4 of them never closed.

Failed export leaves a stale picture under the new caption (A+B): fixed 00574278c0

Overlays demo "+" stays on the last hovered edge (B): fixed c106857ced. The hover now lasts 250 ms after the pointer leaves, and holds while the pointer is on the "+".

Gestures demo starts gestures on non-primary buttons (B): fixed 338b0b9e3b

No changesets: `apps/site` is not a published package, and earlier demo fixes in `git log` carry none.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file, one at a time: GesturesDemo.test.tsx pass, DitherDemo.export.test.tsx pass, DitherDemo.test.tsx pass, diagramShared.test.ts pass, DiagramDropDemo.test.tsx pass, DiagramOverlaysDemo.test.ts pass, EffectChartDemo.previews.test.ts pass, EffectChartDemo.test.ts pass
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w <pkg>`: not applicable, since `apps/site` has no package manifest. eslint on every changed file passed, and the gate's root `npm run lint` passed.
- Tree clean.

tally: 8 of 8 fixed, 0 extra fixed