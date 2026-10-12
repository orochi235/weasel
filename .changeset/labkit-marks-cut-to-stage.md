---
'@weasel-js/labkit': patch
---

A labkit annotation target that lies partly or wholly outside what clips it — a stage it was panned out of, a scrolling pane — no longer draws its marks, or takes presses, over whatever is beside it. Marks are cut where the target is cut, and a target out of sight draws nothing and takes no input. Additive: a `SurfaceFrame` now carries `visible`, each tile's rect cut by its clipping ancestors, beside `rects`; a tenant painting into a shared buffer confines itself to `visible` and places its drawing against `rects`.
