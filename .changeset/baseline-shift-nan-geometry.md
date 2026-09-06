---
'@weasel-js/text': patch
---

A run laid out without a `baselineShift` no longer comes back at NaN.

`resolveRuns` always sets the field, but `layoutRuns` takes `ResolvedRun[]` and
callers do hand-build them — the authored run type has had `baselineShift`
optional all along. Absent it, `lineBaselineY - run.baselineShift` went NaN, and
only on the vertical axis: every quad kept its correct `x` and UVs and lost
`y0`, `y1` and `baselineY`.

That fails in the worst available way. The glyphs draw as zero-area quads, so
there is no GL error, no console warning, the atlas texture uploads normally and
the layout reports the right number of groups and quads — the text simply is not
there. The nightly performance suite had been red on it for a week with
`text: rendered nothing, so every cell holding it is meaningless`, which is that
suite's guard against exactly this class of silent free measurement doing its
job.

The subtraction now reads the field as `?? 0`, which is both the identity and
what the authored type already implied.
