A comma-separated `@container` query list matches only through its first query (A): fixed 9fe4a64fa2

An inheriting leaf regains the end markers and stroke that `pathAsSvgDraws` removed (A): fixed 97bcb358c2

An `em` geometry length under a `<use>` is read against the target's DOM ancestors (A): fixed 39335f0a41 (also covers image boxes, nested `<svg>` x/y, `<text>` x/y and the `<use>`'s own x/y)

`visibility="hidden"` on a `<use>` or `<text>` drops descendants that turn visibility back on (A+B): fixed 19a8f21ac0 (`<use>`) and 0793e7d525 (`<text>`: a hidden text with a visible tspan is kept, and its hidden runs take their place on the line but paint nothing)

A `<tspan x>` that stays on its line is dropped, and splits the `x`-list measurement as if it opened a line (A): fixed c76867fc3a (lines now split where the tspan walk's `LineTracker` splits them; a lone same-line `x` is read as spacing, with a warning where no loaded face can measure it)

`opacity` and `clip-path` on a `<use>` are dropped silently (A+B): fixed ac3ceb0966

`stop-color: currentColor` is read as black (A): fixed 30c9b1bbc0

A chain of `<use>` references never counts toward `NESTING_LIMIT` (A): fixed b6e8583b0a

A text run with no stroke of its own loses the node's inner or outer stroke on export (B): fixed bab8ba49ee

`fill-opacity` does not count as an element setting its own fill (B): fixed aec9a30262

A `<use>` that sets its own paint is read as taking its group's paint (B): fixed 89debc5034

`opacity` and `clip-path` on a `<use>` dropped without a warning (B): duplicate of A's `<use>` opacity/clip finding, fixed ac3ceb0966

A custom painter's `'world'` pattern paint is written in the pose frame without being mapped back (B): fixed 1f2e4d2abb (the painter command type admits only a `texture` pattern, so the test uses that)

`visibility="hidden"` on a `<use>` or `<text>` drops visible descendants (B): duplicate of A's visibility finding, fixed 19a8f21ac0 and 0793e7d525

`scaleStroke` leaves a stroke with no `width` at 1 while scaling its dashes and heads (B): fixed 32cdf2d0ee

Extra defects found while fixing:

A `<g>`'s `marker-*` was never read into the group's stroke (sweep). The `<g>` was exported with no marker, so an open path taking the group's stroke lost its arrow on a parse-and-export: fixed 591db97153

A text run whose stroke paints nothing was written with no `stroke` attribute (sweep). The kit reads that run as unstroked, but the exported `<tspan>` took the text's stroke: fixed 3256d98816

Follow-up commits: 3d5d710e83 shortens 9 changeset titles to the 140-character limit. 344f70126f renames `useSpace` to `spaceOfUse`, because the React hooks lint rule read it as a hook, and fixes the types in two new tests.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. That is container, gradients, groupPaint, metricScale, alignedTextStroke, use, painterLeaf, glyphShifts, hidden and markers, plus neighbors: parse, use.pbt, parse.fuzz.pbt, lengths, paintThroughMatrix, bakedScale, markerSerialize, markerSubpaths, openSubpathFill, seatedHeads, serialize.paint.pbt, serialize.pbt, fromKit.pbt and every text/tspan/roundtrip.text* suite. No browser test file was touched.
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run typecheck:packages -- svg`: pass
- `npm run lint -w @weasel-js/svg`: the package has no `lint` script, so it can't run. The root `npm run lint` inside the gate covers it: pass.
- Tree clean.

tally: 15 of 15 fixed, 2 extra fixed