---
"@weasel-js/svg": patch
---

`svgNodesToKitDrafts` takes an `options.leaf` hook and hands `nextId` the node each id is for, so an app whose leaf data is shaped differently, or that keeps ids or metadata the document carries, can reuse the walk instead of copying it. `leaf(id, { pose, data }, source)` receives the kit data the default would have written — opacity folded in, gradients rebased — and returns the app's own, or `null` to leave the leaf out; a group left with nothing is dropped like an empty one. `SvgSceneDraft` is generic over the leaf data, and `SvgLeafNode` and `SvgNodesToKitDraftsOptions` are exported. A container's pose no longer inherits its only child's rotation.
