---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
"@weasel-js/menu": patch
"@weasel-js/routing": patch
---

Controls can run along a curve. `@weasel-js/geom` adds track shapes (`lineShape`, `arcShape`), reading runs over them
(`trackRun`) and their SVG path data (`trackShapeD`). `@weasel-js/ui` adds `Along`, which sizes an arc from its box
and hands it to the controls inside; `Slider`, `DetentSlider` and `Bar` follow it, or a `shape` prop.
`TrackCtx` gains a required `shape` field — the value span as a shape — so code that builds a `TrackCtx` itself no
longer typechecks until it supplies one. `paintGradientTrack` paints straight tracks only. A menu opened under a
button can ask to open above it (`placeMenuUnder`'s `above`, `MenuOpenRequest.above`).
