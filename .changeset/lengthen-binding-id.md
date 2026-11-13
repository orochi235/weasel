---
'@weasel-js/path-tools': major
---

The lengthen tool's drag binding id is `lengthen.drag`, named for the tool that owns it as every other tool binding is.

A saved binding override keyed `lengthenPath.drag` moves to the new id:

```ts
// before
bindingOverrides={{ 'lengthenPath.drag': unbound() }}
// after
bindingOverrides={{ 'lengthen.drag': unbound() }}
```

<!-- entry: breaking data -->
