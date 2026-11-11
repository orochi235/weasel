---
"@weasel-js/core": patch
---

A group's members keep their own layers when `reconcileSpecs` moves the group to another layer.

A member whose spec layer did not change stays on it wherever the group's new layer allows, so the render worker's copy of a scene draws it where the page does after an undo.

<!-- entry: fix visual -->
