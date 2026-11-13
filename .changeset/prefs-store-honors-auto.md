---
'@weasel-js/prefs': major
---

A prefs store keeps which leaves are auto: only one whose schema declares `auto`, reading its `auto.value` while auto, never its default.

`store.auto()`, `store.isAuto(path)` and `store.setAuto(path, next)` are new, and `store.reset(path)` puts a leaf back as its schema says: auto where it says `auto.on`, else at its default. A leaf that opts in with no `auto.value` reads `undefined` while auto. `usePrefsValues(store).form` binds `auto` to `store.auto()`, `onAutoChange` to `store.setAuto` and the new `onReset` to `store.reset`, so a leaf with nothing stored no longer shows as auto, and a leaf that declares no `auto` offers no Auto toggle. A stored auto mark for a leaf that declares no `auto` reads as nothing stored.

```ts
// Before: every unset leaf read as auto in a store-bound form
const gap = { kind: 'number', name: 'Gap', description: '', default: 4 };

// After: a leaf opts in to be auto at all, and says what it reads while auto
const gap = { kind: 'number', name: 'Gap', description: '', default: 4, auto: { on: true, value: 8 } };
store.setAuto('gap', true);
```

<!-- entry: rank=10 breaking behavior api -->
