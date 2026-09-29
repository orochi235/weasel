---
"@weasel-js/core": patch
---

A scene that has never had a layout now arranges a container as soon as it is given one, whichever way the layout arrives: a `createSetLayoutOp` run through `applyBatch` (or `scene.history.apply` / a journal), and a `scene.setLayout` call inside `scene.batch` or `scene.untracked`, each lay the children out in the same undo step, as a bare `scene.setLayout` call already did. Before, they set the layout and left the children where they were until the container's next change. Undo, redo and a restored history replay the arrangement. A bug fix; no API changes.
