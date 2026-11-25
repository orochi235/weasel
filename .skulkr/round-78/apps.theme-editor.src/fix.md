Scales layer calls a `factors` scale "geometric" and has no Factors row (A): fixed 18aef16c9e

Unpinning a grid swatch removes every anchor of that color, hand-typed hex pin included (A): fixed e80ec6cbb1

"Reload from disk" reopens the draft when the browser refuses to clear it (A): fixed 8dfcf85459. "Discard this unsaved theme" had the same flaw and is fixed in the same commit. Question: I made the strict call to stay on the draft and show why. It is recorded in `docs/unruled.md`.

Resetting a by-axis pin with no branch at the selection records an empty undo step (A): fixed e3a1e046e6. This can only happen when an inherited pin applies at the selection. `clearAt` also now returns the variation itself for a nested branch it doesn't hold.

Per-theme undo histories in localStorage have no reaper and can fill the quota (B): fixed ad772eacb1. Question: I made the call to keep histories for the two themes saved most recently. When the browser refuses a save for room, the other themes' histories go and the save is retried. At load, histories of themes the server no longer lists are dropped. Recorded in `docs/unruled.md`.

Rail counts leave out inherited components, and count seeds differently from the seeds page (B): fixed 16d2965460. Question: I made the call that each rail count is what its layer's page lists. The header's own-token total is unchanged. Recorded in `docs/unruled.md`.

AnchorList's hints point to a panel the ramp gate editor doesn't have (B): fixed 89fd6a6a3c

Checks:
- `npx vitest run --maxWorkers=1` passed for each touched test file, one at a time:
  - `layers/ScalesLayer.test.tsx`
  - `SwatchPanel.test.tsx`
  - `ThemeEditor.reload.test.tsx`
  - `ThemeEditor.test.tsx`
  - `ThemeWorkbench.test.tsx`
  - `TokenLayer.test.tsx`
  - `theme/model.test.ts`
  - `theme/draftStorage.test.ts`
  - `theme/entries.test.ts`
  - `theme/ramps.test.ts`
  - `theme/starter.test.ts`
  - `AnchorList.test.tsx`
  - `PaletteLab.test.tsx`
  - `layers/RampsLayer.test.tsx`
  - `useLabHistory.persist.test.tsx`
  - `LayerRail.test.tsx`
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w <pkg>`: not applicable, since `apps/theme-editor` has no `package.json` and no package of its own. The root `npm run lint` inside the gate passed.
- No changesets: the theme editor isn't a published package, which matches earlier theme-editor fixes.

tally: 7 of 7 fixed, 1 extra fixed