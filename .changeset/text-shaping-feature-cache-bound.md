---
'@weasel-js/text-shaping': patch
---

The shaper holds at most 256 parsed feature settings, so distinct ranged settings no longer grow its memory without end.

<!-- entry: fix -->
