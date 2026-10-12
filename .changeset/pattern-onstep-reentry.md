---
'@weasel-js/audio': patch
---

Fixes: a pattern player driven from its own `onStep` ran two sequences at once. `setTempo` called there booked a next step, and the step that was firing then booked another, so every later step played twice, once at each tempo. `stop` called there left one booking behind, which a later `start` picked up as a second sequence. `setTempo` from inside `onStep` now only changes the tempo the firing step books its successor at, and a step stopped from inside `onStep` books nothing.
