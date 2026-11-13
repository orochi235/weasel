---
'@weasel-js/prefs': major
---

A prefs store keeps which leaves are auto: a leaf starts auto only where it says `auto.on`, and reads its `auto.value` while auto.

`store.auto()`, `store.isAuto(path)` and `store.setAuto(path, next)` are new, and `store.reset(path)` puts a leaf back as its schema says: auto where it says `auto.on`. `usePrefsValues(store).form` binds `auto` to `store.auto()`, `onAutoChange` to `store.setAuto` and the new `onReset` to `store.reset`, so a leaf with nothing stored no longer shows as auto unless its schema starts it so.

```ts
// Before: every unset leaf read as auto in a store-bound form
const gap = { kind: 'number', name: 'Gap', description: '', default: 4 };

// After: say so to start auto, or unpin any leaf that can be auto
const gap = { kind: 'number', name: 'Gap', description: '', default: 4, auto: { on: true } };
store.setAuto('gap', true);
```

<!-- entry: rank=10 breaking behavior api -->
