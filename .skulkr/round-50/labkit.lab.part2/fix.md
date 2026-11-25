nebula ramp checked against weaselTheme instead of the lab's theme, so a ramp only the lab's theme declares throws (A): fixed 8168245750

floating panels all pinned to one corner, so a second covers the first (A): fixed 6925df09bf. They now stack in a column down the top-right corner, and the floating-strategy zone nothing ever registered in is removed. Its reproduction is `Workspace.floating.browser.test.tsx`, which can't run here and is unrun.

toggling `reorderable` remounts every tile (A): fixed 990ef7e899. `TileGrip`'s draggable form had the same remount problem for its own contents, fixed in the same commit.

`onReorder` returns `lk-panel-*` ids, and a child id with that prefix renders as an empty panel (A): fixed 7d7621fd46

one `useLabAmbient` caller unmounting removes every install of the same array (B): fixed cfd80b2cea

a lab presenting inline clears its host page's root background and color-scheme (B): fixed 11b7e21276. The lab root now gets `lk-lab--framed` only inside a frame, and the rule keys on that class. jsdom covers the class; the existing browser test for the CSS is unrun here.

`presentation.enter()` with no focused trial hides the chrome and presents nothing (B): fixed 8fd70898f7. `enter()` now does nothing until a trial is focused.

Extra defects, found by the gate (both were already in the frozen tree):

`apps/draw` audits treemap restated `tabular-nums`, which fails `check:numeric` (sweep): fixed a8ab69ce70

SpanStrip's `font-size` and `line-height` repeated the same calc, and its 22px height fallback failed labkit's `check-design-tokens` (sweep): fixed f864b522ed

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 32 passed", including step 27, `npm run lint -w @weasel-js/labkit`). A separate `npm run lint -w @weasel-js/labkit` was refused by this machine's hook, so only the gate's run of it counts.
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `Lab.nebula.test.tsx`: 4 passed
  - `labAmbient.test.tsx`: 1 passed
  - `Lab.presentation.test.tsx`: 13 passed
  - `Workspace.reorder.test.tsx`: 3 passed
  - `Workspace.test.tsx`: 12 passed
  - `Lab.undock.test.tsx`: 9 passed
  - `LabBoundary.test.tsx`: 3 passed
  - `Lab.still.test.tsx`: 12 passed
  - `SpanStrip.test.tsx`: 15 passed
- Unrun (browser): `packages/labkit/src/lab/Workspace.floating.browser.test.tsx`, `packages/labkit/src/lab/presentation.browser.test.tsx`
- Tree clean.

tally: 7 of 7 fixed, 2 extra fixed