---
"@weasel-js/text": patch
---

`layoutMarkdown`, and so `createMarkdownRenderer`, wraps at the same UAX #14
break opportunities as `layoutRuns` instead of only at spaces: after a hyphen,
between CJK characters, and never before `!`, `?` or a closing bracket. The
opportunities are found across run boundaries, so a word split between two
styled runs no longer breaks at the seam. As in `layoutRuns`, only a word's
ink has to fit on the line, and the spaces after it hang. This is a behavior
change with no API change: markdown text may wrap differently than before.
