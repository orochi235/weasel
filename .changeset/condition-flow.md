---
'@weasel-js/ui': patch
---

`prefConditionFlow(condition, schema)` turns a `PrefCondition` into a flow of boxes, paths, and groups, in the plain shape `diagramScene` from `@weasel-js/diagram` takes, so a `showIf` or an `enableIf` can be drawn as a diagram. The condition holds where a path runs from the first box to the last through tests that hold: the parts of an `all` stand in a line, the parts of an `any` side by side, and a `not` is a group round what it wraps. Each test's box names its pref and says its comparisons in the words `PrefConditionEditor`'s rows use.
