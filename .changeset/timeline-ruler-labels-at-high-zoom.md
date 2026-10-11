---
'@weasel-js/ui': patch
---

`Timeline`'s ruler labels each tick differently at high zoom. Zoomed to a window a few milliseconds wide, the ticks sat a fraction of a millisecond apart and every label was rounded to a whole one, so the ruler read `0ms 0ms 0ms 1ms 1ms`. A label now carries the decimals its tick spacing needs.
