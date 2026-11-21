---
'@weasel-js/theme': minor
---

`axisDependencies`, `bake`, `mergeChain`, and `declaredSteps` read a ramp's or scale's steps as `derive` does.

A `{seeds.name}` in `steps` names the step its seed gives, and a step list `derive` refuses gives no steps. `declaredSteps(entry, definition)` takes the definition the entry belongs to, for its axes and seeds; without it, the axes are the ones the entry's own `by`s name and no seed resolves.

<!-- entry: fix api -->
