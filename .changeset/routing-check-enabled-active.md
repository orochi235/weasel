---
'@weasel-js/routing': major
'@weasel-js/core': major
---

The helpers that run an action's `enabled` and `active` predicates safely are `checkEnabled` and `checkActive`.

`evaluateEnabled` and `evaluateActive` (routing, re-exported by core) are renamed `checkEnabled` and `checkActive`; their arguments and results are unchanged.

```ts
// before
const enabled = evaluateEnabled(action, deps);
// after
const enabled = checkEnabled(action, deps);
```

<!-- entry: breaking api -->
