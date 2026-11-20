A1 Move by / Rotate by enabled for a selection they can't change (A): fixed ae408c6f9c. They now give the answer Transform Again gives, through a new `selectionTransformAnswer` in editing that Transform Again also uses. A locked node is dropped from the batch, so a locked selection reads `NotApplicable`; a locked layer can read `Locked`.

A2 the current measurement can be a hidden one (A): fixed bc799a18f9. `currentMeasureId` passes over hidden measurements, and measurements on a hidden layer, using `nodeGates`. That covers the readout, Delete, Move by and Rotate by.

A3 a stale pick keeps Deselect Measurement enabled and swallows Escape (A): fixed cb1981b1a1. `unpick` is enabled only while the pick is the current measurement, and now declares `requires: ['scene']`.

A4 a measurement off its layer still paints and snaps but can't be picked, edited or cleared (A): question, recorded as an `Open:` line in `docs/unruled.md` in 666d4514ab. Neither way out is free. Making `measureIds` read the whole scene puts a walk of every node on each pointer move's hit test, which `measureEndSource.test.ts` ("reads only the measurement layer's nodes, not the whole scene") forbids. The other way, having the painter and snap source read only `ms.layer`, leaves that measurement data in the document with nothing drawing it. Which one is a design call.

B1 the readout shows the committed measurement during a drag (B): fixed b8477b06ba. The readout reads the node through `shownLookup` and subscribes to `scene.overrides`.

B2 the current measurement can be a hidden one (B): duplicate of A2, fixed by bc799a18f9.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/measure/src/measure.test.ts`: pass (34)
- `npx vitest run --maxWorkers=1 packages/measure/src/MeasureReadout/MeasureReadout.test.tsx`: pass (7)
- `npx vitest run --maxWorkers=1 packages/measure/src/useMeasureTool.test.tsx`: pass (11)
- `npx vitest run --maxWorkers=1 packages/editing/src/actions/transformAgain/transformAgain.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/editing/src/actions/transformAgain/transformAgain.frames.test.ts`: pass (4)
- `npx vitest run --maxWorkers=1 packages/editing/src/actions/transformAgain/transformAgain.keys.test.tsx`: pass (2)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed typecheck and typecheck:packages on my own changes (an unused `scene` parameter and two untyped ids in a test). I fixed them and folded the fix into ae408c6f9c.
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/measure` and `npm run lint -w @weasel-js/editing`: not run, because neither package has a `lint` script ("Missing script: lint"). Ran `npx eslint packages/measure/src packages/editing/src/actions/transformAgain packages/editing/src/index.ts` instead: pass.
- Tree clean apart from `.skulk/`.

tally: 5 of 6 fixed, 0 extra fixed