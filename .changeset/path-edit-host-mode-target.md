---
'@weasel-js/path-tools': minor
---

`createPathEditHost` can take the open path from a mode machine, and can leave out nodes with no anchors to edit.

`target: { get, open, close }` reads the open path from the machine's path-edit mode and enters and leaves that mode through it, instead of the host holding an id of its own. `editable: (id) => boolean` names no path while the open one fails it; the default allows every id.

<!-- entry: api -->
