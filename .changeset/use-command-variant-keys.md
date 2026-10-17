---
'@weasel-js/routing': patch
---

`useCommand`'s `keys` takes the `{ spec, opts: { params } }` form an action's `defaultBinding` does, alone or in a list, so a variant gets its own key: `{ spec: { kind: 'key', key: '=' }, opts: { params: { dir: 'in' } } }` runs the command with `{ dir: 'in' }`, and that variant's menu row and palette entry show `=`.
