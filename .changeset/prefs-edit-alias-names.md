---
'@weasel-js/prefs': major
---

`@weasel-js/prefs/edit` names its alias helpers for aliases rather than pointers. `pointerTarget` is `aliasTargetIn`, `pointerAttributes` is `aliasAttributes`, `POINTER_ATTRS` is `ALIAS_ATTRS`, `deadPointers` is `deadAliases`, `pointable` is `isAliasable`, `pointersTo` is `aliasesTo` and `pointedAt` is `aliasedPaths`.

```ts
// before
const dead = deadPointers(layout, settings);
const target = pointerTarget(settings, alias);
// after
const dead = deadAliases(layout, settings);
const target = aliasTargetIn(settings, alias);
```

<!-- entry: breaking api -->
