- selectionRegion boxed hidden nodes and nodes on hidden or annotation layers (A+B, counted twice in N): fixed fa828334a4
- selectionRegion measured `{ px }` strokes at scale 1, so an export below scale 1 cut them (A): fixed 3b98b89bbe (third argument is now a name or `{ name?, scale? }`; draw passes `PNG_SCALE` to a format that reads `scale`)
- there was no way to read a selection's region from the revision drawn, so an edit mid-export cropped it (A): fixed 9de2c02201 (`selectionRegionSource` / `selectionRegionsSource`; the README and draw's `exportSelectionFile` now use it)
- `ExportOptions.background` was typed `string | null`, so the registry path could not take an `ExportBackground` function (A+B, counted twice in N): fixed 2c2589ce2a
- `exportRegions` threw synchronously when a format's `export` threw, though every other failure rejects (A+B, counted twice in N): fixed 2bafb23338
- `regionRenderArgs` handed the background function the shown scene, not the document it draws (B): fixed 597cc9e569

Extra: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - packages/export/src/selectionRegion.test.ts: pass (6)
  - packages/export/src/exportFormats.test.ts: pass (20)
  - packages/export/src/regionRenderArgs.test.ts: pass (1)
  - packages/export/src/captureExport.test.ts: pass (6)
  - packages/export/src/regionCoordinates.test.ts: pass (8)
  - apps/draw/src/exportPage.test.tsx: pass (6)
  - apps/draw/src/fileCommands.test.tsx: pass (15)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run check:changesets`: pass, "[changesets] OK — 2236 changeset(s)."
- `npm run lint -w @weasel-js/export`: not run. The package has no `lint` script (npm error: missing script). `apps/draw` is not a workspace either.
- `npx eslint` on every changed .ts/.tsx file instead: pass (exit 0)
- Unrun: packages/export/src/regionPng.browser.test.ts was not touched, so not applicable.

Tree is clean apart from `.skulk/`. Six commits sit on 01a0f34846, each with its own changeset.

tally: 9 of 9 fixed, 0 extra fixed