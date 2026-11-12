---
'@weasel-js/labkit': minor
---

A job capability takes `begin`, the state each run folds its items into, so a rerun need not add its items to the last run's.

An `auto` job runs again whenever its trial mounts, a reloaded one included.

```ts
job: {
  auto: true,
  run: ({ signal }) => sweep(signal),
  onItem: (item, state) => ({ ...state, samples: [...state.samples, item] }),
  begin: (state) => ({ ...state, samples: [] }),
}
```

<!-- entry: api -->
