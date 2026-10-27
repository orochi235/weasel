---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A "may this land here?" check can now refuse with a reason. `DropVerdict` is `true`, `false` (a
silent no), or `{ refuse: string }`; over a refusal the canvas outlines the target in the
`refused` overlay role and shows the reason beside the pointer, and a release there does nothing.

- **Breaking:** `CanConnect` returns a `DropVerdict` rather than a `boolean`, and so does core's
  `CanDropIntoDep`. A function returning a boolean still fits; code that calls one and treats the
  answer as a boolean must test for `true`.
- `DiagramView` takes `canReparent(ids, container)`, asked before a drag moves nodes into a
  container or lane they are not in.
- A `DataContainer` takes `reorder: 'x' | 'y'`: `onReorder` drags its members along that axis and
  Alt with an arrow key steps the selected one, as a group's. **Breaking:** `ReorderChange` names
  the group or container as `parent`, in place of `group`.
- `DiagramView` takes `onDropItem` and `canDropItem` for items carried in from a list outside the
  canvas, made a source with `dragItemProps(item)`. The report gives the item, what it landed on,
  the container that would hold it, and its index among that container's members.
- `DiagramViewApi.rectOf` and overlays place a container's members in the world rather than in
  the container's frame, and a stencil drawn into a nested container finds it.
- Core: move behaviors can publish overlays, routing has a `reason` overlay that `SceneCanvas`
  shows beside the pointer, and a `target` overlay role outlines what a drag would drop into.
