---
'@weasel-js/diagram': patch
---

`@weasel-js/diagram/effect` is new: `EffectChart` draws an effects pipeline given as plain data, with stages, the typed ports each reads and writes, the wires between them, and groups. It takes the pipeline, a look, the look's options, a size, a `background` paint, and the usual `selected` / `onSelect`, and reports `checkPipeline`'s findings through `onProblems`. A look is a function from a pipeline to what `diagramScene` takes; `nodeGraph` gives every port a named row and `rack` runs the main signal along one line with the rest hung beside it. A stage that sends the signal one of several ways draws as a branch symbol (`diamond`, `bar`, `demux`, `switch`), and one with `split` draws its cut values as ticks on a bar. `checkPipeline` reports a wire that names a missing stage or port, runs the wrong way, or joins two types, and the other ways a pipeline can be wrong.

The rest is additive in `@weasel-js/diagram` itself, and nothing existing changes:

- `DiagramView` takes `ports="show"`, to draw ports with nothing to connect.
- `portOptions.fill` may be a function of the port.
- `portOptions.shape` may be `'circle'`.
- `portOptions.showsPort` picks which of a node's ports show; `createPortAffordance` takes the same option.
- `'trapezoid'` is an outline.
- A data node takes `marks`: shapes in a unit square stretched over its box, and text pinned to a point on it. `diagramMarkOf`, `markShape`, `registerMarkShape` and the `DataMark` and `DiagramMark` types are exported.
- `chain` is a layout, exported and accepted by name as `layout: 'chain'` in `diagramScene`, `layout('chain')` on a `DiagramView` and `algorithm: 'chain'` in `createLayoutAction`. It stands one run of nodes on a line and hangs the rest beside it; the `chain` and `chainSide` layout options pick the run and the side.
