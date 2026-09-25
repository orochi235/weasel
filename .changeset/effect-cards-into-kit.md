---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`EffectCard` and `EffectCardList` are removed; a reorderable list of toned,
collapsible sections is `LayerStack`, now built from kit parts.

- `PropertyGroup` takes `leading` and `actions`, which share its title row, and
  a toned group draws its leading edge in its tone.
- `PropertyList` forwards its ref, so its groups can reorder with
  `useReorderDragList`, whose row handler may now sit on a handle inside the row.
- `LayerStack` renders each card as a `PropertyGroup` in a `PropertyList`, with
  the kit's `Select` for a hoisted primary value and a ghost during a drag. Its
  items take `tone` where they took `accent`, which is a breaking change for any
  caller passing `accent`.
- `DragGhost` is the pointer-following copy on its own, which `ItemList` and
  `LayerStack` both use.
