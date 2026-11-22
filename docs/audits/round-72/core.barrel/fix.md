- The interactions barrel's module comment promised keyboard hooks and snapping that the file doesn't export (B): fixed c86bcb075d
- The chrome barrel's selection-chrome heading promised layers that draw and hit-test, but the block only has option types (B): fixed 9ee0ed0c02
- [r39-6] The main entry hands out the content-handler pipeline that the canvas barrel says it withholds (carried): not a defect (no longer applies). The ingestion comment at `packages/core/src/barrel/canvas.ts:149` now says `runIngest`, `handlersFor` and `couldClaim` are on this entry, from `editingSeams`, which matches the exports.

Both fixes only change comments, so I wrote no test that fails first and no changeset.

No extra defects found.

Checks:
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/core`: did not run. `@weasel-js/core` has no `lint` script (npm error "Missing script"). The root `npm run lint` passed inside the gate.
- I touched no test files, so I ran no vitest files.

tally: 2 of 3 fixed, 0 extra fixed