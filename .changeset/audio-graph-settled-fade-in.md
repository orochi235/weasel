---
'@weasel-js/audio': patch
---

`AudioGraph.settled()` waits for a new connection, and a replacing def, to finish fading in, so a tap read after it sees the full level.

<!-- entry: fix -->
