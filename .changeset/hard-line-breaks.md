---
"@weasel-js/text": patch
"@weasel-js/core": patch
---

Text now ends a line at every UAX #14 hard break, not only at `\n`: CR, CRLF
(one break, not two), VT, FF, NEL, U+2028 LINE SEPARATOR and U+2029 PARAGRAPH
SEPARATOR. This applies to `layoutRuns`, `layoutMarkdown` and the edit overlay,
wrapped or not. None of them lays out a cell, and a caret offset on either side
of a CRLF stays exact. As with `\n`, and as with a forced break in CSS, the
line a hard break ends is never spread by `justify`; U+2028 and U+2029 behave
the same way here. This is a behavior change: text holding those characters
lays out on more lines than before.

The edit overlay writes each hard break the browser would not break at as a
`<span data-break>` holding a newline, and reads the original character back
on commit, so an edit no longer turns U+2028 into a space or a lone CR into a
newline. A node without runs is now seeded with text nodes instead of through
`innerText`, which also puts the caret at the right offset on any line after
the first.

Additive: `isHardLineBreak(codePoint)` in `@weasel-js/text`.
