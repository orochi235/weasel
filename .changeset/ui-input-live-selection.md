---
'@weasel-js/ui-input': minor
---

`liveSelection(current, count)`: a selection model that reads the model `current` returns at each call.

An edit begun at a press then reports through the latest handler.

Hand it to `sweepFrom` or `soloSweepFrom` where the run outlives the render that started it.

<!-- entry: api -->
