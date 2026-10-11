---
'@weasel-js/core': patch
---

An `arrayAdapter` configured with `getChildren` put an undone delete in the wrong place whenever a child sat earlier in the item array than the roots: with items `[kid, p, a, b]`, deleting root `a` and undoing gave roots `[a, p, b]`. `insertNode` treated the sibling ordinal the insert op hands it as an index into the flat array. It now inserts before the sibling that ordinal names.
