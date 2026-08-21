---
'@weasel-js/ui': patch
---

New component: `BandEditor` divides a numeric axis into contiguous bands and
lets you drag the seams between them. Each band carries a payload the consumer
supplies and renders through `renderBand`, so the control never learns what a
band means.

The axis is always fully covered — N bands, N−1 interior seams, no gaps and no
overlaps — which makes editing a partition the same thing as editing a sorted
seam list. Seams clamp at their neighbours instead of crossing, so no drag can
destroy a band: removal is only ever the explicit merge (`x` / `Delete`, into
the left neighbour, whose payload survives). The first band's left edge is
`min` and does not move, and it has no left neighbour to merge into, so a
partition always keeps at least one part.

`scale` takes `'linear'`, `'log'` or a `BandScale` of your own, and defaults to
`'log'` because the interesting part of a width axis is usually its narrow end.
A log scale needs `min > 0`; given anything else the component falls back to
linear and warns once in development rather than positioning every seam at
`NaN`.

`onInput` fires live during a drag and `onChange` once per committed gesture,
following `GradientHandles`. `Slider` uses the opposite sense (`onChange` live,
`onCommit` committed) — a known inconsistency in this package that this change
deliberately leaves alone.

Nothing existing changed. The added exports are `BandEditor`, `BandEditorProps`,
`Band`, `BandScale`, `linearScale` and `logScale`.
