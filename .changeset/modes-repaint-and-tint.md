---
'@weasel-js/modes': patch
'@weasel-js/core': patch
---

A mode switch now repaints the canvas with no consumer code.

- `@weasel-js/modes`: `getActiveModeFor(registry)` returns the reader `<SceneCanvas getActiveMode>` takes — the active mode's id and its allowed capability tags, implicit ones included — so apps stop rebuilding it. `ScopingDim` and `ModeDecorations` gain `subscribe` and `getVersion`, both following the registry; `ScopingDim.invalidate()` tells subscribers the target set moved inside one mode.
- `@weasel-js/core`: `RenderLayer.subscribe` lets a layer name the outside state its `draw` reads, and `<Canvas>`/`<SceneCanvas>` take `redrawOn` for sources no layer declares, such as the `ScopingDim` an `alphaFor` consults. Either one repaints the canvas when it notifies. `gateLayer`, `createTiledLayer`, `createViewportLayer` and `createParallaxLayer` pass their sources' `subscribe` through, and `subscribeToSources` builds the same for a layer of your own that draws others. `workspaceTintLayer({ registry, page?, intensity? })` paints the active mode's `WorkspaceVisual` — the whole canvas, or only the workspace around a page — and `modeDecorationLayer(decorations)` draws a `ModeDecorations`; both subscribe for themselves. Core now depends on `@weasel-js/modes`.
