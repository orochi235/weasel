---
'@weasel-js/registry': minor
'@weasel-js/core': minor
---

`createExtensionRegistry` makes a registry whose conflicts throw unless the call asks to replace, and which can fall back to a parent.

The same value again is no change, a different one throws `ExtensionConflictError` unless the call passes `replace: true`, and each registration returns its release. Op factories and shader sources are built on it. Core re-exports it.

```ts
const shared = createExtensionRegistry<Widget>({ kind: 'widget' });
const mine = createExtensionRegistry<Widget>({ kind: 'widget', parent: shared });
const release = mine.register('dial', dial);
mine.register('dial', other);                    // throws ExtensionConflictError
mine.register('dial', other, { replace: true }); // replaces; `release` now does nothing
```

<!-- entry: rank=5 new api -->
