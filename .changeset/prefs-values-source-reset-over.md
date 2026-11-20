---
'@weasel-js/prefs': minor
---

An alias row's Reset in a form drawn over another schema puts the aliased setting back, where it did nothing.

A source may name the schema its aliases point into as `PrefsSource.over`; `createValuesSource` sets it from its `over` option, and `sourceResetPlan` and `sourceIsAtReset` find a path there that `schema` lacks.

<!-- entry: fix api -->
