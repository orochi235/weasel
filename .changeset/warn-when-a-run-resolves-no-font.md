---
'@weasel-js/text': patch
---

Warn when a run resolves to no font at all. `layoutRuns` skipped such a run
silently — no outline face, no atlas entry, no glyphs emitted — so the text
simply did not appear, with nothing in the console to say why.

The run is still skipped, and its characters still hold their source offsets
so later runs keep their caret indices. It now says so once per
family/weight/style.

This is distinct from the existing missing-glyph warning, which fires when a
font *did* resolve but does not carry a particular codepoint.
