- [r56-1] stories reading deleted CSS classes, carried (B): not a defect (no longer applies). `stories.classes.test.ts` now checks every class the stories read, and it passes.
- [r56-2] held bar's menu button still opens its menu, carried (B): not a defect (no longer applies). `ButtonTooltip` marks the button `aria-disabled`, and a probe of pointer, click, Enter and ArrowDown under `<Disabled when reason>` opened no menu. The existing test covers the no-reason case.
- [r56-3] wrapped bar's drag-reorder picks its gap by x alone, carried (B): fixed ae842c27f8
- [r56-4] curved bar drops `fit`, carried (B): fixed 98bb0b6f13, on top of 6a0d910d23, which adds an `overflows` option to `useFitScope`. A curved bar's items lie along the run rather than inside its box.
- [r56-6] useMenuLeast near-zero minimum under right-to-left, carried (B): not a defect (no longer applies). `measure` takes the min and max of the button's and the lead's edges, and the RTL test passes.
- [r56-7] Alt+arrow at an end moves roving focus, carried (B): fixed 856f5e94e9. It also covered the last item inside a group.
- [r56-8] useBarOverflow's size cache keeps every key, carried (B): fixed 2335fa042a

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` for each file I touched:
  - `useBarReorderKeys.test.tsx`: pass (15)
  - `useBarOverflow.test.tsx`: pass (1)
  - `Bar.along.test.tsx`: pass (26)
  - `Bar.wrap.test.tsx`: pass (1)
- Related files: `Bar.test`, `useBarReorder.test`, `Bar.strip`, `Bar.order`, `Bar.over` and `Bar.natural`: pass. `FitLabel/` plus `ToolbarDock/`: pass (152).
- `npm run checks:gate`: the first run had 2 of 32 failing. `check:changesets` failed on a title over 140 characters, and `lint` failed on `no-restricted-syntax` for a client-rect offset in `barLines.ts`. Both are fixed and folded into their commits, and the rerun says "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui`: `@weasel-js/ui` has no lint script ("Missing script"). Its eslint runs in the gate's root `lint`, which passed.
- Unrun browser test: `Bar.fit.browser.test.tsx`, which covers `FitLabel` scopes and is affected by the `useFitScope` change.

tally: 4 of 7 fixed, 0 extra fixed