---
"@weasel-js/animator": patch
---

An endless timeline on a clock near `Number.MAX_VALUE` keeps its playhead inside its lap, and a seek to `Number.MAX_VALUE` lands there too.

<!-- entry: fix -->
