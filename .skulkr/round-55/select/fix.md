README example doesn't typecheck when `select`'s result is assigned back to the inferred `state` (A): fixed a4670a46db

`between` range can select one id twice, so it no longer matches the store (A): fixed dda8281737

`createSelectionStore` keeps the caller's array, so mutating that array later changes the selection with no listener told (A): fixed e30e0b4ef7

`SelectionMode` doc still says `multi` (A+B): fixed 65c30b52ea

README `range` row leaves out `between`, so its fallback condition is wrong (B): fixed a4670a46db (same commit as the README typing fix)

Extra: none. While fixing the store, I moved its dedupe helper (`once`) into `same.ts`, and the `between` dedupe now uses that same helper.

Checks:
- `npx vitest run --maxWorkers=1 packages/select/src/store.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/select/src/select.test.ts`: pass (22 passed)
- README snippet compiled with strict `tsc`: fail before the fix (TS2322), pass after. The probe file was deleted.
- `npm run checks:gate`: all 32 passed. The first run failed `check:changesets` because one changeset title ran 150 characters. I shortened it and folded the fix into commit e30e0b4ef7, then the rerun passed.
- `npm run lint -w @weasel-js/select`: not run, because the package has no lint script. I ran `npx eslint packages/select` instead: pass (exit 0).
- Tree: clean.

tally: 6 of 6 fixed, 0 extra fixed