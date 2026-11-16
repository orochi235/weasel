---
'@weasel-js/text': major
---

`registerShaper` and `registerBidi` throw when a different engine is already registered, unless the call passes `{ replace: true }`.

Registering the same engine again, or `null`, is unchanged. Code that swapped one engine for another without releasing the first now says so:

```ts
registerShaper(other, { replace: true });
```

<!-- entry: breaking api -->
