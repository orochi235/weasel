---
'@weasel-js/editing': major
---

Editing's hit predicates `onEmptyCanvas` and `onBody` are `isEmptyOffChrome` and `isBodyOffChrome`.

```ts
// before
{ kind: 'drag', target: { kindOf: onEmptyCanvas } }
// after
{ kind: 'drag', target: { kindOf: isEmptyOffChrome } }
```

<!-- entry: breaking api -->
