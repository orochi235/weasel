---
'@weasel-js/diagram': patch
'@weasel-js/renderer': patch
---

`EffectChart` draws a run of its pipeline.

- **`run` prop.** An `EffectRun` sits beside the pipeline, keyed by stage id: each stage's `cost`
  in milliseconds, a decision's `taken` output, and each output's `values` as text. The chart
  fades a stage the run never reached and its wires, fades a decision's wires to outputs it did
  not take, writes each cost above its stage's corner, and fills in value rows. A run edits the
  scene in place: no new layout, no refit, and only the changed fields are written, so it may
  change every frame. `paintRun` and `costText` are exported for a chart of your own.
- **`showValues`** on `nodeGraph` and `rack` keeps a row per output for a run's value
  (`valueRowId`, `NO_VALUE`).
- **Breaking:** `stageRows(stage, showParams, withPorts)` is now
  `stageRows(stage, { showParams, withPorts, showValues })`.
- **Body rows.** A `label` or `field` row may carry an `id`, which names its scene node
  `<body id>/<row id>` so it can be found again; and a `field` may carry `room`, a value it is
  measured at least as wide as.
- **Renderer:** text now honors a solid fill's `opacity`, in its glyphs and its decoration rules.
  It was ignored, so faded text drew at full strength.
