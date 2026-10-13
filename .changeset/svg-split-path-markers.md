---
'@weasel-js/svg': patch
---

`serializeSvg` writes the start and end markers of a path under `openFill: 'none'` where the renderer draws them: one pair on each open subpath. A stroke with either marker is written one open subpath to a `<path>`, and the `<path>` holding the closed subpaths carries neither. Before, a path mixing closed and open subpaths got a pair on its closed half too, and several open subpaths shared one pair. A stroke with no start or end marker is written as before.
