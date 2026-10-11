---
'@weasel-js/text': patch
---

`layoutRuns` put every glyph of a gradient- or pattern-filled run in a draw group of its own, so a 500-character run was 500 draws. Glyphs sharing one paint object now share a group, as solid-filled ones do.
