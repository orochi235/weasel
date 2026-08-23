---
'@weasel-js/core': patch
---

Move one view's overlay-aware state into a `useViewHelpers` hook.

`<Canvas>` built its chrome state and its layer helpers inline: the bounds
fallbacks, the committed-pose lookup, the tool preview cascade, `buildChromeState`
and the `CanvasViewHelpers` object were about 120 lines of the component body
closing over its props. They are now one hook taking explicit dependencies —
adapter, geometry, bounds resolver, selection, tools, gesture source and the
dispatcher's preview extras — and `<Canvas>` calls it for its own view.

Being a hook is the point. A canvas hosting several viewports cannot loop this
work inside one component, but N components can each call it once, which is what
per-view selection and chrome will be built from.

`CanvasHelpers`, `CanvasViewHelpers` and `CanvasSurfaceHelpers` moved to the new
module and are still re-exported from `./canvas/Canvas` and the package root, so
imports are unchanged. The hook takes only the `getPose` slice of the adapter
rather than the full contract.
