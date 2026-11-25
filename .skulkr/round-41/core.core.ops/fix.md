- setPath counted a change to only `fillRule`, `openFill` or `corners` as a no-op (A): fixed a31a2a99bf
- setPath and setSelection decided "no-op" from a stale `from`, not from what the adapter holds (A+B): fixed 9c7e5239bf. setPath now reads the node's `path`, `closed` and `params` through `getNode`; setSelection reads `getSelection`. Both use `from` only when the adapter has no such read.
- setText never reported a no-op (A): fixed 10c1d63ca4. It now checks `alreadyHolds` against `node.text`, and compares `from` and `to` when there is no `getNode`.
- writtenBy rebuilt op copies through `defaultOpRegistry` instead of the scene's `opRegistry` (A+B): fixed 22ab9ea957
- createDeleteOp read the slot under a stale copy's parent before swapping in the live node (A): fixed 6eedeacdcc. I checked `reparent.ts` for the same mistake; it already reads the live parent first.

Extra: a9c9a46614 shortens four of the changeset titles above, which ran over `check:changesets`' 140-character limit. It has no code change.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: setPath.test.ts pass (9), select.test.ts pass (5), setText.test.ts pass (6), writtenBy.test.ts pass (3), delete.test.ts pass (17). Each new test failed before its fix.
- The 29 core test files that use setSelection or setPath also passed: 298 tests.
- `npm run check:changesets`: pass ("OK — 1936 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. Instead, `npx eslint` on every changed `.ts` file: pass, no output.
- Tree is clean apart from `.skulk/`.