---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Every code point on a line gets a cell

`LaidOutLineBox` replaces its `caretXs` / `caretIndices` pair with
`cells: LaidOutCell[]` plus a `srcEnd` closing offset. A cell carries
`srcIndex`, `srcEnd`, `cp`, `x` and `drawsInk`, so slot `i` is `cells[i]` and
a consumer indexing per character no longer has to reconcile a sparse array
against the source string.

The old arrays were documented as non-contiguous, and two causes were real:

- A code point no tier could serve was dropped outright, taking its caret stop
  with it. It now occupies a zero-advance cell. This is reachable whenever the
  dynamic canvas fallback is off — which is the normal configuration for a
  consumer registering its own outlines, where the outline tier has no rung
  below it.
- A space opening a line — at the start of the text, or after a newline — was
  discarded. It now keeps its cell and still consumes no width, so a line is
  addressable per character without gaining an indent. A space that opens a
  *wrapped* line was never affected: the wrap leaves it as a trailing cell on
  the line before.

Neither changes any geometry: both cells carry zero advance, zero tracking and
no kerning, so bounds, line widths and glyph positions are unchanged.

A newline still has no cell, since it separates cells rather than being one.
`srcEnd` is what a blank line carries in its place.

`drawsInk` is a property of the code point and the face, not of the call that
produced it: it does not flip when a dynamic bake lands or the outline
threshold is crossed, so the same text reports the same slots every time. A
zero-advance combining mark is `true` — it inks without advancing.
