# Audit round 63 — labkit.surface findings

## A scroll inside a shadow root never reaches the surface's scroll listener, so tiles in a shadow-tree scroller lag a frame behind
- where: packages/labkit/src/surface/useTiledSurface.ts:72 (onAnyScroll)
- scenario: a tile sits inside a scrolling element in an open shadow root (supported since e3bb24b7ed / c8a155935d). The user scrolls that scroller. `scroll` events are not `composed`, so the capture listener on `el.ownerDocument` never sees them (the event path stops at the shadow root). Remeasuring then waits on `watchElementMove`'s IntersectionObserver, which the comment above `onAnyScroll` says reports only after the frame drew: the tile paints at its old place for a frame, and a press in between lands on the box of whatever tile was there. Expected: scrolls in shadow roots holding tiles remeasure ahead of the frame, as document scrolls do.
- evidence: read
- severity: medium

## Scope membership walks the DOM tree while clipping walks the flattened tree, so a slotted tile drops out of a scope that holds its slot
- where: packages/labkit/src/surface/measureTiles.ts:18 (holds) vs packages/labkit/src/surface/clip.ts:70 (boxParent)
- scenario: a web component renders `<div class="lightbox"><slot></slot></div>` in its shadow root; a light-DOM child of the host is a tile. A host scopes the surface to the shadow tree's `.lightbox`. `holds` climbs `parentNode` (tile → host → …) and never passes through the slot, so `scopeHolds` is false: the tile vanishes from `rects`, is not painted, and `useTileInScope` reports false, although the tile is laid out and drawn inside the lightbox. `clipToAncestors` for the same tile follows `assignedSlot` and counts the lightbox as its ancestor. Same question ("is this tile inside that element?") answered two ways.
- evidence: read
- severity: low

## A container resize that moves no tile delivers no frame, so the owner never resizes its buffers to the new size
- where: packages/labkit/src/surface/tiledSurface.ts:246 (remeasure) / :229 (step)
- scenario: tiles are laid out from the container's top-left (fixed-width column). The container shrinks or grows at its right/bottom edge (window resize). The container's ResizeObserver calls `invalidateRects`; `remeasure` compares only tile `rects`/`visible`, which are container-relative and unchanged, so `moved` and `forced` are false, nothing is dirty, and `step` returns without calling `onFrame`. `LabSurface`'s `onFrame` (lab/LabSurface.tsx:84) is the only place canvases get `frame.size`, so the canvases keep the old pixel and CSS size — larger than a shrunk container (overflowing it) or short of a grown one — until some unrelated tile happens to be invalidated. Expected: a change in container size counts as a retile (or at least delivers a frame).
- evidence: read
- severity: medium

## A tile scrolled out of a normally scrolling page keeps a full `visible` rect
- where: packages/labkit/src/surface/clip.ts:44 (clipsViewport) / :94 (clipToAncestors)
- scenario: a default page — root and body `overflow: visible` — scrolls in the viewport. A tile scrolled wholly below the fold: no ancestor's computed overflow clips, `clipsViewport` is reached only for an ancestor that clips, so the viewport cut is never applied and `visible` equals the full rect. `SurfaceFrame.visible` promises "Zero-sized for a tile wholly out of sight"; a tenant relying on that to skip off-screen work paints it anyway. The viewport clips its content whatever the root's `overflow` computes to (abbbf56713 handled only the root/body-clips case).
- evidence: read
- severity: low

## `overflow: clip` is cut to the padding box, ignoring `overflow-clip-margin`
- where: packages/labkit/src/surface/clip.ts:25 (paddingEdges) / :100
- scenario: an ancestor with `overflow: clip; overflow-clip-margin: 20px` lets a tile's content paint 20px past its padding box. `clipEdges` returns the padding box for every clipping value, so `visible` is 20px short on each side and a tenant confining drawing and input to `visible` cuts off content that shows.
- evidence: read
- severity: low

## A `content-visibility: hidden` ancestor leaves its tiles a nonzero `visible` rect
- where: packages/labkit/src/surface/clip.ts:13 (containsPaint)
- scenario: a tile inside an element with `content-visibility: hidden`. The element's contents are not rendered at all, but `containsPaint` treats it like `contain: paint`, cutting the tile only to the element's padding box. The frame's `visible` stays nonzero for a tile nothing of which is on screen. Expected: zero-sized, as for a tile wholly out of sight.
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

<!-- done: 6 findings, files read: 11 -->
