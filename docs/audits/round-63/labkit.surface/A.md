# Audit round 63 — labkit.surface (blind reviewer)

Note: the brief's commit 1b4edb3a93db1759496d564da57eb13020b3d7d2 is not in this repository (`git cat-file` reports a
bad object). The tree read is HEAD 6f634fabe1, with no local changes under `packages/labkit/src/surface`.

## A scroll inside a shadow root never reaches the surface's document scroll listener, so a shadow-hosted tile's box lags the scroll by a frame
- where: packages/labkit/src/surface/useTiledSurface.ts:72 (onAnyScroll)
- scenario: a tile sits inside a web component whose shadow tree holds the scroller (e.g. `<my-panel>` with an
  `overflow:auto` div in its shadow root holding the tile; commits e3bb24b7ed / c8a155935d made tiles in shadow
  roots a supported case). The user scrolls that div. The `scroll` event fired at an element is not composed, so its
  path stops at the shadow root and the capture listener on `el.ownerDocument` never runs. Nothing calls
  `invalidateRects` until the observers behind `watch` report after the frame has drawn. That is the exact gap
  `onAnyScroll` exists to close (its doc comment: "a press in between lands on the box of whatever tile was there"):
  the tile paints and hit-tests at its pre-scroll rect for a frame. It should re-measure on the scroll, which needs
  a capture listener on each shadow root holding a tile (or on the tile's `getRootNode()`) as well as the document.
- evidence: read (DOM spec: element `scroll` events are fired with `composed` false)
- severity: low

## Scope membership walks the DOM tree, clipping walks the flattened tree: a slotted tile under a scope element inside a shadow root drops out of scope
- where: packages/labkit/src/surface/measureTiles.ts:18 (holds / scopeHolds), compare packages/labkit/src/surface/clip.ts:70 (boxParent)
- scenario: a component's shadow tree is `<div class="pane"><slot></slot></div>`, and the tile is a light-DOM child
  of the host, slotted into that pane. The host calls `scope(paneEl)`, e.g. a lightbox scoping to the pane it
  expanded. `holds` climbs `parentNode` then `ShadowRoot.host`: tile → host → … and never passes `paneEl`, so
  `scopeHolds` is false. The tile drops out of `rects`, goes unpainted, and `inScope` / `useTileInScope` report it
  hidden, though it renders inside the pane. `clipToAncestors` answers the same question ("which elements is this
  tile laid out inside?") through `assignedSlot` and does find the pane, and clips the tile by it. One module treats
  the pane as the tile's ancestor and the other doesn't. `holds` should climb `assignedSlot` first, as `boxParent`
  does.
- evidence: read
- severity: low

## Paint containment on `<body>` cuts a tile to the viewport rather than to the body's box
- where: packages/labkit/src/surface/clip.ts:46 (clipsViewport), used from clip.ts:55 (clipEdges) via clip.ts:97-100
- scenario: the root's overflow is `visible` (the default) and the body has `contain: paint` (or `content`/`strict`,
  or `content-visibility: auto`) with `overflow: visible`. `contained` is true, so `clipEdges(body)` runs.
  `clipsViewport(body)` is true because the root doesn't clip, so the tile is cut to the viewport. Paint containment
  clips to the element's own padding box and doesn't propagate to the viewport; per CSS Overflow, a body with paint
  containment also stops overflow propagating. A tile inside a body narrower than the viewport (`body { width: 600px;
  contain: paint }`) that pokes past the body's edge gets a `visible` rect reaching to the viewport edge, so it draws
  and takes input where the page shows nothing of it. `clipsViewport` applies only to `overflow`. It should be false
  for paint containment, and for a body that is itself paint-contained.
- evidence: read
- severity: low

## Files read
packages/labkit/src/surface/SurfaceContext.ts
packages/labkit/src/surface/clip.ts
packages/labkit/src/surface/composeRects.ts
packages/labkit/src/surface/deviceRect.ts
packages/labkit/src/surface/index.ts
packages/labkit/src/surface/measureTiles.ts
packages/labkit/src/surface/rect.ts
packages/labkit/src/surface/tiledSurface.ts
packages/labkit/src/surface/useElementWatch.ts
packages/labkit/src/surface/useSurfaceTile.ts
packages/labkit/src/surface/useTiledSurface.ts

<!-- done: 3 findings, files read: 11 -->
