---
'@weasel-js/core': minor
---

`transformSelection(deps, transform, label)` moves, rotates or resizes the selection as one undo step that Transform Again repeats.

`transform` is a `SelectionTransform`: a `RepeatableTransform` other than a duplicate, such as `{ kind: 'translate', dx, dy }` or `{ kind: 'rotate', angle, pivot: 'union' }`. The batch is finished by the `transformFollowers` dep, as a drag's is. It returns whether anything changed.

<!-- entry: api -->
