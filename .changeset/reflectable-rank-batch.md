---
'@weasel-js/registry': minor
---

`createReflectable`'s `push` takes a `rank`, its `set` returns a release, and its new `batch` announces several changes as one.

A registrant pushed with `rank` stacks under every higher-ranked one, so an override tier stays live over registrants that arrive after it; the reflection reports each registrant's `rank`. The release `set` returns removes that registrant and does nothing once a later `set` replaced it. `batch(fn)` runs `fn` and announces what it changed as one version step and one notification.

```ts
store.push('app:save', glyph, { rank: 1, source: 'override' });
const release = store.set(runId, handle);
store.batch(() => { for (const [k, v] of rows) store.push(k, v); });
```

<!-- entry: api -->
