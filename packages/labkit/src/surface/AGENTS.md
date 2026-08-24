# Surface — Agent Guide

`src/surface/` lets a lab drive a renderer labkit does not own. labkit publishes
rects, dirtiness, DPR and one rAF; the consumer keeps the GL.

Use this rather than the `canvas` capability when the renderer is not labkit's —
three.js, a raw WebGL context, anything with its own render loop. One canvas per
trial is one WebGL context per trial, and browsers cap those around 8–16, so more
than a few 3D tiles have to share one surface.

## Files

| File | Role |
|---|---|
| `rect.ts` | The `Rect` and `Box` types |
| `composeRects.ts` | Tile boxes into surface-relative rects; both are viewport-relative, so it is a subtraction |
| `deviceRect.ts` | `toDeviceRect` — y-flip and device-grid snapping for a GL viewport |
| `useTiledSurface.ts` | ResizeObserver, dirty set, rAF coalescing, DPR |
| `SurfaceContext.ts` | Carries the handle down |
| `useSurfaceTile.ts` | `useSurfaceTile(id)`, `useSurface()`, `useSurfaceOptional()` |

## Shape of a consumer

```tsx
const surface = useTiledSurface({
  onFrame: ({ dirty, rects, dpr, size }) => {
    renderer.setPixelRatio(Math.min(dpr, 2));
    renderer.setSize(size.width, size.height, false);
    for (const id of dirty) {
      const rect = rects.get(id);
      if (!rect) continue;
      const v = toDeviceRect(rect, size.height, dpr);
      // ... setViewport / setScissor / render
    }
  },
});
```

`onFrame` carries **every** tile's rect, not only the dirty ones — a scissored
draw has to know where it is drawing relative to a surface that may have resized
under it.

## The unit is a rect, not a trial

`useSurfaceTile(id)` attaches to whatever element the surface should draw into. A
trial may register one, or none: a trial holding a drawn pane beside an undrawn
one contributes a single rect, and a trial with nothing to draw contributes none.

## Traps

- **`preserveDrawingBuffer` is the consumer's job and is usually required.** A
  partial redraw touches one tile; without it the default framebuffer's contents
  are undefined after the page composites, and every other tile goes black.
- **Gutters lie outside every scissor.** Clear the whole surface when the tile set
  changes, or a re-tile strands the old tiles' pixels between the new ones.
- **A tile that moves without resizing** is already handled: `Workspace`
  invalidates rects off the grid's own `node.placementChanged`. A host that moves
  something the grid does not know about calls `invalidateRects()` itself.

## Testing

No WebGL in the suite. The arithmetic is pure and tested directly; the hook is
tested with `getBoundingClientRect` stubbed per element, because jsdom measures
everything as zero.
