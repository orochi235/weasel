---
'@weasel-js/labkit': patch
---

An instrument's config schema can be drawn over another schema: `f.schema(nodes, { over })`. Its aliases may
show a leaf of that schema and its conditions may read a setting of it, in a trial's settings panel as in a
bare `ControlPanel`, which now takes the resolved schema's `over` when given none. The lab keeps that schema's
values, not the trial: `<Lab over={{ values, set }}>` hands it the app's, and a lab given none keeps them in
memory, shared by every trial. A write to one of its paths goes to `over.set` rather than the trial's config,
and an instrument reads them through `ctx.over.read(path)` in `render` and in a canvas layer's `draw`.
