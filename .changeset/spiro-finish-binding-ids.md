---
'@weasel-js/path-tools': major
---

The Spiro tool's finishing bindings are named `spiro.finish.click`, `spiro.finish.doubleClick`, and `spiro.finish.key`.

They now follow the `<owner>.<role>` pattern every kit binding does.

A stored binding override names them by the new ids:

```ts
// Before
registry.overrideBindings({ 'spiro.finishKey': key('Mod+Enter') });
// After
registry.overrideBindings({ 'spiro.finish.key': key('Mod+Enter') });
```

<!-- entry: breaking -->
