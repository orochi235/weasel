---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

Alignment can resolve against reading direction

`align` gains `start` and `end` alongside `left` / `center` / `right`, and
`TextStyle` gains `direction: 'ltr' | 'rtl'`. The split is CSS `text-align`'s:
the relative pair resolves against the direction, the absolute pair ignores it.
`resolveAlign(align, direction)` collapses one to the other and is exported for
consumers that need an edge rather than an intent.

Direction is an input, not something this package discovers. `@weasel-js/text`
has no DOM, so a consumer that reads `getComputedStyle(box).direction` passes
what it found; nothing here sniffs an environment.

Defaults are unchanged — `align: 'left'`, `direction: 'ltr'` — so no existing
layout moves. Making `start` the default alignment is a separate call.

`@weasel-js/svg` carries the direction through: `direction` joins the
inheritable presentation properties, and `text-anchor` is now written and read
against it. Two things were wrong before and are worth naming, because both
rendered plausible output:

- `align: 'start'` serialized to `text-anchor="end"` — the opposite edge — via
  a mapping that assumed three values and read the fourth as its `else`.
- SVG's initial `text-anchor` is `start`, which under `direction="rtl"` is the
  right edge, while this model's default `align` is `left`. They agree under
  `ltr` and only there, so an RTL document with no explicit anchor imported as
  left-aligned.

This is alignment and round-tripping only. Layout still walks code points in
logical order with the pen always increasing: there is no bidi reordering and
no shaping, so a Hebrew or Arabic string aligns to the correct edge and still
renders in logical order, and Arabic still renders unjoined.
