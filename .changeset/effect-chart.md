---
'@weasel-js/diagram': patch
---

`@weasel-js/diagram/effect` is new: `EffectChart` draws an effects pipeline given as plain data, with stages, the typed ports each reads and writes, the wires between them, and groups. How the pipeline is drawn is a look, a function from a pipeline to what `diagramScene` takes; `nodeGraph` gives every port a named row and `rack` runs the main signal along one line with the rest hung beside it. `EffectChart` takes the pipeline, which it compares by content, a look, the look's options, a size, a `background` paint, and the usual `selected` / `onSelect`, and reports `checkPipeline`'s findings through `onProblems`. A stage that sends the signal one of several ways draws as a branch symbol (`diamond`, `bar`, `demux`, `switch`), and one with `split` draws its cut values as ticks on a bar. `checkPipeline` reports a wire that names a missing stage or port, runs the wrong way, or joins two types, a repeated stage, port or group id (`duplicate-group` for a group whose id repeats another's or a stage's), and the other ways a pipeline can be wrong.

For writing a look, the entry also exports what the shipped looks are built from: `uniqueStages`, `uniqueGroups`, `drawableWires` and its `DrawableWire` type, `stageRows`, `exitLabel`, `stageStyle`, `wireStyle`, `isControl`, `kindOf`, `portOn` and `PROBLEM_COLOR`.

The rest is additive in `@weasel-js/diagram` itself, and nothing existing changes:

- `DiagramView` takes `ports="show"`, to draw ports with nothing to connect.
- `portOptions.fill` may be a function of the port.
- `portOptions.shape` may be `'circle'`.
- `portOptions.showsPort` picks which of a node's ports show; `createPortAffordance` takes the same option, and `createConnectAction` takes it to keep a connect from landing on a hidden port.
- `'trapezoid'` is an outline.
- A data node takes `marks`: shapes in a unit square stretched over its box, and text pinned to a point on it. `diagramMarkOf`, `markShape`, `registerMarkShape` and the `DataMark` and `DiagramMark` types are exported.
- `chain` is a layout, exported and accepted by name as `layout: 'chain'` in `diagramScene`, `layout('chain')` on a `DiagramView` and `algorithm: 'chain'` in `createLayoutAction`. It stands one run of nodes on a line and hangs the rest beside it; the `chain` and `chainSide` layout options pick the run and the side, and the run is the longest path when `chain` is unset or names no node.
