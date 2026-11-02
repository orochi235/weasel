---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

`sectionTree` now judges `enableIf` against the config, as it already did `showIf`. A form drawing its renested
tree used to judge `enableIf` against the renested values, where a condition naming a config path
(`{ path: 'orbs.commitOrbs' }`) finds nothing, so the row was drawn disabled whatever the config held; and an
`enableIf` written as a function was never asked at all. The same went for the conditions on an object's, a
union's or a list item's fields. `SectionTree` gains `disabled`, the rail paths of every leaf, group and field an
`enableIf` disables, and the tree it returns carries no condition but those that read a list's or a map's entry,
with every other test in them already answered; a field a `showIf` hides is cut from its leaf.

`PrefsForm` (and so `PrefsDialog`) takes a new `disabled` prop: dotted paths of leaves, groups and fields to draw
disabled on top of what the schema's own conditions disable, named as `applyPrefConditions` names them. Pass
`sectionTree`'s `disabled` there.
