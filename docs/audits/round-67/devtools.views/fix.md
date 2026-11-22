- Category count badge keeps the unfiltered count while filtering (A): fixed cbdc6cd355
- History tab stuck on an error until a history notice arrives (A): fixed 467c92b131
- A failed read unmounts the trace and history tables and folds the open row (A): fixed ada47bf872
- An unlabeled history entry is named three different ways (A): fixed a7cc6c49c5
- A predicted miss in the live row reads "unhandled" (A): fixed fc2926770d. The same fix covers the live row's Outcome cell in `TraceTable`, which had the same wording.
- Coord columns lose alignment past an 8-character pad (A): fixed eb104dfdbd
- Route strips keyed by route text collide on a repeated route (B): fixed 7e256fc436. Fixed in both `Bindings` and `FallthroughDiagram`'s `Routes`.

Extra: none. 034ce4b7b7 only fixes types in this pass's own new History tests; it is not a defect fix.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - RegistryBrowser.test.tsx: 20 passed
  - HistoryView.test.tsx: 8 passed
  - DecisionPath.test.tsx: 2 passed
  - TraceTable.test.tsx: 1 passed
  - CoordTable.test.tsx: 4 passed
  - Bindings.test.tsx: 2 passed
  - FallthroughDiagram.test.tsx: 23 passed
  - DispatchView.test.tsx: 5 passed
- Every new test failed against the code before its fix.
- `npm run checks:gate`: first run failed 3 of 32 (typecheck, typecheck:packages, lint), all in my HistoryView tests. After the fix: "checks:gate: all 32 passed".
- `npm run check:changesets`: OK, 105 changesets.
- `npm run lint -w @weasel-js/devtools`: fail, because the package has no `lint` script ("Missing script"). Root `npm run lint` passed (exit 0).
- No browser test files touched. Tree clean apart from `.skulkr/`.

tally: 7 of 7 fixed, 0 extra fixed