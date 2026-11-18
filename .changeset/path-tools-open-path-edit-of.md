---
'@weasel-js/path-tools': major
---

`depOf` is `openPathEditOf`: the `editAnchors` dep while a path is open for editing, or null.

```ts
// before
const dep = depOf(deps);
// after
const dep = openPathEditOf(deps);
```

<!-- entry: breaking api -->
