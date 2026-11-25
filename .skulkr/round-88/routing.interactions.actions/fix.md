The last-operation 'pass' answer swallowed by its onMove wrap (A): fixed 89b0509844

The hold release re-asking `enabled` but not the `eligible` rule (A): fixed 026578ddaf

A `<DepRank>` above an `<InputScope>` not ranking the sources registered inside it (A): fixed 275a7ded39

`ToolNode.snapshot` returning a new value on each call when no node in its chain owns a tool (A): fixed 1542718def

Last operation reading and writing a nested `params` form's leaves as flat dotted keys (B): fixed 3148f040d0

A hold's release running the action outside any catch (B): not a defect. Every path that ends a hold already catches and logs a throw from `onEnd`: the dispatcher's gesture run (`gestureRun.ts:57`) and `beginUiOngoing` (`uiOngoing.ts:67`, `:101`). A test confirms this; the throw is logged, not rethrown.

`<ActionsProvider>` never tearing down its root node, so a held last operation keeps observing the history after unmount (B): fixed 223346c71c

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, on each test file touched:
  - holdPreview.release.test.ts: pass
  - holdPreview.test.tsx: pass
  - lastOperation.wrap.test.ts: pass
  - lastOperation.test.tsx: pass
  - lastOperation.ongoing.test.tsx: pass
  - tuning.test.tsx: pass
  - activeToolContext.snapshot.test.ts: pass
  - inputScope.rank.test.tsx: pass
  - depNode.test.ts: pass
- Each new test failed against the code before its fix: confirmed.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed"). Earlier runs failed on test-file typing and on `check:part-caches`; both are fixed.
- `npm run lint -w packages/routing`: not run, because the package has no `lint` script. `npx eslint` on every changed file: pass.
- `npm run check:changesets`: pass

tally: 6 of 7 fixed, 0 extra fixed