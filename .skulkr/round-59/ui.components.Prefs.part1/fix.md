- PrefsForm ignores path-keyed `renderers` for rows, object fields, bar cells, and headings (A): fixed 47b3a66bb9
- Empty `description: ''` draws an empty note paragraph in rail pane, section, and tab (A): fixed d81b8d9751 (also fixes PanePanel and ObjectLeaf panel notes)
- Empty description draws an empty paragraph in rail layout (B): duplicate of A's empty-description finding
- NotSplit story blurb claims marks and per-option controls (A): fixed a78da9e8bb (no test or changeset: blurb only, and PrefsForm.split.test.tsx already pins the behavior)
- NotSplit story blurb (B): duplicate of A's NotSplit finding
- PrefsRail stories have no nested page, so Foldable folds nothing (A): fixed 872b36dd02 (checked by rendering the story: Snapping now shows, and Wrapping folds under it; no test kept, no changeset)
- PrefsRail stories have no nested pages (B): duplicate of A's PrefsRail finding
- PrefKindBadge AllKinds story leaves out built-in kinds (A): fixed b985fb9e22 (the list now comes from a `Record<PrefKind, true>`, so a new kind can't be left out; no changeset)
- AllKinds leaves out six kinds (B): duplicate of A's AllKinds finding
- Columns layout keys each column by index, so a column appearing remounts the ones after it (B): fixed a6236b3271
- Text list adds `''` and reads non-strings as `''` instead of the item default (B): fixed 7f7ebb27d2 (`prefListTexts` takes an optional `pref`; labkit's `ControlRow` passes it too)

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each touched or affected file:
  - PrefsForm.renderers.test.tsx: pass (2)
  - PrefsForm.emptyDescription.test.tsx: pass (1)
  - PrefsForm.textList.test.tsx: pass (2)
  - PrefsForm.columnKeys.test.tsx: pass (1)
  - PrefsForm.heading.test.tsx: pass (8)
  - PrefsForm.objectRow.test.tsx: pass (4)
  - PrefsForm.test.tsx, kinds, conditions, entryConditions, itemConditions, mixedCompound, overConditions, splitKinds, and absent: all pass
  - labkit inDialog.test.tsx: pass (17)
- `npm run checks:gate`: all 32 passed
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run lint -w @weasel-js/ui`: none (ui has no lint script); eslint on every changed .ts/.tsx file: pass
- `npm run check:changesets`: OK
- No browser tests touched. Tree clean.

tally: 11 of 11 fixed, 0 extra fixed