---
'@weasel-js/diagram': patch
---

`@weasel-js/diagram/effect` is new: `EffectChart` draws an effects pipeline given as plain data, with stages, the typed ports each reads and writes, the wires between them, and groups. How it is drawn is a look, a function from a pipeline to what `diagramScene` takes; `nodeGraph` gives every port a named row and `rack` runs the main signal along one line with side inputs hung beside it. A decision draws as a branch symbol (`diamond`, `bar`, `demux`, `switch`), and one with `split` draws its cut values as ticks on a bar. `checkPipeline` reports a wire that names a missing stage or port, runs the wrong way, or joins two types, and the other ways a pipeline can be wrong.

The rest is additive in `@weasel-js/diagram` itself, and nothing existing changes: `DiagramView` takes `ports="show"` to draw ports with nothing to connect; `portOptions.fill` may be a function of the port, `portOptions.shape` may be `'circle'`, and `portOptions.showsPort` picks which of a node's ports show; `'trapezoid'` is an outline; a data node takes `marks`, shapes in a unit square stretched over its box and text pinned to a point on it; and `chain` is a layout that stands one run of nodes on a line and hangs the rest beside it.
