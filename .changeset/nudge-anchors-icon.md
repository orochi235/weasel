---
'@weasel-js/core': patch
---

The Nudge Anchors actions draw a glyph of their own: a hatched block pushed by a two-ring pulse behind it, turned the way each one moves. `NudgeAnchorsIcon` takes `dir`, and points right when given none. Before, those actions had no icon, and a surface showed their arrow keys in its place.
