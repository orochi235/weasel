Note-spanning in paired group (A) — fixed bb46984d6e. The fix also makes nested groups and `<CurveField>` span both columns there.
Duplicate React key for identical curve marks (A+B) — fixed c3900bec43
Slider readout turns a `format` that returns an element into `[object Object]` (B) — fixed 288f698766
Typing `-` in a slider readout moves the caret to the end (B) — fixed 04ee2d8f47
Paired group rows lack `min-width: 0`, so a wide row widens its column (B) — fixed 8bc552d21b
PropertyPanel story's `pack` control can't select `one-up` (B) — fixed a977f42ad7. Its options now come from a record keyed by every packing, so typecheck fails if one is left out.

Checks:
- `npx vitest run --maxWorkers=1` NumberControls.readout.test.tsx: pass (8/8)
- `npx vitest run --maxWorkers=1` CurveMarks.test.tsx: pass (1/1)
- `npx vitest run --maxWorkers=1` CurveField.test.tsx: pass (12/12)
- `npx vitest run --maxWorkers=1` PropertyGroup.test.tsx: pass (11/11)
- PropertyGroup.pairs.browser.test.tsx: unrun (browser)
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/ui`: not run, because @weasel-js/ui has no lint script. eslint on the changed files: pass.
- `npm run check:changesets`: pass ("OK"), with no warnings on the new changesets

tally: 6 of 6 fixed, 0 extra fixed