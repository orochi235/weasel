# Layers — Agent Guide

`src/layers/` re-exports `<LayerList>` from `@weasel-js/ui`, along with the
`layers` capability types. The component itself — rows, cards, nesting,
selection, visibility, reorder — is documented at its source in
`packages/ui/src/components/LayerList/`.

## How the capability uses it

The instrument declares layer ids:

```ts
layers: { ids: ['grid', 'plants'] }
```

`Trial.tsx` turns each id into a `LayerDescriptor` (`label === id` unless the
entry is a descriptor), keeps `visibility` and `layerOrder` in local state, and
builds the list's items from them in the order the canvas draws. The order a
drag produces is applied to `instrument.canvas.layers` before they reach
`<CanvasStack>`, and each toggle and reorder emits `layers.toggle` /
`layers.reorder` on the bus.

`layers.ids` and `canvas.layers[].id` are assumed to match. A canvas layer not
in `layers.ids` keeps its default order and is always visible.

## `alwaysOn`

A descriptor with `alwaysOn: true` becomes a `locked` item, pinned below the
rest: it shows a lock in place of the grip and has no visibility checkbox,
cannot be dragged, and no drag can cross it. It always renders, whatever
`visibility` says. Intended for legend and HUD layers.
