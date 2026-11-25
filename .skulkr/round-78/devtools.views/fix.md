The State tab overrode every overlay flag (A) → fixed aaf0d84640. Now it sends only the flags the user changes, plus any it has already steered. Those earlier ones have to be resent so a sweep still works when the page hasn't answered the previous step.

A `defaultOpen` category's group stayed closed when the categories arrived after mount (A) → fixed cb6fdc5d1b. The group now opens the first time its category shows up.

The Dispatch and History tables kept their expanded rows after a reconnect (B) → fixed 6653ce7603. Both views now key their table by follower, so a new connection starts with every row closed.

[r77-4] A group's badge counted categories instead of entries (carried) → not a defect (no longer applies). `leaves` counts entries recursively, and the existing test "badges a group with the entries under it, filtered or not" covers it.

No extra defects found.

Checks:
- Each new test failed before its fix and passes after it.
- `npx vitest run --maxWorkers=1` on each touched file: `StateView.test.tsx` 6 passed, `RegistryBrowser.test.tsx` 23 passed, `DispatchView.test.tsx` 8 passed, `HistoryView.test.tsx` 11 passed.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/devtools` didn't run because the package has no `lint` script. `npx eslint` on the changed `.tsx` files passed.
- The tree is clean.

tally: 3 of 4 fixed, 0 extra fixed