---
'@weasel-js/react': minor
---

`useLatestOnly` gives a component a `createLatest` that is dropped when it unmounts, so a late async answer neither overwrites a newer one nor lands on a component that is gone.

<!-- entry: api -->
