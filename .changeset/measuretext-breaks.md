---
"@weasel-js/text": patch
---

`measureText` wraps where `layoutRuns` does. It used to break only at
whitespace and at `\n`; it now breaks at the same UAX #14 opportunities —
after a hyphen, between CJK characters, never before `!`, `?` or a closing
bracket — and ends a line at every hard break (CR, CRLF as one, VT, FF, NEL,
U+2028, U+2029), none of which appears in `lines`. Only a word's ink has to
fit, and trailing spaces hang.

Its return shape is unchanged, but this is a behavior change: the same text
may wrap into different lines. Three edges move with `layoutRuns` too: empty
text returns no lines rather than one empty line, a trailing hard break opens
no empty line after it, and a trailing tab stays in its line, since only
spaces hang.

`layoutRuns`, `layoutMarkdown` and `measureText` now share one wrap loop, so
the three cannot drift apart again.
