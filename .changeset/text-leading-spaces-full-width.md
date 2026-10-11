---
'@weasel-js/text': patch
---

`layoutRuns` gave the first space of a line no width and every later one its full advance, so `" AB"` drew `A` at 0 and `"  AB"` one space in. Every leading space now takes its advance, at the start of the text and after a hard break, which is what the edit overlay's `white-space: pre` shows; text indented with spaces no longer shifts left by one space when an edit commits. A line that opens with spaces is that much wider and its glyphs that much further right.
