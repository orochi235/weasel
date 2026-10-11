---
'@weasel-js/core': patch
---

A drag of several nodes under `snapToContainer` previews each node in the slot it will land in; the others used to ride along with the first and jump on release. A move behavior can now return `poses`, a preview pose per dragged id, from `onMove`.
