# labkit.surface — blind review, round 51

## Narrowing the scope to an element holding no tiles never clears the buffer of the tiles it dropped
- where: packages/labkit/src/surface/tiledSurface.ts:205 (TiledSurface.step), with remeasure at :222
- scenario: tiles A and B are painted. `scope(el)` is then called with an element that contains no registered tile. `useLightboxModal` does `surface?.scope(stack)` for any lightbox, including one showing a plain image, and `presentation.tsx` scopes to a presented trial that may hold no drawn pane. `remeasure` sees `rects` shrink to empty, so `changed` is true. But `markMeasured` dirties the keys of the *new* `rects`, which is empty, and `tileLeft` is set only by `placeTile(id, null)`. `step` then hits `if (this.dirty.size === 0 && !left) return moved;` and returns without delivering: `onFrame` is not called, no clear runs, and the next frame measures no change. A's and B's pixels stay on the shared buffer, lifted over the lightbox. It should deliver a retiled frame so the clears run, as the "last tile leaving" case already does. `SurfaceHandle.scope`'s doc promises "the frame is retiled so the buffer is cleared of it".
- evidence: read
- severity: medium

## useTileInScope is never told when a tile registers or unregisters, so a tile mounted while a scope is set reads out of scope until the scope next changes
- where: packages/labkit/src/surface/useSurfaceTile.ts:83 (useTileInScope); packages/labkit/src/surface/tiledSurface.ts:177 (inScope), :143 (placeTile)
- scenario: a scope is set (a trial is presented or a lightbox is open), and an annotation overlay mounts inside the scoped element. `inScope(tileId)` returns false while the tile is not yet in `tiles` (`tile !== undefined && …`). `AnnotationOverlay` calls `useTileInScope` before `useOverlayTile`, and `useOverlayTile` registers in a passive effect. So useSyncExternalStore's post-commit snapshot check runs before the registration and sees false. `placeTile` emits nothing on `scopeChanged`, so the snapshot stays false and the overlay's box stays hidden, although its tile is in scope and painted. The same happens when the tile's element is swapped or dropped while the tenant stays mounted. When the tile set of a scoped surface changes, `placeTile` should notify the scope listeners.
- evidence: read
- severity: medium

## A painter that throws drops every later painter and all post-commit callbacks of the frame, and those tiles are never repainted
- where: packages/labkit/src/surface/tiledSurface.ts:43 (paintTiles), :258–261 (deliver)
- scenario: one tenant's painter throws, for example on a GL context lost mid-frame. `deliver` has already cleared `dirty`, and the throw escapes `flushSync` mid-loop. The painters after it in `painting` never run, and neither does the `after` list. Nothing re-dirties those tiles, so they keep stale or blank pixels until something unrelated invalidates them; on a retiled frame the clears have already erased them. Each painter should be isolated, or the unpainted ids returned to `dirty`.
- evidence: read
- severity: low

## The surface reads `devicePixelRatio` from the global window while measuring and listening in the container's own document
- where: packages/labkit/src/surface/tiledSurface.ts:198 (step); packages/labkit/src/surface/useTiledSurface.ts:155 (watchDevicePixelRatio), against :108 (onAnyScroll(el.ownerDocument))
- scenario: a lab's container is portaled into a second window, such as a popout on another display. Its scroll listener goes on that window's document, but `frame.dpr` comes from `globalThis.devicePixelRatio` and the density watch from the opener's `matchMedia`. With a 1x opener and a 2x popout, `toDeviceRect` snaps to the wrong grid and owners size the buffer at half resolution. Moving the popout between displays fires no re-measure. It should read `el.ownerDocument.defaultView.devicePixelRatio` and watch that view.
- evidence: read
- severity: low

## clipToAncestors stops at a shadow root, so a tile inside a shadow tree ignores every clipping ancestor outside it
- where: packages/labkit/src/surface/clip.ts:53 (clipToAncestors)
- scenario: a tile element is rendered inside a shadow root, for example a web-component host inside a scrolling pane. The walk uses `parentElement`, which is null at the shadow root, so the host and its scrolling ancestors are never checked. `visible` reports the whole tile box although the pane clips it, and the tile draws and takes input outside its pane. At a ShadowRoot the walk should continue from its `host`.
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

<!-- done: 5 findings, files read: 11 -->
