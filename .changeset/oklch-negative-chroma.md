---
"@weasel-js/paint": patch
---

`parseColor` reads a negative `oklch()` chroma as 0, as CSS clamps it, where it drew the color with its hue turned half a turn: `oklch(0.6 -0.1 30)` came back a teal rather than a gray.
