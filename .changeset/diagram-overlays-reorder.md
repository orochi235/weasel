---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
'@weasel-js/react': patch
'@weasel-js/prefs': patch
---

`DiagramView` can hold DOM against its nodes, groups and edges, report what the pointer is over, and let a group's members be dragged into a new order. All three are additive.

- `overlays` places each `DiagramOverlay` against its target after every paint: centered on it, or beside it through geom's `placeRect`, flipping inside the view. An edge's place is the midpoint along its route. The view now renders a box around its canvas to hold them, and `className` goes on that box rather than on the canvas.
- `onHover` reports the node, group or edge under the pointer; `pickEdges` lets a click or a hover land on an edge whatever editing callbacks are set. `rectOf(id)` and `subscribeFrame` on the ref give a target's client rect and when to read it again.
- A `DataGroup` with `reorder: 'x' | 'y'` lets `onReorder` drag any member along that axis, carrying everything inside a member that is a group, or step the picked one with Alt and an arrow key. It reports `{ group, order }` and moves nothing. `layered` keeps such a group's members in the order given across every rank instead of sorting them by crossings. `createReorderAction`, `createStepReorderAction`, `reorderBindings` and `reorderContribution` are exported for use outside `DiagramView`.

`SceneCanvas` takes `onHover`, called when the topmost pickable node under the pointer changes. `@weasel-js/react` exports `adoptCss`, `adoptCssOnce` and `styleRootOf`, the stylesheet adoption core's canvas and `KitSettingsFromPrefs` now share.
