---
'@weasel-js/minimap': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

minimap: a new package over core, holding the minimap in both its forms. `createMinimapContribution` and `createLinkedCursorContribution` are the ambient entries; `<MinimapCanvas>` is the detached canvas; `minimapCenterAction`, `minimapPanAction`, `centerRootOn`, `MINIMAP_CENTER`, and `MINIMAP_PAN` are the actions both run; `createIndicatorLayer`, `createLinkedCursorLayer`, `crosshairRects`, and `CROSSHAIR_HALO` are the chrome; `computeFitView`, `computeIndicatorCommand`, and `FALLBACK_FIT_VIEW` are the fit math. It depends on `@weasel-js/react` and `@weasel-js/routing`, with `@weasel-js/core` and `react` as peers.

**Breaking for `@weasel-js/core`:** `MinimapCanvas`, `createMinimapContribution`, `createLinkedCursorContribution`, `minimapCenterAction`, `minimapPanAction`, `centerRootOn`, `MINIMAP_CENTER`, `MINIMAP_PAN`, `crosshairRects`, `CROSSHAIR_HALO`, `computeFitView`, `computeIndicatorCommand`, and `FALLBACK_FIT_VIEW`, with their types (`MinimapCanvasProps`, `MinimapContributionOptions`, `LinkedCursorOptions`, `CrosshairRect`, `ComputeFitViewOptions`, `IndicatorStyle`, `MinimapFit`), are no longer exports of `@weasel-js/core`. Import them from `@weasel-js/minimap`. `@weasel-js/labkit/weasel-canvas` still re-exports the ones it did.

core: `accentColorOf` and `FALLBACK_ACCENT` are exported. `accentColorOf(el)` reads `--wzl-accent` off an element, where the theme cascade lands on a canvas.
