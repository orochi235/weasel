- Switching to pipeline mode and back reloaded the chart from storage, losing it when its save had failed (A): fixed 4617098e87
- Add section and Remove section acted on the first selected fragment only (A+B): fixed f9606ad2a8, with its test's typing fixed in b89de413c8
- Page Setup's Orientation field ignored a custom width or height edit (B): fixed 3a60147559
- The Sequence panel stayed collapsed after New, Open or Import of a sequence chart (B): fixed 8a4638f144
- [r33-1] The Adds picker couldn't set a database, queue or boundary head back to a plain participant (carried): not a defect (no longer applies). Such a head now shows no value in the picker, so choosing Participant applies. The SequencePanel test "shows no figure for a head the Adds picker does not name, so choosing Participant applies" covers it.

Extra:
- App.test's `afterEach` cleared localStorage before the save that runs on unmount had landed, so a sequence chart from one test leaked into the next (sweep): fixed 8a4638f144, in the same commit as the Sequence panel fix

None of these got a changeset: `apps/chart` is not a published package, and none of its earlier commits has one either.

Checks:
- `npx vitest run --maxWorkers=1 apps/chart/src/App.test.tsx`: pass (29/29)
- `npx vitest run --maxWorkers=1 apps/chart/src/SequencePanel.test.tsx`: pass (15/15)
- `npx vitest run --maxWorkers=1 apps/chart/src/pages/PageSetupDialog.test.tsx`: pass (3/3)
- `npx eslint` on every changed file: pass. `apps/chart` is not a workspace, so there is no `npm run lint -w` for it; the gate's root `npm run lint` passed.
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed `typecheck` on the new SequencePanel test, which b89de413c8 fixed.

tally: 4 of 5 fixed, 1 extra fixed