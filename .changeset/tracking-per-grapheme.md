---
"@weasel-js/text": patch
---

`letterSpacing` is now added once per grapheme cluster on every path, which is
how CSS `letter-spacing` counts and so how the DOM edit overlay already
tracked. `layoutRuns` used to track per code point and `measuredWidth` per
UTF-16 unit, so text with combining marks, ZWJ emoji sequences or (on the 2D
path) astral characters measured wider than the overlay showed it, and the 2D
and GL paths could wrap such a line differently. This is a behavior change:
tracked text containing those characters is narrower than before and may wrap
at a different word. Untracked text is unaffected.
