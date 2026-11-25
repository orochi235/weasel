- `<BR ALIGN="LEFT"/>` (any `<br>` with attributes) was stripped instead of breaking the line (A+B): fixed 9d4fc2f6c6
- X11 color names Graphviz draws (`red3`, `steelblue1`, `navyblue`, `lightgoldenrod`) were dropped on DOT import (B): fixed f4beb56ad3. The table is generated from X.org's `rgb.txt` into `dot/x11.ts`, and `colorCheck.test.ts` no longer expects `lightgoldenrod` to be dropped.
- `laidOutPage` grew a partly placed page only right and down, so nodes laid out above or left of the placed ones fell off the page (B): fixed 7b47e50cf0. This needed a behavior call, and I made it: when layout puts a node above or left of the page, everything moves by one offset, placed nodes included. It is recorded in `docs/unruled.md`. The existing test "leaves the nodes that have a place where they are" had relied on nodes sitting off the page; it now pins a node whose neighbors stay on the page.
- The Diagram JSON reader did not check `crossPageEdges` or a page's `name` (B): fixed d0ded6f6b0
- `scenePageKinds` ignored `opts.page` on a scene with no page list (A+B): fixed 9315129e6b
- DOT detect claimed text where the keyword runs into a name, such as `digraphs {}` or `graphite { }` (B): fixed f61e3ead30
- `documentFromScene` dropped a shape's marks (A): fixed 925783282f. Both path and text marks are now read back, leaving out values that are only defaults.
- Opening and saving lost a collapsed node's hidden rows and its `collapsed` flag (A): fixed f748cf93ba. This adds a `DiagramNode.folded` field to `@weasel-js/diagram`'s node trait, with a `minor` changeset because it is new public API.
- `documentFromScene` dropped a container's `reorder` axis (A): fixed 4a8ede896a
- A DOT `pos` with no `width`/`height` was placed using the 54×36 default size and then drawn at another size (A): fixed 25ed0ce9ba. The default size is now written onto the node.
- A's `<BR ALIGN>` finding: duplicate of B's `<BR ALIGN>` (9d4fc2f6c6)
- A's `scenePageKinds` finding: duplicate of B's `scenePageKinds` (9315129e6b)

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"), on the second run. The first run failed `check:changesets` on five changeset titles over 140 characters. I shortened them and squashed each change into its own fix commit.
- `npm run lint -w @weasel-js/diagram-formats` and `npm run lint -w @weasel-js/diagram`: fail, "Missing script: lint". Neither package defines a lint script, so I ran `npx eslint` on every changed `.ts` file instead: pass (exit 0).
- Every test file I touched passes when run alone with `--maxWorkers=1`: graphRead (5), dot/format (4), pageRoots (2), jsonFormat (7), dot/values (5), colorCheck (6), dot/read (23), fromScene (24), toScene (19).
- Related files also pass: sequencePage, dot/write, dot pbt/metamorphic/shrunk, drawXml/write, roundTrip, crossFormat.pbt, formats.pbt, formats, templates, sceneReaders.slots/header, plotPages, authoredNotations, the architecture/kanban/c4/block Mermaid tests, and diagram's fromData, fromData.header and fromData.slotImage.
- No browser tests were touched. The tree is clean.

tally: 12 of 12 fixed, 0 extra fixed