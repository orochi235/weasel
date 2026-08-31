---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Right-to-left text lays out in visual order

`LayoutRunsOpts` takes an optional `bidi` engine. Given one, `layoutRuns`
analyses the paragraph, reorders each line after the wrap, and mirrors brackets
in right-to-left runs. Given none, nothing changes: text lays out logically,
exactly as before.

`@weasel-js/text` declares the `BidiResolver` interface and does not depend on
`@weasel-js/bidi` — the dependency runs the other way from the usual, so a
consumer who renders no right-to-left text never installs the Unicode tables,
and a different implementation can be substituted. `@weasel-js/bidi` is a
devDependency here only, for a test that drives real Hebrew through the real
engine; types lining up is not evidence the semantics do.

`LaidOutCell` gains `advance` and `level`, and **`x` is no longer monotonic
across `cells`**. Cells stay in logical order — slot `i` is still character `i`
— while their x values follow the reordering. Sort on `x` for visual order, and
read a cell's extent as `[x, x + advance)` rather than reaching for the next
cell's `x`. Hit-testing was doing exactly that and now sweeps in visual order
against each cell's own extent, taking a right-to-left cell's visually-leading
half as the character's logical end.

Kerning is a gap between two adjacent characters, and the wrap measures it
logically. Reordering can put a different pair side by side, so the gap taken
is the one belonging to whichever of the two is logically second, and none at
all across a direction boundary — where the pair never touched in the source.

Laying out right-to-left text with no engine now warns once, naming the import.
The alternative is glyphs silently appearing reversed, which is the one real
hazard of making this opt-in.
