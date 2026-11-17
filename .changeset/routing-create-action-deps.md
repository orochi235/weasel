---
'@weasel-js/routing': major
'@weasel-js/core': major
---

The function that builds the deps bag an action declares is `createActionDeps`.

`buildDepsFromRequires` (routing, re-exported by core) is renamed `createActionDeps`; its arguments are unchanged.

```ts
// before
const deps = buildDepsFromRequires(action, registry);
// after
const deps = createActionDeps(action, registry);
```

<!-- entry: breaking api -->
