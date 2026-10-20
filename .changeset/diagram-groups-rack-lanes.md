---
"@weasel-js/diagram": patch
---

Groups now work under the `rack` and `lanes` looks. Layouts that have groups change: the `chain`
layout keeps each group's members together and moves stages outside a group out of its columns,
and the `lanes` look gives each group columns of its own. `EffectEditor` reorders a group by
dragging its title and renames it by double-clicking the title under both looks, moves a run of
stages along the chain as one, and refuses a stage drop that would split a group. In
`ReorderItem`, `grip` accepts `null` for an item that has gaps but can't be picked up, and a
`'bar'` drag now moves everything an item `carries`.
