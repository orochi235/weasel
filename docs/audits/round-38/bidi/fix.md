`buildSequences` throws `RangeError` on a long level run (B): fixed e26c7137c3. Reproduced first: a one-level run of 1,000,000 characters threw inside vitest, and plain node already throws at 200k. The run's indices are now appended in a loop.

Unmatched isolate initiators make `analyze` quadratic (B): fixed b14bbed9ce. Reproduced first: 50k stray FSIs took 3.3 s. `pairIsolates` now pairs every initiator with its PDI in one stack pass and replaces `matchingPDI`. `resolveExplicit` computes it once and passes it to `paragraphLevelOf` for each FSI, and `buildSequences` makes its own linear pass. Pairing still reads the classes after overrides, so behavior is unchanged; the conformance tests still pass.

`bidiClassOf`'s docstring misstates the defaults for unassigned code points (A): fixed 9117cc786b. Confirmed by running it: an unassigned Currency Symbols point (U+20CF) gives `ET`, and U+FDD0 and U+E0080 give `BN`. The fix is in the generator's template and in the generated `tables.ts`, with a test pinning those values. The code was already right, so that test passed before the fix too; no failing test was possible for a doc-only defect.

No extra defects found. The other `push(...)`/spread calls in the area are in test code over small fixed lists.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: paragraph 13 passed, explicit 14 passed, sequences 10 passed, index 9 passed, resolve 16 passed, conformance 4 passed, resolve.pbt 8 passed, reorder 9 passed, reorder.pbt 4 passed, tables 15 passed. No `*.browser.test.*` file was touched.
- `npm run typecheck:packages -- bidi`: `1/1 bidi ok`
- eslint on the changed files: exit 0
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: pass (exit 0), after shortening one title the check had refused at 175 characters.
- The tree is clean, and `.skulk/` is untouched.