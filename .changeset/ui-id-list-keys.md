---
'@weasel-js/ui': patch
---

The selection panel, `useScrollSpy`, and Along's item lengths notice a list of ids changing to one that joins to the same text. A leaf renderer's `ctx.selectionKey` is now `compositeKey` of the ids rather than the ids joined by commas; it is still only an identity to key on.

<!-- entry: fix -->
