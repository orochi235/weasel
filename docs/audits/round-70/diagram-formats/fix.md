DOT `detect` misses a header split only by a comment, or a quoted id continuing a line (A+B): fixed 04925b6d08

Diagram JSON reader never checks a page's nodes or edges (A): fixed c22c5f87c4. It now also checks clusters and containers. The round-46 entry in `docs/unruled.md` is widened to match.

Diagram JSON with no `version` refused as "newer" (A): fixed 357464b99a

`documentFromScene` lists a connector to a left-out plot- or sequence-page shape as a cross-page edge (A+B): fixed 1e26aa6d93

DOT `style=invis` nodes and edges imported as visible (B): fixed c53820b049. My call, recorded in `docs/unruled.md`: they are left out with a warning, and so are edges to an invisible node, matching how draw-style XML treats hidden shapes.

DOT `shape=point` drawn with its `\N` label at full size (B): fixed 24d40027d6. My call, recorded in `docs/unruled.md`: a point has no label, is a circle the smaller of `width` and `height` across (0.05in by default), and is filled with its `fillcolor`, else its `color`, else black.

DOT clusters filled with the root graph's `bgcolor`, which the page drops (B): fixed 966933f09f

DOT `arrowhead=""` / `arrowtail=""` warns with an empty item (B): fixed 811cdd267a. The same fix covers `shape=""` and `dir=""`, which also now read as Graphviz's default.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `dot/format.test.ts` pass (5), `dot/read.test.ts` pass (27), `jsonFormat.test.ts` pass (9), `plotPages.test.ts` pass (4), `fromScene.test.ts` pass (24). Untouched files also run: `jsonFormat.shrunk.test.ts` pass, `sequencePage.test.ts` pass (7), and `dot/dot.pbt`, `dot.metamorphic.pbt`, `dot.shrunk`, `write`, and `values` pass.
- Each new test failed before its fix (checked by reverting the source file).
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run check:changesets`: pass ("OK — 302 changeset(s)").
- `npm run lint -w @weasel-js/diagram-formats`: not run, because the package has no `lint` script ("Missing script: lint"). Instead, eslint on every changed `.ts` file: pass (exit 0).

tally: 8 of 8 fixed, 0 extra fixed