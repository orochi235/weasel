Range style reads italic and overrides as mixed when every run renders the same value (A): fixed 5c224f7934. `styleAtRange` now takes an optional fourth argument holding the node's style and paint. When it gets one, it fills in what each run inherits from the node before comparing runs, so italic, `fontFamily`, `fontSize`, `fontWeight` and the other keys a node also carries only read `MIXED` when they really render differently. `useTextEdit` passes the node in both places it reads a range: the published `rangeStyle` and `toggleStyle`. So Italic shows as on, and Cmd+I turns it off, across such a selection. Tests in `effectiveRangeStyle.test.ts` and `useTextEdit.rangeStyle.test.ts` failed before the fix (5 and 2 tests) and pass after.

`measureTextBounds` lays out justified text without `justify` and `alignWidth` (A+B): not a defect. The layout already turns `align: 'justify'` into `justify: true` (`layoutOpts.ts:88`, `layoutCache.ts:110/164`), and `alignWidth` defaults to `maxWidth`, so these options produce the same layout as a node with that style. With `fitBox` and no `maxWidth`, nothing wraps, and justify only spreads lines that wrapped.

Run-grammar `repeat` of 0, a negative, or a fraction hangs `markdownToRuns` (B): fixed 6d5eef4723. `markersByDelimiter` now throws unless `repeat` is a positive integer, the same way it already rejects a bad delimiter. Before the fix, the new test in `runs.test.ts` hung until a 60 s timeout killed it; it passes after.

Extra defects found while fixing: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `packages/text/src/runs/effectiveRangeStyle.test.ts`: pass (25)
  - `packages/text-dom/src/useTextEdit.rangeStyle.test.ts`: pass (20)
  - `packages/text/src/runs.test.ts`: pass (43)
  - `packages/text/src/runs/rangeStyle.test.ts`: pass (61)
  - `packages/text/src/runs/rangeStyle.pbt.test.ts`: pass (1)
  - `packages/text-dom/src/useTextEdit.history.test.ts`: pass (5)
  - `packages/text-dom/src/useTextEdit.shortcuts.test.ts`: pass (18)
  - `packages/text-dom/src/useTextEdit.pbt.test.ts`: pass (1)
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed `check:size` (`useTextEdit` at 124 lines); I moved the lookup into `useHeldNodeStyle` and the rerun passed.
- `npm run check:changesets`: pass, with no warning on either new changeset.
- `npm run lint -w @weasel-js/text` and `-w @weasel-js/text-dom`: unrun, because neither package has a `lint` script ("Missing script"). The gate's root `npm run lint` passed.
- Tree clean, nothing in `.skulkr/` touched.

tally: 2 of 3 fixed, 0 extra fixed