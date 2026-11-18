---
'@weasel-js/prefs-schema': minor
'@weasel-js/prefs': minor
'@weasel-js/prefs-editor': minor
'@weasel-js/routing': minor
'@weasel-js/labkit': minor
---

A condition test can read its path from the group its node is declared in, so a settings group mounts anywhere.

```ts
axis: pref.enum('Axis', 'x', ['x', 'y'], { enableIf: { from: 'group', path: 'on' } }), // reads <group>.on
```

`applyPrefConditions`, `prefStatusAt`, `checkPrefConditions`, settings menus and labkit's `configFromPrefs` resolve these tests themselves. Code that evaluates a schema's conditions any other way resolves them first with `resolvePrefGroupConditions(schema)`, or `prefConditionInGroup(condition, group)` for one condition; one that reaches a reader unresolved warns. `checkPrefCondition` checks one against `site.group`, which the schema editor's marks and `PrefConditionEditor`'s new `group` prop supply (`conditionGroupAt` finds it).

<!-- entry: api -->
