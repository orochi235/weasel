Invocation color dropped under a binding's `paint` at start (A) — fixed cc626c5af0. The invocation's params are now read over the binding's the way a move is read, so this applies to every paint action.

A selected `'inherit'` child of a selected container gets its own explicit paint and stops inheriting (B) — fixed a2bf513b94. The child is left inheriting when it would take the paint its container gets in the same run, and it still previews along with the container.

`setFill`/`setStroke` accept any non-`undefined` `color` (B) — fixed f7668840ee. Both actions now share one reader that ignores a `color` that is not a string and a `paint` that is not an object or `null`.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/editing/src/actions/edit/*.test.ts` (this includes the new `paintParamSources.test.ts`): pass, 204 passed (204).
- `npm run typecheck:packages -- editing`: pass, 1/1 editing ok.
- eslint on every changed file: pass.
- `npm run lint -w @weasel-js/editing`: not run. The package has no `lint` script; the gate covers lint.
- `npm run check:changesets`: pass, 549 changesets.
- `npm run checks:gate`: pass, all 33 passed. This is the final run, after the commits were squashed. The 2-failure notice that just came in is from the first run; both of its failures, the over-long changeset titles and the size of `createPaintAction`, are fixed in these commits.
- Tree clean.

tally: 3 of 3 fixed, 0 extra fixed