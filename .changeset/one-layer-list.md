---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`LayerStack`, labkit's `LayerList` and WeaselDraw's `LayerList` are one
component: `LayerList` in `@weasel-js/ui`. This is a breaking change for callers
of either old component.

- A layer is a one-line row, or a card when `renderBody` returns something for
  it, and either can hold `children`. Selection (`selectedIds`/`onSelect`,
  shift-click to add, drag a selected row to move its selected siblings),
  a visibility checkbox (`onVisibilityChange`), a remove button (`onRemove`)
  and an add palette (`addKinds`/`onAdd`) each turn on with their handler.
- `onReorder` receives a `LayerMove` — `{ ids, parentId, index }` — instead of
  a list of ids or a new tree. `moveLayers(items, move)` applies one to a tree
  held as state.
- Items take string ids, and `title` in place of `LayerStack`'s hoisted
  `primaryValue`/`primaryOptions`/`onPrimaryChange`; put the select in `title`.
  `defaultExpanded: false` is `defaultCollapsed: true`, and `alwaysOn` is
  `locked`.
- `useSceneLayerList` puts a scene in the list: a container's children nest
  under it, and a drag dispatches a `MoveToIndexOp` under the right parent.
- `useReorderDragList`'s item type is `ReorderItem`, without `swatch`.
- labkit drops the `./ui/layers` entry point; `./layers` re-exports the ui
  component. A trial's layer list now shows the order its canvas draws in,
  where it used to snap back after a drag.
