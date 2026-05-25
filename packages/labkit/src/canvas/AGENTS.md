# Canvas — Agent Guide

The `src/canvas/` directory implements the layered canvas primitive used by the `canvas` instrument capability.

## Files

| File | Role |
|---|---|
| `CanvasStack.tsx` | Layered `<canvas>` container; owns sizing, pan/zoom handlers, and per-layer canvas refs |
| `CanvasStackContext.ts` | React context exposing the current `view` to descendants |
| `useLayerScheduler.ts` | DPR-aware rAF scheduler; redraws dirty layers on view/state changes |
| `usePanZoom.ts` | Pointer + wheel handlers that mutate `view` via `onViewChange` |
| `canvasCoords.ts` | Pure `screenToWorld` / `worldToScreen` helpers |
| `CanvasStack.less` | Container + canvas + overlay positioning |

## Props (`<CanvasStack>`)

```ts
interface CanvasStackProps {
  layers: CanvasLayerDescriptor[];      // { id, visible, render(ctx, view) }
  view: ViewTransform;                  // { zoom, pan: { x, y } }
  onViewChange: (v: ViewTransform) => void;
  width?: number | string;              // default '100%'
  height?: number | string;             // default '100%'
  className?: string;
  onHitTest?: (worldPos: Point) => void;  // fired on tap (no drag)
  children?: ReactNode;                 // rendered into the overlay layer
}
```

## How rendering works

1. The container measures itself with `ResizeObserver` and reports `{width, height, dpr}`.
2. `useLayerScheduler` watches `layers`, `view`, and `size`, and on any change schedules a single `requestAnimationFrame` redraw.
3. Each layer's `render(ctx, view)` is called with a fresh transform: the canvas is sized to `width * dpr × height * dpr` so coordinates are in CSS pixels.
4. Layers with `visible: false` are skipped and their canvas is `display: none` (DOM is preserved to avoid remounts).

## Adding a new layer type

A layer is defined by the instrument's `canvas.layers[]` (type `CanvasLayer`), then translated to a `CanvasLayerDescriptor` inside `Workspace.tsx` before being passed to `<CanvasStack>`. To add a layer, push it into `instrument.canvas.layers`:

```ts
canvas: {
  layers: [
    {
      id: 'grid',
      draw: (ctx, { state, config, zoom }) => { /* ... */ },
    },
  ],
}
```

Layer order in the array = paint order (first drawn = bottom).

## Overlay (children)

The `children` prop renders in `.lk-canvas-stack__overlay`, which is `position: absolute; inset: 0; pointer-events: none`. Direct children re-enable pointer events. Use this for HUDs, scale indicators, or interactive overlays that don't belong in a canvas layer.

## Coordinate conversions

- `screenToWorld({x, y}, view)` → world coords given a CSS-pixel offset relative to the container's top-left
- `worldToScreen({x, y}, view)` → inverse

Both are pure. Pan is applied in screen space; zoom multiplies world coordinates.

## Pan/zoom behavior

Implemented in `usePanZoom`. Mouse-wheel zoom is anchored at the cursor; primary-button drag pans. `isDragging()` is exposed so consumers can suppress click handlers during a pan.

## Testing notes

JSDOM does not provide a real `CanvasRenderingContext2D`. Tests in `CanvasStack.test.tsx` rely on the scheduler's defensive checks; they do not assert pixels. For pixel testing, use Storybook's `chromatic` or visual snapshots in a real browser.
