---
'@weasel-js/gestures': major
'@weasel-js/routing': major
---

A held-key gesture spec's kind is `'keyHeld'`, camelCase like `'doubleClick'` and `'longPress'` and matching the route grammar's `keyHeld`.

Specs built with `held('Space')` need no change. A spec written out by hand, or a binding override saved as a spec object, changes its `kind`:

```ts
// before
{ kind: 'key-held', key: ' ' }
// after
{ kind: 'keyHeld', key: ' ' }
```

<!-- entry: breaking api data -->
