An `'inherit'` paint marked as coming from a group that is never written (A): fixed f236b1b9f3. When `svgNodesFromKit` starts below the top of the tree, the first node it walks now gets its resolved paint written on it, whether it is a leaf or a group. The new test checks the serialized output.

A `'world'` gradient or pattern turning or skewing with the node's pose (A+B): fixed a1e94848e2. A shape whose pose has a `transform` no longer maps a `'world'`, `'screen'` or unstated-units paint through that frame. A shape with only a rotation and such a paint gets its geometry baked instead of a `rotate()` attribute. Text takes such a paint back through the inverse of its frame. `painterLeaf`'s `paintIn` now uses the same shared test and mapping (`inDocumentSpace` / `documentPaintThrough`).

The root `<svg>` size read one way for percentages and another for `@media` / `@container` (A+B): fixed 1806907341. Both now read `outerViewportOf`: an `em` side counts, and a percentage on the side the root gives resolves. I made a strict call and recorded it in `docs/unruled.md`: a percentage on a side no attribute sizes still warns and reads its bare number, while media fall back to 300 × 150. For media, an `em` side reads the root's `font-size` attribute, because the cascade itself reads the media environment.

A one-value `dx` dropped on text whose white space collapses (B): fixed a647a7c66c. This covers both `placeRun` and `TextShifts`. The first value is always read, and a list with later values is read only to its first value, with a warning, matching `movesOf`.

`raiseRuns` putting rises on the wrong glyphs when the first run it reaches holds earlier glyphs (B): fixed 384ac3590d. It now starts at `Math.min(n, 0)`, as `turnRuns` does. No changeset: I did not show that any caller produces such a run, so I can't say a consumer would notice.

Extra: a00c516f82 shortens the four new changeset titles, which `check:changesets` rejected as over 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: fromKit.test.ts pass (37), fromKit.worldPaint.test.ts pass (3), lengths.test.ts pass (31), media.test.ts pass (31), glyphShifts.test.ts pass (37), glyphRises.test.ts pass (12)
- Related svg files (fromKit*, painterLeaf, roundtrip*, lengths*, gradients, cascade, container, parse, glyphTurns, roundtrip.text): pass
- `npm run checks:gate`: all 32 passed
- `npm run check:changesets`: OK — 102 changesets
- `npm run typecheck:packages -- svg`: 1/1 svg ok
- `npm run lint -w @weasel-js/svg`: the package has no lint script; eslint on the changed source files: clean
- Browser tests: none touched, none unrun

tally: 7 of 7 fixed, 0 extra fixed