---
'@weasel-js/text': patch
---

Two placement fixes in `layoutRuns` with a `bidi` engine. A wrapped line in a right-to-left paragraph ended in a space that was drawn at the left but subtracted from the right, so each wrapped line poked one space past the aligned edge; the space now hangs off the left. And a character the engine removes from the visual order (a zero-width joiner, a soft hyphen, a bidi control) reported its cell at the far end of the line; it now sits beside the character it follows.
