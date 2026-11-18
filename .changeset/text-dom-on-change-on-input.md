---
'@weasel-js/text-dom': major
---

`useTextEdit`'s `commit` and `onDraft` options are `onChange` and `onInput`: the finished edit, and the live value while typing.

```ts
// before
useTextEdit({ ...opts, commit: (id, edit) => write(id, edit), onDraft: (id, draft) => follow(id, draft) });
// after
useTextEdit({ ...opts, onChange: (id, edit) => write(id, edit), onInput: (id, draft) => follow(id, draft) });
```

<!-- entry: breaking api -->
