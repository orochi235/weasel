---
'@weasel-js/prefs-schema': minor
'@weasel-js/prefs': minor
---

A condition test can read its path from the group its node is declared in, so a settings group mounts anywhere.

```ts
axis: pref.enum('Axis', 'x', ['x', 'y'], { enableIf: { from: 'group', path: 'on' } }), // reads <group>.on
```

`applyPrefConditions`, `prefStatusAt` and `checkPrefConditions` resolve these tests themselves. Code that evaluates a schema's conditions any other way resolves them first with `resolvePrefGroupConditions(schema)`, or `prefConditionInGroup(condition, group)` for one condition.

<!-- entry: api -->
