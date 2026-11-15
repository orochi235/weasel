---
'@weasel-js/editor': minor
---

`writeSession` removes the document when given `undefined` for its value.

It is held to the same rule as a write: a document `readStored` could not read is not removed until its copy aside has landed.

```ts
await writeSession(['myapp:draft', undefined]);
```

<!-- entry: api -->
