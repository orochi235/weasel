Cluster without its own fill reads lightgrey (A+B) — fixed 450d8e4daa

Reopened subgraph loses the node and edge defaults its first opening set (A) — fixed 02ea294e28

Root and plain-subgraph graph attributes a cluster inherits were warned as dropped (A) — fixed 5f9e22680c

Nested box inherits the outer cluster's `penwidth` (A) — fixed a81f6e33f5. The writer now writes `penwidth=""` in the nested cluster, and the reader takes a number set to `""` as unset, as Graphviz's `late_double` does. One existing test had expected a warning for `penwidth=""`; it now uses `" "`. With a theme, the inner cluster already got an explicit `penwidth`, so this only showed for a group (no style) inside a container.

`width`/`height` of zero or below kept as the node's size (A) — fixed 8516e1a640. Both are now held to 0.01in.

Nested cluster `penwidth` not reset (B) — duplicate of A's `penwidth` finding

Root and plain-subgraph attributes warned as dropped (B) — duplicate of A's warning finding

Filled cluster with no color gets no fill (B) — duplicate of A's lightgrey finding

Version 1 diagram JSON `groups` never validated (B) — fixed ff80996be4

Extra: none. f5e085a460 moves DOT `pos` reading into `dot/positions.ts`, because the fixes pushed `read.ts` past the 400-line cap in `check:size`.

Checks:
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/dot/read.test.ts`: pass (44)
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/dot/write.test.ts`: pass (28)
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/jsonFormat.test.ts`: pass (10)
- `npx vitest run --maxWorkers=1 packages/diagram-formats/src/dot/`: pass (including the property tests)
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed 3 of 33 (`check:changesets` title length, `check:size`, `check:proto-index`); all three were fixed and folded into their commits.
- `npm run lint -w @weasel-js/diagram-formats`: fail, "Missing script: lint". The package has no lint script; eslint ran as part of the gate.

tally: 9 of 9 fixed, 0 extra fixed