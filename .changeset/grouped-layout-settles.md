---
'@weasel-js/diagram': patch
---

`layered` (under the default `'seeded'` order) and `tree` now return an arrangement a second run keeps when the graph has groups. A group that pushed an outsider out of its column changed the order the next run read, so a re-run moved nodes again. New export `untilSettled` runs a layout until a pass moves nothing.
