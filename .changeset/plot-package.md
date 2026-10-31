---
"@weasel-js/plot": patch
---

Add `@weasel-js/plot`, charts on the scene graph. Scales (`linear`, `log`, `band`, `time`, `ordinal`), axes, and
marks (`bar`, `span`, `line`, `area`, `point`, `arc`, `ribbon`, `rule`, `text`) that keep their datum in scene data;
`PlotData`, a union of chart specs that `plotSpecs` compiles to one root node holding the spec with its marks under
it; `replacePlotData`, which swaps a spec as one undo entry; and `plotEditing` and `PlotView`, which edit a chart by
dragging its marks. `xychart` is the first kind: bar and line series over categories or a numeric range.
