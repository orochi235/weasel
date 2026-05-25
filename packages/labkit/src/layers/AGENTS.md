# Layers — Agent Guide

The `src/layers/` directory implements the `<LayerList>` UI used by the `layers` instrument capability.

## Files

| File | Role |
|---|---|
| `LayerList.tsx` | Layer toggle/reorder list (sidebar widget) |
| `LayerList.less` | Row styling, drag handle, pinned-row variant |

## Props

```ts
interface LayerListProps {
  layers: LayerDescriptor[];                    // { id, label, alwaysOn? }
  visibility: Record<string, boolean>;          // missing key → visible
  onReorder: (newOrder: LayerDescriptor[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  className?: string;
}
```

`LayerDescriptor` lives in `src/instrument/types.ts`.

## How it integrates

The instrument declares layer ids:

```ts
layers: { ids: ['grid', 'plants'] }
```

`Workspace.tsx` converts each id into a `LayerDescriptor` (with `label === id` by default) and tracks `visibility` and a derived `layerOrder` in local state. The order produced by `onReorder` is then applied to `instrument.canvas.layers` before they're passed to `<CanvasStack>`.

There is no transitive coupling between `layers.ids` and `canvas.layers[].id` — the workspace assumes the ids match. If you declare a layer in `canvas` that isn't in `layers.ids`, it stays in default order and is always visible.

## `alwaysOn` semantics

Setting `alwaysOn: true` on a `LayerDescriptor` does two things:

1. The row renders with a 🔒 badge instead of a drag handle and visibility checkbox.
2. The row is excluded from reorder operations — pinned rows always sort to the bottom of the rendered list.

This is intended for legend/HUD layers that should never be toggled off. Visibility for pinned rows is **not** read from the `visibility` prop; they always render.

## Drag handle customization

The drag handle is a button with text content `⋮⋮` and class `lk-layer-list__handle`. Its row height is hardcoded to `28px` for delta computation (`moveDrag` in `LayerList.tsx`). If you change row height in CSS, update the `rowHeight` constant to match.

Pointer capture is acquired on `pointerdown` and released on `pointerup`, so dragging works across the document without requiring window-level listeners.

## Empty state

If `layers.length === 0`, renders `.lk-layer-list__empty` with the text "No layers". Workspace already guards this case (`layerDescriptors.length > 0`) so the empty state is rare in practice.

## When to fork

Fork this component if you need:
- Multi-select reorder (current implementation is single-row)
- Right-click context menu
- Layer groups or nesting
- Solo/mute UI common in DAW-style apps

The implementation is small (~100 lines) and self-contained — only depends on `LayerDescriptor` from instrument types.
