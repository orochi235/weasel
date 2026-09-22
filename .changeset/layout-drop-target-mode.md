---
'@weasel-js/core': patch
---

Choose which layout container a drag lands in when several contain the drop point. `<SceneCanvas layoutDropTarget>` takes `'innermost'` (the default, and the behavior until now: the deepest container, ties to the one painted later), `'topmost'` (the container painted last, in the scene's render order across the whole tree) or `'region'` (only containers that declare a drop region). A layout strategy declares one with the new optional `dropRegion(container)`, returning a `Path` or a predicate in the container's local frame; a declared region replaces the container body as its hit area in every mode, and may reach past it. The drag-time reflow preview and the commit follow the same choice. New types: `LayoutDropTargetMode`, `DropRegion`.
