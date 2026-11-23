---
'@weasel-js/font': patch
---

An outline face remembers at most 8192 glyph paths, so a face asked for many distinct characters no longer grows its memory without limit.

<!-- entry: fix perf -->
