The findings file couldn't be written (permission denied), so here is the whole document.

# Audit round 51 — labkit.surface (blind reviewer)

Note: the brief names frozen commit d6aa8f2ede77fc3556ffbf594c570943b8bf31f2. That commit does not exist in this repository. The tree is at 674caba3dd, and none of the listed files differ from that commit, so line numbers are against 674caba3dd.

## clipToAncestors clips to the root element's (or a propagating body's) box, so a scrolled page hides tiles that are on screen
- where: packages/labkit/src/surface/clip.ts:53-66 (clipToAncestors), :14-25 (paddingEdges)
- scenario:
  - The page sets `html { overflow-y: scroll }` (or `auto`), the viewport is 800px tall, and the document is scrolled by 500px.
  - The walk reaches `<html>`. `paddingEdges(html)` takes `top = getBoundingClientRect().top`, which is −500. For `bottom` it adds the root's `clientHeight`, which CSSOM defines as the viewport height (800).
  - So the clip is client y ∈ [−500, 300] instead of [0, 800]. A tile at client y 400 is fully on screen but gets a zero-height `visible`. `AnnotationOverlay` then hides its input box, and painters scissor to nothing.
  - The same thing happens with `body { overflow: hidden }` while `html` is visible. The body's overflow propagates to the viewport, so the body itself clips nothing. The walk still clips every tile to the body's box, which has zero height when the app's content is absolutely or fixed positioned.
  - Fix: treat the root (and a body whose overflow propagated) as the viewport, or skip it.
- evidence: read
- severity: medium

## An ancestor whose `overflow` applies to no box (display: contents, a non-replaced inline) collapses the tile's visible rect
- where: packages/labkit/src/surface/clip.ts:54-65, :14-25
- scenario: a tile sits inside `display: contents; overflow: hidden`, or inside `<span style="overflow:hidden">`. `overflow` has no effect on either, but the computed style still reads `hidden`.
  - For `display: contents`, the rect is all zeros and `offsetWidth` is 0, so the clip box is 0×0 at the viewport origin.
  - For the inline span, `clientWidth`/`clientHeight` are 0, so the clip box is zero-sized.
  - Either way, a fully visible tile is treated as wholly out of sight: its chrome is hidden and its scissor is empty.
- evidence: read
- severity: low

## Paint containment clips like overflow, but clipToAncestors ignores it
- where: packages/labkit/src/surface/clip.ts:10, :54-57
- scenario: a tile is panned partly outside an ancestor with `contain: paint` (or `content`/`strict`/`content-visibility: auto`) and `overflow: visible`. The browser clips the tile's DOM to that ancestor's padding box. `clips()` reads only `overflowX`/`overflowY`, so `visible` keeps the hidden part, and the tenant draws (and takes input) over the neighbour.
- evidence: read
- severity: low

## clipToAncestors stops at a shadow root, so a tile inside a web component ignores every clip outside it
- where: packages/labkit/src/surface/clip.ts:53
- scenario: a tile lives in a custom element's shadow root, and that element sits in a scrolled `overflow: auto` stage. `parentElement` is null at the shadow tree's top-level child, so the walk never reaches the host or the stage. When the tile scrolls out of the stage, it is still reported whole and painted over the stage's neighbours. The walk should continue via `getRootNode().host`.
- evidence: read
- severity: low

## scopeHolds uses Node.contains, which does not cross shadow boundaries, so a shadow-DOM tile drops out of a scope that holds it
- where: packages/labkit/src/surface/measureTiles.ts:18-22 (also measureTiles:40, tiledSurface.ts:177-180 inScope)
- scenario: a lightbox scopes the surface to its element, and the expanded trial's tile is in a shadow root inside it. `lightbox.contains(tile)` is false, so the tile:
  - leaves `rects`,
  - is never painted,
  - is cleared by the retile,
  - and `useTileInScope` returns false.

  The expanded trial shows nothing.
- evidence: read
- severity: low

## The document scroll listener outlives the surface unless the host calls containerRef(null)
- where: packages/labkit/src/surface/useTiledSurface.ts:104-110 (containerRef), :150-155 (no unmount cleanup)
- scenario: a host attaches the container and never calls `containerRef(null)`. The package's own tests do this with `ref={(el) => { if (!el) return; surface.containerRef(el); }}`; an effect with no matching null does the same. Then the owner unmounts.
  - Observers are disconnected and the frame loop is cancelled.
  - The capture-phase `scroll` listener from `onAnyScroll` is never removed. Every scroll in the document still calls `invalidateRects` → `frameLoop.request()` on the dead hook.
  - The listener also keeps the `TiledSurface` alive, with its tile elements, painters and clears.
- evidence: read
- severity: low

## Releasing a tile with registerTile(id, null) drops whichever element now holds the id, not the one leaving
- where: packages/labkit/src/surface/tiledSurface.ts:143-158 (placeTile); useTiledSurface.ts:97-101
- scenario:
  1. Element A holds key K. In one commit A's DOM is removed, and B attaches for K through a ref callback (`useSurfaceTile`, layout phase).
  2. `placeTile(K, B)` is allowed, because A is no longer connected.
  3. A's release then runs from a passive-effect cleanup (the `useOverlayTile`/`LensOverlay` pattern), which comes after layout.
  4. That `registerTile(K, null)` deletes B's entry, its rect and its move watch. B is never measured or painted again.

  The release carries no element, so the surface can't tell a stale release from a real one.
- evidence: read
- severity: low

## Swapping the container for one at the same place neither retiles nor repaints, so the new buffers stay blank
- where: packages/labkit/src/surface/tiledSurface.ts:107-112 (setContainer), :222-240 (remeasure)
- scenario: the container is replaced by a new element at the same position. In `LabSurface` this happens when the over layer and its canvases remount as the lab moves out from under an outer surface and back.
  - `setContainer` only sets `stale`. Every relative rect is identical, so `moved` is false and nothing is dirty.
  - `step` returns before `onFrame`, and no clear or painter runs.
  - The freshly mounted canvases stay blank until some unrelated invalidation. In `LabSurface` they are also never sized, because `bufferRef` still holds the old size.
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

<!-- done: 8 findings, files read: 11 -->