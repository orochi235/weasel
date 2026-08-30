---
'@weasel-js/svg': patch
---

Round-trip overline, superscript and relative run sizes

`<tspan>` now carries the four run fields added alongside superscript support,
in SVG's own vocabulary rather than a weasel-specific one: `text-decoration`
gains the `overline` token it previously parsed and dropped, `script` becomes
`baseline-shift="super"` / `"sub"`, a raw `baselineShift` becomes a
`baseline-shift` percentage, and `fontScale` becomes a percentage `font-size`.
Both percentages resolve against the parent in SVG, which is the unit the run
fields are already in.

One case normalizes rather than round-tripping exactly. `baseline-shift="super"`
carries the preset's *size* as well as its rise, so a run that overrode only
the rise has no keyword left to say the size with; it serializes as the two
primitives the preset stood for and parses back that way. Same rendering,
different fields — without it the superscript came back full-size at a raised
baseline.
