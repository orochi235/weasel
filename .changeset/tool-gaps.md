---
'@weasel-js/routing': minor
'@weasel-js/core': minor
---

`toolGaps(tool)` lists what a tool's definition leaves out, for a test that every tool a package ships is complete.

It names a missing label, icon, palette group, cursor, hook name, binding or binding id, and, given `registered`, an action a binding names that nothing registers.

```ts
expect(toolGaps(tool, (id) => registry.list().some((a) => a.id === id))).toEqual([]);
```

<!-- entry: api -->
