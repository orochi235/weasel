---
"@weasel-js/animator": patch
---

An endless timeline whose laps pass the double range, on a clock near `Number.MAX_VALUE`, keeps its playhead in its lap, however far along earlier laps had moved it. Its time read `NaN` from the second such frame, and a seek to `Number.MAX_VALUE` landed at `-Infinity`.
