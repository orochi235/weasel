---
'@weasel-js/core': patch
---

Stroke text at any size, not only above the outline threshold.

A glyph escalates from its SDF tier to tessellated outlines once it covers
`OUTLINE_MIN_SCREEN_PX` (48) on screen, and only the outline tier has geometry
to stroke. Text below that silently dropped its stroke: the control was live,
the paint never arrived, and the same text stroked correctly inside a magnifier
that happened to lift it over the threshold.

A run carrying a stroke now escalates at any size. The threshold still governs
unstroked text, where it is a choice between two correct renderings rather than
between a stroke and nothing. A zero-width stroke does not escalate, and an
explicit opt-out of the tier still wins — as does a run the tier cannot serve
(no registered outlines, or synthetic bold, whose emboldening is an SDF
threshold shift with no geometric equivalent).
