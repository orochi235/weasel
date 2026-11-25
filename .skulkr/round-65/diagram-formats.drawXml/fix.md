Pool members written inside the pool cell, which takes a node away from its lane (A): fixed eb708ead93. The same change keeps a container or lane from claiming a pool or a lane, which the diagram never draws.

Cluster naming a container writes it nested in the group, which the reader then drops (A): fixed d4b2cd2bf6

Row `tracking` and non-bold numeric `weight` dropped without a warning, and rows differing only in them not flagged (A): fixed a5984f35f9

Every container, pool, and lane written dashed, though the diagram draws regions solid (B): fixed 623508e245. The reader now warns of a dashed swimlane and drops the dash, which was the strict call. Nothing was added to `docs/unruled.md`, because `outlineOf` in the diagram already rules regions undashed.

Dash lengths read and written as absolute, though a draw app scales `dashPattern` by stroke width (B): fixed c805d93a9b. The writer adds `fixDash=1`, and the reader scales by `strokeWidth` unless `fixDash` is set. The fixture expectation in `read.test.ts` for e2 changed from [3, 3] to [6, 6]. The draw-app behavior comes from the reviewer's reading of mxGraph's source, not from a run, and matches what I recall of that source.

HTML table rows, lists, `<pre>`, other blocks, and a `<br>` with attributes run together on one line (B): fixed b867d7e505

`rotation`, `flipH`, and `flipV` dropped without a warning (B): fixed 96634f66a8. A flip warns only when it changes the shape: a cube's written `flipH=1`, flip-symmetric shapes, and plain boxes stay silent.

Swimlane marked `container` read back as a lane when its parent is a pool (B): fixed d43dd76065

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: `writeParents.test.ts` pass (2), `readRole.test.ts` pass (1), `fidelity.test.ts` pass (21), `read.test.ts` pass (33), `cellText.test.ts` pass (8). The whole `drawXml/` directory also passed (130).
- `npm run check:changesets`: pass ("OK — 3597 changeset(s)")
- `npm run checks:gate`: pass ("all 32 passed")
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script. The root `npm run lint` passed inside the gate.
- Tree clean.

tally: 8 of 8 fixed, 0 extra fixed