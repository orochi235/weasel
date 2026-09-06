# Layers — Agent Guide

The `src/layers/` directory implements the `<LayerList>` UI used by the `layers` instrument capability.

## Files

| File | Role |
|---|---|
| `LayerList.tsx` | Layer toggle/reorder list, flat or nested (sidebar widget) |
| `LayerList.less` | Row styling, drag handle, pinned-row variant, subtree indent |
| `LayerList.stories.tsx` | Flat and nested renderings |

## Props

```ts
interface LayerListProps {
  layers: LayerTreeNode[];                      // LayerDescriptor + { children?, defaultCollapsed? }
  visibility: Record<string, boolean>;          // missing key → visible
  onReorder: (newOrder: LayerTreeNode[]) => void;
  onToggle: (id: string, visible: boolean) => void;
  collapsedIds?: readonly string[];             // supplying it makes collapse controlled
  onCollapsedChange?: (ids: string[]) => void;
  className?: string;
}
```

`LayerDescriptor` lives in `src/instrument/types.ts`; `LayerTreeNode` extends it
in `LayerList.tsx`, so a plain `LayerDescriptor[]` is still a valid `layers`.

## How it integrates

The instrument declares layer ids:

```ts
layers: { ids: ['grid', 'plants'] }
```

`Trial.tsx` converts each id into a `LayerDescriptor` (with `label === id` by default) and tracks `visibility` and a derived `layerOrder` in local state. The order produced by `onReorder` is then applied to `instrument.canvas.layers` before they're passed to `<CanvasStack>`.

There is no transitive coupling between `layers.ids` and `canvas.layers[].id` — the trial assumes the ids match. If you declare a layer in `canvas` that isn't in `layers.ids`, it stays in default order and is always visible.

## `alwaysOn` semantics

Setting `alwaysOn: true` on a `LayerDescriptor` does two things:

1. The row renders with a 🔒 badge instead of a drag handle and visibility checkbox.
2. The row is excluded from reorder operations — pinned rows always sort to the bottom of the rendered list.

This is intended for legend/HUD layers that should never be toggled off. Visibility for pinned rows is **not** read from the `visibility` prop; they always render.

## Nesting

A node with `children` renders an expandable subtree. The expand control is
`<Disclosure>` from `@weasel-js/ui` — the same twisty every other collapsible
surface uses.

Reordering is scoped to siblings: a drag moves a row within its own parent's
child list and never reparents it. `onReorder` still receives the whole tree,
with only that sibling group's order changed.

The twisty column appears only when some node in the tree has children — a flat
list renders exactly the rows it always did. Within a tree, childless rows get
`.lk-layer-list__twisty-gap` so labels stay aligned down a level.

Collapse is uncontrolled by default, seeded once from each node's
`defaultCollapsed`. Pass `collapsedIds` to own it; `onCollapsedChange` fires
either way.

## Drag handle customization

The drag handle is a button with class `lk-layer-list__handle` holding `<DragHandleGlyph>` (from `@weasel-js/ui`), the same grip `LayerStack` uses. Its padding is transparent and cancelled by an equal negative margin, so the grab target is larger than the drawn dots without widening the row. Row pitch — height plus row gap — is measured from the DOM when a drag starts, so restyling the row does not skew drag distance. It used to be a hardcoded `28`, which had already drifted from the rendered height by the time it was found.

Pointer capture is acquired on `pointerdown` and released on `pointerup`, so dragging works across the document without requiring window-level listeners.

## Empty state

If `layers.length === 0`, renders `.lk-layer-list__empty` with the text "No layers". Trial already guards this case (`layerDescriptors.length > 0`) so the empty state is rare in practice.

## When to fork

Fork this component if you need:
- Multi-select reorder (current implementation is single-row)
- Right-click context menu
- Reparenting by drag (nesting renders, but a drag stays within one parent)
- Solo/mute UI common in DAW-style apps

It is self-contained: `LayerDescriptor` from instrument types and `Disclosure`/`DragHandleGlyph` from `@weasel-js/ui`.
