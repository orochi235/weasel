---
"@weasel-js/ui": patch
---

Add five Platonic-solid glyphs, `d4`, `d6`, `d8`, `d12` and `d20`, named for
the die each solid makes. They are drawn with a finer outline than the rest of
the set, and finer inner edges still.

Export `ICON_GROUPS`, which files every glyph in `ICON_PATHS` under the family
it was drawn in, so an icon picker can section itself instead of listing ~200
names flat. The old "state and instrument" family is split into playback,
state and instrument, and `filter` now sits with the actions.

`curvePulseTrain` is now one line that steps up and down along its baseline.
It used to draw a full-width baseline under three separate pulses, closing
each one into a rectangle.
