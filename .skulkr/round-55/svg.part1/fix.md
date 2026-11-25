`<use>` and `<symbol>` children skip the container checks (A): fixed 0ad7810bef

`fitLeafXml` cuts a start tag at a `>` inside an attribute value (A): fixed 85ce5fedf4

`<switch>` passes over a `<use>` child (A): fixed d7e8e3db06

`stroke-dashoffset` in `em` is read against 16px (A): fixed b21d8c689e

A rectangular `<path>` traced from another corner becomes a `rect` (A): fixed a8e1de3760

A sized marker's def id can collide with another marker's key (A): fixed 7de46f6979. Derived ids are now written `arrow--s2` and `arrow--tip`, and a key containing `--` gets a hashed id. I checked that a file written with the old `-s`/`-tip` ids reads back the same.

`currentColor` fallback after a `url()` paint is painted black (A): fixed 228c7f41d2

Percentages under a nested `<svg>` sized in percent find no viewport (A): fixed b7e7c6a864

A media override given as `undefined` replaces the default (A): fixed ba7ec6f9ca

`currentColor` fallback after `url(#id)` is read as black (B): duplicate of A's `currentColor` finding

A pattern fill is not taken through its element's baked matrix (B): fixed a20a91f9df. Imported patterns now get `units: 'world'`, as user-space gradients already do. So `svgNodesToKitDrafts` turns them into box-anchored kit paints; before, they had no units and the renderer drew them in screen space.

`<switch>` passes over a `<use>` child (B): duplicate of A's `<switch>` finding

A nested `<svg>`'s `opacity` and `transform` are dropped (B): fixed 670cefd6f1. The root `<svg>`'s own `opacity` is still dropped without a warning. I did not fix or file that.

A framed text node's shadow and edge are refitted onto its box on export (B): fixed d8eff0412d. Under a rotation the shadow and edge are now baked and turned about the box center.

A nested `<svg>` without `width`/`height` finds no viewport (B): duplicate of A's nested-`<svg>` percentage finding

Extra defects: none fixed. I also looked at the `<path (?=[^>]*:role="stroke-outline")` lookahead in `serialize.ts:150`, which has the same `>`-in-attribute pattern. It is not a defect: the outline path only carries generated attributes before its role.

Checks:
- Each touched test file, run one at a time with `--maxWorkers=1`: pass (conditional, dashes, media, cascade, groupPaint, markerSerialize, seatedHeads, path-commands, lengths, document, use, paintThroughMatrix, patterns, framedText).
- Also run: the rest of the svg package's test files, `apps/draw/src/svgExport.test.ts` and `apps/draw/src/svgInterop.test.ts`: pass.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run check:changesets`: pass ("OK — 2601 changeset(s)").
- `npm run lint -w @weasel-js/svg`: unrun, because the package has no `lint` script ("Missing script: lint"). The root `npm run lint` inside the gate passed.
- No `*.browser.test.*` files were touched. The tree is clean.

tally: 12 of 15 fixed, 0 extra fixed