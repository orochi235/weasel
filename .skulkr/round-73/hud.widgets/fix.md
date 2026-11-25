Zero-area host (A+B): fixed 8c5d649514

Rect window border ring straddles its bounds (A+B): fixed fa88255317

`setBounds` height dropped on a list made without `height` (A+B): fixed 66727329d0. This was a behavior call, so I made it and recorded it in `docs/unruled.md`. `setBounds` now takes `height` as optional. A height given fixes the list's height, and one left out keeps it following its rows. The changeset is `minor` (`fix api behavior`).

Hover stays on the old row after a wheel scroll (A+B): fixed cf548ba6ae

A focused list whose rows went empty and came back has no active row (A): fixed 68587ca9e4

List shows no focus on Tab-in (B): fixed 3b7a6b3548. This adds optional `HudDrawCtx.focusVisible`, which `createLayerDraw` fills in. The list rings its active row when it holds focus and either the HUD shows focus or a key moved last. The changeset is `minor` (`fix api visual`).

Extra commits (no defects): 5bf7f97e88 moves the list's measuring and scroll-to-show into module functions, because the fixes pushed `createList` past check:size's 120-line function cap. The zero-area fix also updated `window.pbt.test.ts`, whose model had copied the old clamp-to-zero behavior; that change is folded into 8c5d649514.

Checks:
- `npx vitest run --maxWorkers=1` for each file:
  - `window/window.test.ts`: pass (52)
  - `window/window.pbt.test.ts`: pass (2)
  - `window/window.shrunk.test.ts`: pass (3)
  - `list/list.test.ts`: pass (19)
  - `list/list.pbt.test.ts`: pass (2)
  - `focus.test.ts`: pass (14)
  - `hud.pbt.test.ts`: pass (1)
  - `attach.focus.test.ts`: pass (23)
  - `attach.cache.test.ts`: pass (13)
  - `layerDeps.test.ts`: pass (5)
  - `attach.pbt.test.ts`: pass (3)
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed typecheck (a missing `dpr` in a test) and check:size; both are fixed and the rerun passed.
- `npm run check:changesets`: "[changesets] OK — 664 changeset(s)."
- `npm run lint -w @weasel-js/hud`: not run, because `@weasel-js/hud` has no lint script. eslint on every changed file passed with no output.
- Tree clean.

tally: 10 of 10 fixed, 0 extra fixed