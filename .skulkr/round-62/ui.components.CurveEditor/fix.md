[r58-16] key one curve layer commits without preventing default is undone with the next layer's edit (carried): not a defect (no longer applies). `LayeredCurveEditor.tsx:139-142` now folds the edits this key already made into the next layer's `before` snapshot. I committed a regression test as 4f8bbd53e7 (`CustomLayer.test.tsx`, "records a key two layers commit as two steps, each undoing only its own layer"). It fails when that fold is removed (Expected "1,0", Received "0,0") and passes with it. There's no changeset because the change is test-only.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/CurveEditor/CustomLayer.test.tsx`: Tests  8 passed (8)
- `npx eslint packages/ui/src/components/CurveEditor/CustomLayer.test.tsx`: pass
- `npm run checks:gate`: checks:gate: all 32 passed
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (npm error: missing script). The gate's lint step covered the file.

tally: 0 of 1 fixed, 0 extra fixed