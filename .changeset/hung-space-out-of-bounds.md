---
'@weasel-js/text': patch
---

Keep a hung trailing space out of `bounds.width`

A line that wraps keeps the space it broke at. Alignment already hangs that
space past the aligned edge — `inkWidth` has excluded it since hanging went in
— but `bounds.width` folded the full advance width, so a block wrapped at
`maxWidth` reported wider than the box it had just been fitted into.

Anything that scales text to fit reads that overshoot as real and shrinks the
text by it. One consumer measured up to 9.4% too small on wrapped strings, and
it is silent: the glyphs land in the right places, so a visual baseline suite
sees nothing.

`bounds.width` now folds `inkWidth`, the value alignment already uses. Line
boxes are unchanged: `x1` still includes the hung space, because it doubles as
the caret stop that closes the line and a caret belongs after the space, not
on it.
