---
"@weasel-js/core": patch
---

A `SurfaceContribution` can run on the surface's frame loop and say which kit versions it was written against. `beforePaint(ctx)` runs on every frame before it paints and `afterPaint(ctx)` once its pixels land, each handed the frame's `time`, the surface `view`, `requestFrame()` and the surface's `deps`. Hooks run in the order the surface lists its entries, and one that throws is reported once and skipped without stopping the frame; a surface whose entries declare no hooks subscribes to nothing. `requires: { core: '^1.7' }` is checked on install: a mismatch warns in development, and `<SceneCanvas versionCheck="strict">` throws instead (`"off"` skips it). The matcher is exported as `satisfiesRange` and `checkRequirements`, with `KIT_VERSIONS`. The default long-press feedback now animates from `afterPaint`.

`CanvasExtensionApi` gains `subscribeBeforePaint(fn)`, and `subscribeFrame` subscribers now receive the frame time. Additive for callers; breaking for code that implements `CanvasExtensionApi` by hand, which must add `subscribeBeforePaint`.
