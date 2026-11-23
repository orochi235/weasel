Anchors outnumbering colors, from A: fixed 0c8e106456

Distance gate's 0.005 slack disagreeing with the generator, from A: fixed 621b2fc672

Dead "would need N° of circle" line, from A: fixed e48ea5ecf2 (replaced with a line naming two pinned hues that sit closer together than the hue floor)

Clearing a pin that varies by axis dropped every branch, from A: fixed 2475867251, plus 8c6abcf634 (the `setOwn` write that `check:proto-index` asked for)

`writeAt` replacing a whole variation when the selection doesn't choose its axis, from A: fixed 51f90aa9d4 (the editor never reaches that case, because `layerEntries` leaves out a seed with no value at the selection and a pin that does not apply. `writeAt` and `clearAt` now throw there. That is a strict call, recorded in `docs/unruled.md`.)

SemanticDrawer number fields writing NaN when cleared, from B: not a defect (`UnitField` with no `onClear` puts its value back. I confirmed it with a test that cleared Alpha, Minimum and Offset: no call carried NaN, and typing a number still committed. AnchorList's comment saying otherwise was stale.)

Pin edit and Remove/Reset/unpin sharing one history key, from B: fixed ec3a3eb380 (PinRepair, TokenLayer, RampsLayer and SemanticsLayer all now use `unpin:` for removal)

Jumping to an inherited component opened an empty Components layer, from B: fixed 24511edc20 (no jump can reach the Seeds layer, since no token's provenance names it)

Restored palette history steps skipping `stateOf`, from B: fixed b553086dac (`LabHistoryStore.read`, applied to every rebuilt step and to matching the step to resume at)

Semantic cell `produced` undefined for a pin over a token with no generated value, from B: not a defect (`derive.ts:119` always sets `generated: prior` along with `pinned: true`, and I checked it on a pin over a failing ref rule)

Extra: removed AnchorList's stale comment that a cleared field commits NaN, from sweep: fixed 187786efa8

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: palette/unmetGates.test.ts, PalettePreview.test.tsx, PaletteLab.test.tsx, AnchorList.test.tsx, TokenLayer.test.tsx, theme/model.test.ts, PinRepair.test.tsx, theme/entries.test.ts, useLabHistory.persist.test.tsx, useLabHistory.test.ts, presets.test.ts, layers/RampsLayer.test.tsx, layers/SemanticsLayer.test.tsx and ThemeWorkbench.test.tsx: pass, all files.
- `npm run checks:gate`: the first run failed `check:proto-index`. After the fix, "checks:gate: all 33 passed".
- `npm run lint -w`: not run. `apps/theme-editor` has no package.json, so it is no workspace. eslint on `apps/theme-editor/src`: pass, exit 0. The root `npm run lint` passed inside the gate.
- No changesets: the theme editor is an app, not a published package.
- The tree is clean.

tally: 8 of 10 fixed, 1 extra fixed