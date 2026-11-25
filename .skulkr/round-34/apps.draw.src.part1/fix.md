Fonts unreliable probe (`document.fonts.check` answers true for absent families), A: fixed a6ed78d6ea

Layers panel throws on an unknown path-effect kind (`effectNodeName`), and a `toString` kind labels the row "toString", A: fixed b40af33025

Swatch "none" toggle copies `toggleFocusedNone` instead of sharing it, A: fixed 4fda63dc83 (the context gains `toggleNone(slot)`, which the swatch and the `/` key both call)

Reviewer B's report is empty, so there are no B findings and no duplicates.

No extra defects found. There are no changesets because `apps/draw` is not a published package, and past draw fixes carry none either. I made no `docs/unruled.md` entries: none of the fixes needed a behavior call.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/fonts.test.ts`: pass (11 passed; 7 fail on the old `fonts.ts`)
- `npx vitest run --maxWorkers=1 apps/draw/src/nodeKinds.test.ts`: pass (4 passed; 2 fail before the fix)
- `npx vitest run --maxWorkers=1 apps/draw/src/LayersPanel.test.tsx`: pass (9 passed)
- `npx vitest run --maxWorkers=1 apps/draw/src/tools/colorContext/ColorContextProvider.test.tsx`: pass (5 passed; the new `toggleNone` test fails before the fix with `TypeError: result.current.toggleNone is not a function`)
- `npx vitest run --maxWorkers=1 apps/draw/src/ActiveSwatches.test.tsx`: pass (5 passed)
- `npx vitest run --maxWorkers=1 apps/draw/src/tools/colorContext/contribution.test.tsx`: pass (5 passed)
- `npx vitest run --maxWorkers=1 apps/draw/src/tools/colorContext/actions.test.ts`: pass (13 passed)
- `npm run typecheck:packages` does not cover `apps/draw`, so I ran `npm run typecheck` instead: pass (exit 0)
- eslint on the 7 changed files: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1354 changeset(s).")
- Tree is clean apart from `.skulk/`.