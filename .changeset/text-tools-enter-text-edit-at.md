---
'@weasel-js/text-tools': major
---

`editTextAtAction` is `enterTextEditAtAction`, with the id `enterTextEditAt`, beside its sibling `enterTextEdit`.

Its double-click binding's id is `enterTextEditAt.doubleClick`.

```ts
// before
actions.trigger('editTextAt', { world });
// after
actions.trigger('enterTextEditAt', { world });
```

<!-- entry: breaking api -->
