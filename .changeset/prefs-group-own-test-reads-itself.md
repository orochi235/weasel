---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

A group's own `from: 'group'` test reads a leaf in that group, so a mounted feature group can carry its own switch.

The resolver, `checkPrefConditions`, the schema editor's marks, `conditionGroupAt`, and `rebaseValuePaths` all read it that way. A group whose own test meant a leaf beside the group now names it from the root:

```ts
// before: read view.on
pref.group('Feature', { on, axis }, { enableIf: { from: 'group', path: 'on' } }); // mounted at view.feature
// now that reads view.feature.on; for view.on write
pref.group('Feature', { on, axis }, { enableIf: { path: 'view.on' } });
```

<!-- entry: breaking fix -->
