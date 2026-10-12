---
'@weasel-js/audio': patch
---

Fixes: a pattern player driven from its own `onStep` ran two sequences at once. `setTempo` called there booked a next step, and the step that was firing then booked another, so every later step played twice, once at each tempo. `stop` called there left one booking behind, which a later `start` picked up as a second sequence. A tempo set from inside `onStep` now starts with the step after the one reported, which keeps the length its events were gated by, and a step stopped from inside `onStep` books nothing.
