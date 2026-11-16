---
'@weasel-js/routing': major
'@weasel-js/core': major
---

A `claimed` entry hears only input that hit one of its own affordances; name the layers it hit-tests under other ids with `claimed: [ids]`.

A hit is the entry's own when its `owner` is the entry's id or one of the listed ids. Input that hit another entry's layer, the kit's chrome, or nothing at all, a keystroke among it, no longer reaches a `claimed` entry's bindings. An entry relying on hearing that input declares `always` instead, or beside it. `claimed` no longer takes `false`.

```ts
// before: live for every input, like `always`
{ id: 'my-handles', eligibility: { claimed: true }, layers: [handleLayer] }
// after: live for presses on the layer `handleLayer` registers
{ id: 'my-handles', eligibility: { claimed: [handleLayer.id] }, layers: [handleLayer] }
```

<!-- entry: breaking behavior api -->
