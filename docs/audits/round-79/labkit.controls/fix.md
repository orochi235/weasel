Canceled draft never puts the drafts back (A): not a defect. The "Edit callbacks" rule in `docs/conventions.md` has every control send `onInput` the value the edit began from before `onCancel`. Ran it: a number typed `2`, `23`, then Escape drafts `['count', 1]` back. labkit has one value per row, so it needs no separate `cancel`.
Canceled draft never puts the drafts back (B): duplicate of the A line above.
Own auto set pins a row on its first draft, so Escape leaves it pinned (A): fixed dbe32c5061
Own auto set pins a row on a draft, and Escape leaves it pinned at the stale value (B): duplicate of the A line above.
Encoded leaf: rows pass no siblings, and an absent value is decoded from the leaf's default (A): fixed in two commits, 555c54f3cd (the default) and b6915785df (the siblings).
Encoded leaf holding nothing gets its decoded default as its stored value (B): duplicate of the default half of A's line, fixed 555c54f3cd, which also covers `MatrixCell` and `MatrixEditor`.
labkit's fields never pass `siblings` to an encoding (B): duplicate of the siblings half of A's line, fixed b6915785df.
A pair's whole-row check misses segmented toggles and enums with no declared control (A): fixed 58c14fda3f
A paired segmented `.toggle()` enum doesn't take the whole row (B): duplicate of the A line above.
Matrix popover keeps its captured cell after the cell's row or alias target changes (A): fixed f3df00ff2e
inDialog's `update` reads the render's draft, so two updates in one event lose the first (A): fixed 4a1fd2ab5b
inDialog's `update` loses the first of two updates in one event (B): duplicate of the A line above.
One section declaring `collapsed` makes every section and group foldable (B): fixed a3e3646bb5

Extra defects:
A custom row's `ctx.update` and `ctx.drafts.update` in `labRowContext` (sweep): same mistake as the dialog `update`. Fixed in the same commit, 4a1fd2ab5b, with its own test, so it is not counted in X.
Supporting changes inside the fix commits, not defects:
- `usePanelAuto` moved into `panelAuto.ts`, and `CompoundRow` into `CompoundRow.tsx`, to keep `ControlRow.tsx` under the size caps.
- `labField` now takes one options object.
- `siblingsAt`, `autoRowValue` and `useLabFieldSetting` are now the one copy that every caller uses, where each call site had its own before.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file, at the final commit: `ControlPanel.autoOwn` 5 passed, `ControlPanel.encoded` 2 passed, `fields` 2 passed, `ControlPanel.span` 5 passed, `ControlPanel.sections` 22 passed, `inDialog.commit` 8 passed, `ControlPanel.renderContext` 5 passed, `ControlMatrix.conditions` 6 passed. No browser test files touched.
- Neighboring files, pass, run mid-session before the later commits: `ControlPanel.auto`, `autoLive`, `autoOptIn`, `autoReport`, `drafts`, `stops`, `bar`, `rows`, `layout`, `changed`, `fold`, `emptySections`, `sectionEnable`, `renderers`, `headingControl`, `compoundRows`, `ResetGroup`, `inDialog`, `inDialog.cancel`, `ControlMatrix`, `ControlMatrix.over`, `ControlMatrix.grid`, `ControlMatrix.numbers`.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/labkit`: pass. Its biome warnings were already there, in test files I didn't touch.
- `npm run check:changesets`: pass ("OK"). My six title-length warnings were fixed by shortening the titles.
- `npm run typecheck:packages -- labkit`: pass ("1/1 labkit ok").

tally: 11 of 13 fixed, 0 extra fixed