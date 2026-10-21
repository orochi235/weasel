---
'@weasel-js/audio': patch
---

The patchable graph's sources keep their place and their tuning in cases that used to slip. A file source resumes from the right point after a start dated in the future or the past, a `rate` write made before a future start, and a ramped `rate`, which now counts by its ramp rather than as a jump. A `rate`, `frequency` or `detune` write after `stop(later)` retunes the node still sounding. A non-looping file that plays to its end can be started again by the graph without a full stop first: `GraphNodeDef.start` takes an optional `ended` callback a source calls when it stops on its own. A `replace` made during `stop()`'s fade stops the outgoing source with the rest, and a fader's second `close` keeps its `done`.
