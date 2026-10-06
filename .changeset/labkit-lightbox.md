---
'@weasel-js/labkit': patch
'@weasel-js/routing': patch
---

A `<Workspace>` tile can be shown large: the expand button in its top-right corner fills most of the window with it, over a dimmed page. Escape, a click in the dimmed margin, or the close button puts it back, and focus returns to where it was. The tile is not remounted. Its element is lifted into the browser's top layer, so a WebGL context or scene inside it keeps running and only sees its box grow, and anything sizing itself from a `ResizeObserver` follows.

The button is on every tile. `lightbox={false}` takes it off a workspace, and `lightbox={(id) => …}` decides per tile. A double-click opens a tile only where you ask, with `expandOnDoubleClick={(id) => id === 'output'}` — off by default, since most content has its own use for a double-click. Even then, a double-click on a control, inside `[data-lk-lightbox-ignore]`, or one a handler further in already called `preventDefault()` on does not open it.

The same behavior is available on its own as `<Lightbox>`, with `label`, `disabled`, `expandOnDoubleClick`, and controlled `expanded` / `onExpandedChange`. Content inside reads the state with `useLightbox()`; a component that draws its own expand control calls `useLightboxControl()` instead, and the corner button steps aside while it is mounted.

Every trial in a `<Lab>` has the toggle in its title bar — the built-in contribution `expand` — and `<Lab expandOnDoubleClick>` takes the same opt-in, as a boolean or a function of the trial's record. An expanded trial keeps what the lab's shared surface draws for it: annotation marks stay over it and still take new marks, and a `useSurfaceTile` tenant such as a 3D view keeps painting under it. The lab's two buffers now sit in layers of their own (`.lk-lab__layer--under` and `.lk-lab__layer--over`) rather than as bare canvases in the lab body, and tile rects are measured against the over layer. `<LightboxLayers below above>` declares such layers to every lightbox inside it, which lifts them around itself; a host owning its own surface uses it for its own buffers.

`SurfaceHandle` gains `scope(el)`, `inScope(id)`, and `subscribeScope(listener)`: a scoped surface paints only the tiles inside `el`, so no other tile draws over an expanded one, and `useTileInScope(tileId)` tells a tenant's own chrome when to hide. Code that builds a `SurfaceHandle` by hand, such as a test fake, needs the three new members.

The gesture dispatcher now calls `preventDefault()` on the browser's `dblclick` when it has already acted on that double click — a binding handled its `doubleclick`, or an `onDoubleClick` observer was given — so a double-click that edits a scene does not also open a lightbox around it.
