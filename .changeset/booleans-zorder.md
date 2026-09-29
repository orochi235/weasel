---
"@weasel-js/core": patch
---

A boolean op's result takes its topmost source's slot among that source's siblings, read through the reorder contract. `BooleansAdapter` gains optional `getParent`, `getChildren` and `setChildOrder` — `defaultCommitAdapter(scene)` supplies all three — and the kit derives each source's sibling index from them, the same read Create Outlines uses. `createPathNode` now receives a third argument, the topmost source's id: give the new node that source's parent. `getZOrder` still works as an override but is deprecated; an implementation returning a render-order index (as WeaselDraw's did) put results in the wrong slot inside a container. `getSelection` may return `string[]`. Additive.
