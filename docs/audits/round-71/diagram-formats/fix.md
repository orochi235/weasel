DOT reader `pos` read as points when hand-written in inches (A): fixed cf20f36db1. Read as inches when the graph has no `bb`; ruled in `docs/unruled.md`.
`empty`/`onormal` and the other arrowhead synonyms read as different markers (A): fixed bfa45664c5. `arrow-open` now writes as `normal` with a warning instead of `empty`.
Cluster with `style=invis` drawn as a container (A): fixed 67e47aa9b0. It now draws a transparent box with no label and keeps its members; ruled in `docs/unruled.md`.
`weasel_outline` taken without checking it (A): fixed 9dc95af099. An empty value counts as unset; a name not in the outline registry falls back to the shape with a warning; ruled in `docs/unruled.md`.
`tailport=""`/`headport=""` warns that a port was dropped (A): fixed 0bfa7aefe6
Cluster prefix matched case-sensitively, and `cluster=true` ignored (B): fixed c237405290. Also covers anonymous `cluster=true` subgraphs.
`\G` in a cluster label names the root graph (B): fixed 4482a3d1c4. `\N` now stays as written in graph, cluster, and edge labels.
Backslash continuation at a CRLF line end not joined (B): fixed 9502b213be
Writer drops a container's stroke width (B): fixed 083f1bc08a. Writes `penwidth`, and the reader takes it.
Dash patterns written as `dashed`/`dotted` with no warning (B): fixed 72f3891bc7. The built-in themes' container dash `[4, 3]` now warns too; ruled in `docs/unruled.md`.
Strict graph's merged edge keeps the first statement's ports (B): fixed dec0efd7e0
DOT detection disagrees with the lexer on HTML ids and `+` joins (B): fixed 517a8f7ea0. Detection now reads the header with the lexer.

Checks:
- `npx vitest run --maxWorkers=1` read.test.ts: 36 passed. write.test.ts: 27 passed. lex.test.ts: 7 passed. format.test.ts: 6 passed.
- Also run after changes: dot.metamorphic.pbt, dot.pbt, dot.shrunk, parse, values, roundTrip, crossFormat.pbt, crossFormat.shrunk, formats.pbt, formats, authoredNotations, and rowLines: all passed.
- `npm run checks:gate`: "checks:gate: all 33 passed" (the first run failed typecheck on read.ts; fixed in 9dc95af099, rerun passed).
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/diagram-formats`: the package has no `lint` script. Ran `npx eslint` on every changed .ts file instead: pass (exit 0).
- Tree clean.

tally: 12 of 12 fixed, 0 extra fixed