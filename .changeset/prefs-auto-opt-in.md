---
'@weasel-js/prefs': major
---

A leaf is auto only where its schema declares `auto`, so `auto: false` is gone: a leaf without `auto` is always pinned.

```ts
// Before
const grid = { kind: 'boolean', name: 'Grid', description: '', default: true, auto: false };

// After
const grid = { kind: 'boolean', name: 'Grid', description: '', default: true };
// and a leaf that may be auto says so, with neither field if it needs none
const size = { kind: 'number', name: 'Size', description: '', default: 10, auto: {} };
```

<!-- entry: rank=10 breaking api behavior -->
