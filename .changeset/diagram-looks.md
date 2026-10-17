---
'@weasel-js/diagram': patch
---

`EffectChart` has two more looks, both in `EFFECT_LOOKS`. `lanes` gives each value type a horizontal lane and stands each stage across the lanes of the types it reads and writes, as tall as they are, with each port in its own type's lane; lanes grow until what stands in them fits (`lanes`, `laneHeight`, `rankGap`, `router`, `colors`, `showParams`, `showValues`, `branch`, `measure`; `laneId`, `LANE_INSET`). `compact` draws each stage on one line with no ports drawn and one line between two stages however many wires join them, a decision as a one-line hexagon by default with a line per exit (`router`, `nodeGap`, `rankGap`, `colors`, `branch`; `COMPACT_PADDING`). It shows no params or value rows.

Five more branch symbols: `'hexagon'`, `'step'`, `'comparator'`, `'crossover'` and `'fork'`, a bare dot whose conditions sit on its wires. `'step'` and `'crossover'` need a sound `split` and `'comparator'` exactly two outputs; each draws a diamond otherwise. `wireEdges(pipeline, color)` builds the port-to-port edges `nodeGraph` and `lanes` draw. Additive.
